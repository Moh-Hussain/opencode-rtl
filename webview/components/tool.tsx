import { useEffect, useMemo, useState } from "preact/hooks";
import type { ToolPart } from "../../src/shared/types";
import { useApp } from "../context";
import { basename, dirname, duration } from "../format";
import { highlightCode, renderDiff, stripAnsi } from "../markdown";
import { Icon, IconButton, Spinner, type IconName } from "./ui";

const TOOL_META: Record<string, { icon: IconName; key: string }> = {
  read: { icon: "file", key: "tool.read" },
  write: { icon: "insert", key: "tool.write" },
  edit: { icon: "code", key: "tool.edit" },
  multiedit: { icon: "code", key: "tool.edit" },
  bash: { icon: "terminal", key: "tool.bash" },
  grep: { icon: "search", key: "tool.grep" },
  glob: { icon: "folder", key: "tool.glob" },
  list: { icon: "folder", key: "tool.list" },
  ls: { icon: "folder", key: "tool.list" },
  webfetch: { icon: "globe", key: "tool.webfetch" },
  task: { icon: "sparkle", key: "tool.task" },
  todowrite: { icon: "list", key: "tool.todo" },
  todo: { icon: "list", key: "tool.todo" },
  patch: { icon: "diff", key: "tool.patch" },
};

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  html: "html",
  md: "markdown",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  sh: "bash",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  php: "php",
  rb: "ruby",
};

function languageFor(file?: string): string {
  if (!file) return "";
  return EXT_LANG[file.split(".").pop()?.toLowerCase() || ""] || "";
}

