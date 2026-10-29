import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import type { Language } from "../src/shared/types";
import { translate } from "./i18n";

const languages: Record<string, any> = {
  bash,
  sh: bash,
  shell: bash,
  zsh: bash,
  cpp,
  c: cpp,
  csharp,
  cs: csharp,
  css,
  diff,
  go,
  java,
  javascript,
  js: javascript,
  jsx: javascript,
  json,
  markdown,
  md: markdown,
  php,
  python,
  py: python,
  ruby,
  rb: ruby,
  rust,
  rs: rust,
  sql,
  typescript,
  ts: typescript,
  tsx: typescript,
  html: xml,
  xml,
  svg: xml,
  vue: xml,
  yaml,
  yml: yaml,
};

for (const [name, definition] of Object.entries(languages)) {
  if (!hljs.getLanguage(name)) hljs.registerLanguage(name, definition);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COPY_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

export function highlightCode(code: string, lang?: string): string {
  const language = (lang || "").toLowerCase();
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      return escapeHtml(code);
    }
  }
  return escapeHtml(code);
}

export function renderDiff(patch: string): string {
  const lines = (patch || "").split("\n");
  const rows: string[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      rows.push(`<div class="diff-row diff-hunk"><span class="diff-num"></span><span class="diff-num"></span><span class="diff-text">${escapeHtml(line)}</span></div>`);
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff --git") || line.startsWith("index ")) {
      rows.push(`<div class="diff-row diff-meta"><span class="diff-num"></span><span class="diff-num"></span><span class="diff-text">${escapeHtml(line)}</span></div>`);
      continue;
    }
    const kind = line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "ctx";
    const text = line.length ? line.slice(1) : line;
    const oldNumber = kind === "add" ? "" : String(oldLine);
    const newNumber = kind === "del" ? "" : String(newLine);
    if (kind !== "add") oldLine++;
    if (kind !== "del") newLine++;
    rows.push(
      `<div class="diff-row diff-${kind}"><span class="diff-num">${oldNumber}</span><span class="diff-num">${newNumber}</span><span class="diff-text">${escapeHtml(text) || "&nbsp;"}</span></div>`,
    );
  }
  return `<div class="diff" dir="ltr">${rows.join("")}</div>`;
}

function createRenderer(language: Language) {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: false,
  });

  const copyLabel = translate(language, "message.copy");

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = (token.info || "").trim();
    const lang = info.split(/\s+/)[0] || "";
    const code = token.content.replace(/\n$/, "");
    const highlighted = highlightCode(code, lang);
    return `<div class="code-block" dir="ltr">
      <div class="code-head"><span class="code-lang">${escapeHtml(lang || "text")}</span>
      <button class="code-copy" type="button" aria-label="${escapeHtml(copyLabel)}" title="${escapeHtml(copyLabel)}">${COPY_ICON}<span>${escapeHtml(copyLabel)}</span></button></div>
      <pre><code class="hljs${lang ? ` language-${escapeHtml(lang)}` : ""}">${highlighted}</code></pre>
    </div>`;
  };

  md.renderer.rules.code_block = (tokens, idx) => {
    const code = tokens[idx].content.replace(/\n$/, "");
    return `<div class="code-block" dir="ltr"><div class="code-head"><span class="code-lang">text</span>
      <button class="code-copy" type="button" aria-label="${escapeHtml(copyLabel)}">${COPY_ICON}<span>${escapeHtml(copyLabel)}</span></button></div>
      <pre><code class="hljs">${escapeHtml(code)}</code></pre></div>`;
  };

  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href") || "";
    token.attrSet("data-href", href);
    token.attrSet("rel", "noreferrer noopener");
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.table_open = () => '<div class="table-wrap" dir="auto"><table>';
  md.renderer.rules.table_close = () => "</table></div>";

  md.renderer.rules.image = (tokens, idx) => {
    const token = tokens[idx];
    const src = token.attrGet("src") || "";
    const alt = token.content || "";
    if (/^https?:/i.test(src)) {
      return `<span class="md-link-chip" data-href="${escapeHtml(src)}">${escapeHtml(alt || src)}</span>`;
    }
    return escapeHtml(alt);
  };

  md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    token.attrJoin("class", "md-heading");
    return self.renderToken(tokens, idx, options);
  };

  return md;
}

const renderers: Partial<Record<Language, MarkdownIt>> = {};

export function renderMarkdown(text: string, language: Language): string {
  const md = (renderers[language] ||= createRenderer(language));
  return md.render(text || "");
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return (text || "").replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

export function formatTokens(value?: number): string {
  if (!value || value < 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

export function formatCost(value?: number): string {
  if (!value) return "";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
