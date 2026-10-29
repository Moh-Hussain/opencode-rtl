import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { createServer } from "node:net";
import { access, readdir } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export interface Logger {
  appendLine(value: string): void;
}

export interface StartedServer {
  url: string;
  version: string;
  managed: boolean;
  executable?: string;
}

const isWindows = process.platform === "win32";
const binary = isWindows ? "opencode.exe" : "opencode";

async function exists(file: string): Promise<boolean> {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveExecutable(configured: string): Promise<string | undefined> {
  const value = (configured || "opencode").trim();
  if (!value) return undefined;

  if (value.includes(path.sep) || value.includes("/")) {
    const expanded = value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
    return (await exists(expanded)) ? expanded : undefined;
  }

  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const candidates: string[] = [];
  for (const entry of pathEntries) candidates.push(path.join(entry, value), path.join(entry, binary));

  const home = os.homedir();
  candidates.push(
    path.join(home, ".opencode", "bin", binary),
    path.join(home, ".local", "bin", binary),
    path.join(home, ".bun", "bin", binary),
    path.join(home, ".npm-global", "bin", binary),
    "/opt/homebrew/bin/opencode",
    "/usr/local/bin/opencode",
    "/usr/bin/opencode",
  );

  if (isWindows) {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    candidates.push(
      path.join(appData, "npm", "opencode.cmd"),
      path.join(localAppData, "opencode", "bin", "opencode.exe"),
      path.join(home, ".opencode", "bin", "opencode.exe"),
    );
  }

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }

  // Last resort: check the OpenCode desktop bundle on macOS.
  if (process.platform === "darwin") {
    const bundles = ["/Applications/OpenCode.app/Contents/Resources/app/bin/opencode"];
    for (const bundle of bundles) if (await exists(bundle)) return bundle;
  }

  return undefined;
}

function authHeader(password?: string): Record<string, string> | undefined {
  if (!password) return undefined;
  return { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` };
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

export async function probeServer(url: string, password?: string, timeout = 4000): Promise<{ healthy: boolean; version: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/global/health`, {
      headers: authHeader(password),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as { healthy?: boolean; version?: string };
    return { healthy: body.healthy !== false, version: body.version || "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

export class ServerManager {
  private child?: ChildProcess;
  private disposed = false;

  constructor(
    private readonly log: Logger,
    private readonly password?: string,
  ) {}

  get running(): boolean {
    return Boolean(this.child && this.child.exitCode === null);
  }

  async start(options: { executable: string; cwd?: string; timeoutMs?: number }): Promise<StartedServer> {
    if (this.disposed) throw new Error("Server manager disposed");
    this.stop();

    const executable = await resolveExecutable(options.executable);
    if (!executable) {
      throw new Error(
        `Could not find the OpenCode CLI ("${options.executable}"). Install it from opencode.ai, or set opencodeRtl.executable / opencodeRtl.serverUrl.`,
      );
    }

    const port = await freePort();
    const args = ["serve", "--port", String(port), "--hostname", "127.0.0.1"];
    this.log.appendLine(`[server] spawning ${executable} ${args.join(" ")} (cwd: ${options.cwd || process.cwd()})`);

    const env = { ...process.env };
    if (this.password) env.OPENCODE_SERVER_PASSWORD = this.password;

    const child = spawn(executable, args, {
      cwd: options.cwd || process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: !isWindows,
      windowsHide: true,
    });
    this.child = child;

    return new Promise<StartedServer>((resolve, reject) => {
      let settled = false;
      let output = "";
      const timeoutMs = options.timeoutMs ?? 45_000;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.stop();
        reject(new Error(`OpenCode server did not start within ${Math.round(timeoutMs / 1000)}s.\n${output.slice(-1200)}`));
      }, timeoutMs);

      const finish = async (url: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          const health = await probeServer(url, this.password, 6000);
          this.log.appendLine(`[server] ready at ${url} (v${health.version})`);
          resolve({ url, version: health.version, managed: true, executable });
        } catch (error) {
          reject(new Error(`Server started but is not responding at ${url}: ${(error as Error).message}`));
        }
      };

      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        for (const line of text.split(/\r?\n/)) {
          if (!line.trim()) continue;
          this.log.appendLine(`[server] ${line}`);
          const match = line.match(/(?:listening on|server running at|url:)\s*(https?:\/\/[^\s]+)/i);
          if (match) void finish(match[1].replace(/\/+$/, ""));
        }
      };

      child.stdout.on("data", onData);
      child.stderr.on("data", onData);

      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to start OpenCode: ${error.message}`));
      });

      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        this.child = undefined;
        if (!settled) {
          settled = true;
          reject(new Error(`OpenCode exited before becoming ready (code ${code ?? "?"}/${signal ?? "?"}).\n${output.slice(-1200)}`));
        } else {
          this.log.appendLine(`[server] exited (code ${code ?? "?"}/${signal ?? "?"})`);
        }
      });
    });
  }

  stop(): void {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null) return;
    try {
      if (isWindows) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      } else if (child.pid) {
        process.kill(-child.pid, "SIGTERM");
        setTimeout(() => {
          try {
            if (child.exitCode === null && child.pid) process.kill(-child.pid, "SIGKILL");
          } catch {
            /* already gone */
          }
        }, 2500).unref?.();
      }
    } catch (error) {
      this.log.appendLine(`[server] failed to stop: ${(error as Error).message}`);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }
}

export async function listCommonDirectories(home: string): Promise<string[]> {
  try {
    return await readdir(home);
  } catch {
    return [];
  }
}