function shortPath(value: string): string {
  if (!value) return "";
  const parts = value.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return parts.join("/");
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

function statusIcon(status: ToolPart["state"]["status"]) {
  if (status === "running") return <Spinner size={14} />;
  if (status === "completed") return <Icon name="check-circle" size={15} className="tool-status-ok" />;
  if (status === "error") return <Icon name="alert" size={15} className="tool-status-err" />;
  return <Icon name="circle" size={14} className="tool-status-idle" />;
}

function prettyOutput(value: string): string {
  return stripAnsi(value).replace(/<\/?content>/g, "").trim();
}

function todosFrom(input: any, metadata: any): Array<{ content: string; status: string }> {
  const source = metadata?.todos || input?.todos;
  return Array.isArray(source) ? source : [];
}

function buildEditPatch(input: any): string {
  const oldText = typeof input?.oldString === "string" ? input.oldString : "";
  const newText = typeof input?.newString === "string" ? input.newString : "";
  if (!oldText && !newText) return "";
  const oldLines = oldText.split("\n").map((line: string) => `-${line}`).join("\n");
  const newLines = newText.split("\n").map((line: string) => `+${line}`).join("\n");
  return `@@ -1,${oldText.split("\n").length} +1,${newText.split("\n").length} @@\n${oldLines}\n${newLines}`;
}

export function ToolCard({ part, streaming }: { part: ToolPart; streaming: boolean }) {
  const { t, post } = useApp();
  const state = part.state || { status: "pending" };
  const [open, setOpen] = useState(state.status === "error");
  const [showAll, setShowAll] = useState(false);
  const meta = TOOL_META[part.tool] || { icon: "wrench" as IconName, key: "tool.default" };
  const input: any = state.input || {};
  const metadata: any = (state as any).metadata || {};

  useEffect(() => {
    if (state.status === "error") setOpen(true);
  }, [state.status]);

  const filePath: string | undefined = input.filePath || input.path || metadata.filepath;
  const title =
    state.title ||
    input.command ||
    input.pattern ||
    input.query ||
    input.description ||
    filePath ||
    input.url ||
    part.tool;

  const displayTitle = filePath ? shortPath(filePath) : input.description || title;
  const isBash = part.tool === "bash" || part.tool === "shell";
  const isRead = part.tool === "read";
  const isEdit = part.tool === "edit" || part.tool === "multiedit" || part.tool === "write";
  const isTodo = part.tool === "todowrite" || part.tool === "todo";
  const isList = part.tool === "glob" || part.tool === "list" || part.tool === "ls";

  const patch = useMemo(() => {
    if (part.tool === "write") return "";
    const fromMeta = metadata?.diff || metadata?.patch || metadata?.filediff?.patch;
    if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta;
    if (typeof input.diff === "string" && input.diff.trim()) return input.diff;
    return buildEditPatch(input);
  }, [part.tool, metadata, input]);

  const rawOutput = typeof state.output === "string" ? state.output : "";
  const displayText = isRead ? (metadata?.display?.text || prettyOutput(rawOutput)) : prettyOutput(rawOutput);
  const lineInfo = isRead && metadata?.display ? `${metadata.display.lineStart}-${metadata.display.lineEnd} / ${metadata.display.totalLines}` : "";
  const output = displayText.length > 12_000 && !showAll ? `${displayText.slice(0, 12_000)}\n…` : displayText;
  const todos = isTodo ? todosFrom(input, metadata) : [];
  const listEntries = isList
    ? prettyOutput(rawOutput)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 60)
    : [];

  const openFile = (path: string, line?: number) => {
    if (!path) return;
    post({ type: "openFile", path, line });
  };

  return (
    <div class={`tool tool-${state.status} ${open ? "is-open" : ""}`}>
      <button type="button" class="tool-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span class="tool-state">{statusIcon(state.status)}</span>
        <span class={`tool-kind tool-kind-${part.tool}`}>
          <Icon name={meta.icon} size={13} />
          {t(meta.key)}
        </span>
        {filePath ? (
          <span
            class="tool-target tool-target-link"
            title={filePath}
            onClick={(event) => {
              event.stopPropagation();
              openFile(filePath, metadata?.display?.lineStart);
            }}
          >
            <bdi dir="ltr">{displayTitle}</bdi>
          </span>
        ) : (
          <span class={`tool-target ${isBash ? "is-mono" : ""}`} title={title}>
            <bdi dir="auto">{displayTitle}</bdi>
          </span>
        )}
        {lineInfo ? <span class="tool-extra" dir="ltr">{lineInfo}</span> : null}
        {isTodo && todos.length ? <span class="tool-extra">{todos.filter((todo) => todo.status === "completed").length}/{todos.length}</span> : null}
        {state.time?.start ? <span class="tool-time">{duration(state.time.start, state.time.end)}</span> : null}
        <span class="tool-chevron">
          <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
        </span>
      </button>

      {open ? (
        <div class="tool-body">
          {state.status === "error" ? (
            <div class="tool-error">
              <Icon name="alert" size={15} />
              <span dir="auto">{prettyOutput(state.error || "Tool failed")}</span>
            </div>
          ) : null}

          {isTodo && todos.length ? (
            <ul class="tool-todos">
              {todos.map((todo, index) => (
                <li key={index} class={`tool-todo status-${todo.status}`}>
                  <Icon
                    name={todo.status === "completed" ? "check-circle" : todo.status === "in_progress" ? "clock" : "circle"}
                    size={14}
                  />
                  <span>{todo.content}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {isBash ? (
            <div class="tool-section">
              <div class="tool-command" dir="ltr">
                <span class="tool-prompt">$</span>
                <code>{input.command}</code>
                <IconButton icon="copy" label={t("message.copy")} size={13} onClick={() => post({ type: "copyText", text: input.command || "" })} />
              </div>
              {output ? (
                <pre class="tool-pre" dir="ltr">
                  {output}
                </pre>
              ) : null}
            </div>
          ) : null}

          {isEdit && patch ? (
            <div class="tool-section">
              <div class="tool-section-head">{t("tool.diff")}</div>
              <div dangerouslySetInnerHTML={{ __html: renderDiff(patch) }} />
            </div>
          ) : null}

          {isEdit && !patch && input.content ? (
            <div class="tool-section">
              <div class="tool-section-head">
                {t("tool.diff")} <span class="tool-badge">{filePath ? basename(filePath) : ""}</span>
              </div>
              <div class="code-block" dir="ltr">
                <pre>
                  <code class="hljs" dangerouslySetInnerHTML={{ __html: highlightCode(String(input.content).slice(0, 20_000), languageFor(filePath)) }} />
                </pre>
              </div>
            </div>
          ) : null}

          {isRead && output ? (
            <div class="tool-section">
              <div class="tool-section-head">
                {t("tool.output")} {lineInfo ? <span class="tool-badge" dir="ltr">{lineInfo}</span> : null}
                <IconButton
                  icon="copy"
                  label={t("message.copy")}
                  size={13}
                  onClick={() => post({ type: "copyText", text: output })}
                  className="tool-copy"
                />
              </div>
              <div class="code-block" dir="ltr">
                <pre>
                  <code class="hljs" dangerouslySetInnerHTML={{ __html: highlightCode(output, languageFor(filePath)) }} />
                </pre>
              </div>
            </div>
          ) : null}

          {isList && listEntries.length ? (
            <div class="tool-section">
              <div class="tool-section-head">
                {metadata?.count ?? listEntries.length} {t("tool.glob")}
              </div>
              <div class="tool-list">
                {listEntries.map((entry) => (
                  <button type="button" key={entry} class="tool-list-row" onClick={() => openFile(entry)} title={entry}>
                    <Icon name="file" size={13} />
                    <span dir="ltr">{shortPath(entry)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!isBash && !isEdit && !isRead && !isTodo && !isList && output ? (
            <div class="tool-section">
              <div class="tool-section-head">
                {t("tool.output")}
                <IconButton
                  icon="copy"
                  label={t("message.copy")}
                  size={13}
                  onClick={() => post({ type: "copyText", text: output })}
                  className="tool-copy"
                />
              </div>
              <pre class="tool-pre" dir="auto">
                {output}
              </pre>
            </div>
          ) : null}

          {!output && !isEdit && !isTodo && !isList && state.status === "running" ? (
            <div class="tool-running">
              <Spinner size={13} /> {t("tool.running")}
            </div>
          ) : null}

          {displayText.length > 12_000 ? (
            <button type="button" class="tool-more" onClick={() => setShowAll((value) => !value)}>
              {showAll ? t("tool.showLess") : t("tool.showMore")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { shortPath };
