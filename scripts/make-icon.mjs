import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "media", "icon.svg");
const output = join(root, "media", "icon.png");

const candidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const chrome = candidates.find((candidate) => existsSync(candidate));
if (!chrome) {
  console.error("Chrome was not found. Set CHROME_PATH to generate media/icon.png.");
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });
const page = join(mkdtempSync(join(tmpdir(), "opencode-rtl-icon-")), "icon.html");
writeFileSync(page, `<!DOCTYPE html><html><head><style>html,body{margin:0;width:256px;height:256px;overflow:hidden;background:transparent}img{display:block;width:256px;height:256px}</style></head><body><img src="${pathToFileURL(source).href}"></body></html>`);
execFileSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--default-background-color=00000000",
  "--window-size=256,256",
  `--screenshot=${output}`,
  pathToFileURL(page).href,
], { stdio: "ignore" });
rmSync(dirname(page), { recursive: true, force: true });

console.log(`Wrote ${output}`);
