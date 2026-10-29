import type { OpencodeEvent } from "../shared/protocol";
import type {
  AgentInfo,
  ChatMessage,
  ChatPart,
  MessageInfo,
  PermissionRequest,
  QuestionRequest,
  SessionDiffFile,
  SessionStatus,
  SessionSummary,
  TodoItem,
} from "../shared/types";

export interface ApiOptions {
  baseUrl: string;
  password?: string;
  directory?: string;
}

export interface ProviderModel {
  id: string;
  name: string;
  family?: string;
  release_date?: string;
  capabilities?: {
    reasoning?: boolean;
    attachment?: boolean;
    toolcall?: boolean;
    temperature?: boolean;
    input?: Record<string, boolean>;
    output?: Record<string, boolean>;
  };
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  limit?: { context?: number; output?: number };
  status?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: Record<string, ProviderModel>;
  source?: string;
}

export interface PromptInput {
  text: string;
  files?: { url: string; mime: string; filename?: string }[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class OpencodeApi {
  readonly baseUrl: string;
  private readonly password?: string;
  readonly directory?: string;

  constructor(options: ApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.password = options.password || undefined;
    this.directory = options.directory;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { accept: "application/json", ...extra };
    if (this.password) {
      const token = Buffer.from(`opencode:${this.password}`).toString("base64");
      headers.authorization = `Basic ${token}`;
    }
    return headers;
  }

  private url(path: string, withDirectory = false): string {
    const url = new URL(this.baseUrl + path);
    if (withDirectory && this.directory) url.searchParams.set("directory", this.directory);
    return url.toString();
  }

  async request<T>(path: string, init: RequestInit = {}, withDirectory = true): Promise<T> {
    const headers = this.headers({
      "content-type": "application/json",
      ...((init.headers as Record<string, string>) || {}),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(this.url(path, withDirectory), { ...init, headers, signal: controller.signal });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        let message = `${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(body);
          message = parsed.message || parsed.error || message;
        } catch {
          if (body) message = body.slice(0, 300);
        }
        throw new ApiError(message, response.status, body);
      }
      if (response.status === 204) return undefined as T;
      const text = await response.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<{ healthy: boolean; version: string }> {
    return this.request("/global/health", {}, false);
  }

  async providers(): Promise<{ providers: ProviderInfo[]; default: Record<string, string> }> {
    return this.request("/config/providers");
  }

  async agents(): Promise<AgentInfo[]> {
    return this.request("/agent");
  }

  async sessions(limit = 60): Promise<SessionSummary[]> {
    const list = await this.request<any[]>(`/session?limit=${limit}`);
    return list.map(toSessionSummary);
  }

  async session(id: string): Promise<SessionSummary> {
    return toSessionSummary(await this.request(`/session/${id}`));
  }

  async createSession(input: { title?: string; agent?: string; model?: { id: string; providerID: string } }): Promise<SessionSummary> {
    return toSessionSummary(await this.request("/session", { method: "POST", body: JSON.stringify(input) }));
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(`/session/${id}`, { method: "DELETE" });
  }

  async forkSession(id: string): Promise<SessionSummary> {
    return toSessionSummary(await this.request(`/session/${id}/fork`, { method: "POST", body: "{}" }));
  }

  async messages(sessionID: string): Promise<ChatMessage[]> {
    const list = await this.request<any[]>(`/session/${sessionID}/message`);
    if (!Array.isArray(list)) return [];
    return list.map((entry) => {
      if (entry && entry.info && Array.isArray(entry.parts)) {
        return { info: entry.info as MessageInfo, parts: entry.parts as ChatPart[] };
      }
      // Some servers return a flat list of parts.
      if (entry && entry.type && entry.messageID) return null;
      return null;
    }).filter(Boolean) as ChatMessage[];
  }

  async prompt(sessionID: string, input: PromptInput, options: { model?: { providerID: string; modelID: string }; agent?: string } = {}): Promise<void> {
    const parts: any[] = [];
    if (input.text.trim()) parts.push({ type: "text", text: input.text });
    for (const file of input.files || []) {
      parts.push({ type: "file", mime: file.mime, url: file.url, filename: file.filename });
    }
    if (!parts.length) parts.push({ type: "text", text: "" });
    await this.request(`/session/${sessionID}/prompt_async`, {
      method: "POST",
      body: JSON.stringify({ parts, model: options.model, agent: options.agent || undefined }),
    });
  }

  async command(sessionID: string, command: string, args?: string): Promise<void> {
    await this.request(`/session/${sessionID}/command`, {
      method: "POST",
      body: JSON.stringify({ command, arguments: args || "" }),
    });
  }

  async abort(sessionID: string): Promise<void> {
    await this.request(`/session/${sessionID}/abort`, { method: "POST", body: "{}" });
  }

  async statuses(): Promise<Record<string, SessionStatus>> {
    return this.request("/session/status");
  }

  async todos(sessionID: string): Promise<TodoItem[]> {
    const todos = await this.request<TodoItem[]>(`/session/${sessionID}/todo`);
    return Array.isArray(todos) ? todos : [];
  }

  async permissions(): Promise<PermissionRequest[]> {
    const list = await this.request<PermissionRequest[]>("/permission");
    return Array.isArray(list) ? list : [];
  }

  async replyPermission(requestID: string, reply: "once" | "always" | "reject", message?: string): Promise<void> {
    await this.request(`/permission/${requestID}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply, message }),
    });
  }

  async questions(): Promise<QuestionRequest[]> {
    const list = await this.request<QuestionRequest[]>("/question");
    return Array.isArray(list) ? list : [];
  }

  async replyQuestion(requestID: string, answers: string[][]): Promise<void> {
    await this.request(`/question/${requestID}/reply`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  }

  async rejectQuestion(requestID: string): Promise<void> {
    await this.request(`/question/${requestID}/reject`, { method: "POST", body: "{}" });
  }

  async diff(sessionID: string): Promise<SessionDiffFile[]> {
    const files = await this.request<SessionDiffFile[]>(`/session/${sessionID}/diff`);
    return Array.isArray(files) ? files : [];
  }

  /**
   * Opens the global event stream. Resolves when the stream is closed.
   * The caller is responsible for reconnecting.
   */
  async events(onEvent: (event: OpencodeEvent) => void, signal: AbortSignal): Promise<void> {
    const response = await fetch(this.url("/event", true), {
      headers: this.headers({ accept: "text/event-stream" }),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new ApiError(`Event stream failed: ${response.status}`, response.status);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let index = buffer.indexOf("\n\n");
      while (index !== -1) {
        const chunk = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const data = chunk
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (data) {
          try {
            const parsed = JSON.parse(data) as OpencodeEvent;
            if (parsed && parsed.type) onEvent(parsed);
          } catch {
            // Ignore malformed frames rather than killing the stream.
          }
        }
        index = buffer.indexOf("\n\n");
      }
    }
  }
}

export function toSessionSummary(raw: any): SessionSummary {
  const time = raw?.time || {};
  const tokens = raw?.tokens || {};
  return {
    id: raw?.id || "",
    title: raw?.title || "Untitled",
    created: time.created,
    updated: time.updated,
    cost: raw?.cost,
    tokens: (tokens.input || 0) + (tokens.output || 0),
    directory: raw?.directory,
    parentID: raw?.parentID,
  };
}
