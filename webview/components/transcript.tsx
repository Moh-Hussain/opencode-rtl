import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ChatMessage, ChatPart, FilePart, ReasoningPart, TextPart, ToolPart } from "../../src/shared/types";
import { useApp } from "../context";
import { duration, relativeTime, shortTime } from "../format";
import { formatCost, formatTokens } from "../markdown";
import { AttachmentChip, FilePartChip } from "./attachments";
import { Markdown } from "./markdown";
import { ConnectionBanner, EmptyState } from "./panels";
import { ToolCard } from "./tool";
import { Icon, IconButton, Logo, Spinner } from "./ui";

export function Transcript() {
  const { state, t, dispatch } = useApp();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const sessionId = state.currentSession?.id;

  const busy = state.status.type === "busy" || state.status.type === "retry";
  const last = state.messages[state.messages.length - 1];
  const streaming = Boolean(
    busy && last && last.info.role === "assistant" && !last.info.time?.completed,
  );
  const hasStreamText = Boolean(last?.parts.some((part) => part.type === "text" && String((part as TextPart).text || "").length));

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (stick.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [state.messages, state.status.type, state.permissions.length, state.questions.length]);

  useEffect(() => {
    stick.current = true;
    setShowJump(false);
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [sessionId]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 140;
    stick.current = nearBottom;
    setShowJump(!nearBottom);
  };

  const jump = () => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    stick.current = true;
    setShowJump(false);
  };

  const empty = state.messages.length === 0;

  return (
    <div class="transcript-wrap">
      <div class="transcript" ref={scroller} onScroll={onScroll}>
        <ConnectionBanner />
        {empty ? (
          <EmptyState onPick={(text) => {
            dispatch({ type: "local:composer", text });
            dispatch({ type: "local:focusComposer" });
          }} />
        ) : (
          <div class="thread">
            {state.messages.map((message, index) => (
              <MessageView
                key={message.info.id}
                message={message}
                isLast={index === state.messages.length - 1}
                streaming={streaming && index === state.messages.length - 1}
              />
            ))}
            {busy && !hasStreamText ? <ThinkingRow /> : null}
            <div class="thread-tail" />
          </div>
        )}
      </div>
      {showJump ? (
        <button type="button" class={`jump ${busy ? "jump-busy" : ""}`} onClick={jump} aria-label={t("message.jump")}>
          <Icon name="chevron-down" size={16} />
        </button>
      ) : null}
    </div>
  );
}

function MessageView({ message, isLast, streaming }: { message: ChatMessage; isLast: boolean; streaming: boolean }) {
  if (message.info.role === "user") return <UserMessage message={message} />;
  return <AssistantMessage message={message} streaming={streaming} isLast={isLast} />;
}

function UserMessage({ message }: { message: ChatMessage }) {
  const { state, t, post } = useApp();
  const texts = message.parts.filter((part) => part.type === "text") as TextPart[];
  const files = message.parts.filter((part) => part.type === "file") as FilePart[];

  return (
    <div class="msg msg-user">
      <div class="msg-user-head">
        <span class="msg-user-name">{t("message.you")}</span>
        <span class="msg-time">{shortTime(message.info.time?.created)}</span>
      </div>
      <div class="bubble">
        {files.length ? (
          <div class="bubble-files">
            {files.map((file) => (
              <FilePartChip key={file.id} part={file} />
            ))}
          </div>
        ) : null}
        {texts.map((part) => (
          <div class="user-text" key={part.id} dir="auto">
            {part.text}
          </div>
        ))}
      </div>
      <div class="msg-user-actions">
        <IconButton
          icon="copy"
          label={t("message.copy")}
          size={14}
          onClick={() => post({ type: "copyText", text: texts.map((part) => part.text).join("\n\n") })}
        />
      </div>
    </div>
  );
}

function AssistantMessage({ message, streaming, isLast }: { message: ChatMessage; streaming: boolean; isLast: boolean }) {
  const { state, t, post } = useApp();
  const model = state.models.find(
    (entry) => entry.id === message.info.modelID && (!message.info.providerID || entry.providerID === message.info.providerID),
  );
  const textParts = message.parts.filter((part) => part.type === "text") as TextPart[];
  const allText = textParts.map((part) => part.text).join("\n\n");
  const lastTextId = textParts[textParts.length - 1]?.id;
  const lastToolId = [...message.parts].reverse().find((part) => part.type === "tool")?.id;
  const tokens = (message.info.tokens?.input || 0) + (message.info.tokens?.output || 0);
  const error = message.info.error;
  const completed = message.info.time?.completed;
  const elapsed = completed && message.info.time?.created ? duration(message.info.time.created, completed) : undefined;

  return (
    <article class="msg msg-assistant">
      <div class="msg-avatar">
        <Logo size={26} />
      </div>
      <div class="msg-body">
        <header class="msg-head">
          <span class="msg-name">{t("message.assistant")}</span>
          {model ? <span class="msg-model">{model.name}</span> : null}
          {message.info.agent && message.info.agent !== "build" ? <span class="msg-agent">{message.info.agent}</span> : null}
          <span class="msg-time">{message.info.time?.created ? relativeTime(message.info.time.created, t, state.ui.language) : ""}</span>
          <div class="msg-actions">
            <IconButton icon="copy" label={t("message.copy")} size={14} onClick={() => post({ type: "copyText", text: allText })} />
            <IconButton icon="insert" label={t("message.insert")} size={14} onClick={() => post({ type: "insertText", text: allText })} />
          </div>
        </header>

        {message.parts.map((part) => {
          if (part.type === "text") {
            const text = part as TextPart;
            if (!text.text) return null;
            return (
              <div class="part-text" key={part.id}>
                <Markdown text={text.text} />
                {streaming && part.id === lastTextId ? <span class="stream-caret" aria-hidden="true" /> : null}
              </div>
            );
          }
          if (part.type === "reasoning") {
            return <ReasoningCard key={part.id} part={part as ReasoningPart} streaming={streaming && isLast} />;
          }
          if (part.type === "tool") {
            return <ToolCard key={part.id} part={part as ToolPart} streaming={streaming && part.id === lastToolId} />;
          }
          if (part.type === "file") {
            return <FilePartChip key={part.id} part={part as FilePart} />;
          }
          if (part.type === "agent" || part.type === "subtask") {
            const name = (part as any).name || (part as any).agent || part.type;
            return (
              <span class="inline-chip" key={part.id}>
                <Icon name="fork" size={12} /> {name}
              </span>
            );
          }
          if (part.type === "step-start" || part.type === "step-finish") {
            return null;
          }
          return null;
        })}

        {error ? (
          <div class="msg-error">
            <Icon name="alert" size={16} />
            <div>
              <strong>{t("message.error")}</strong>
              <p dir="auto">{error.data?.message || error.message || error.name || t("error.generic")}</p>
            </div>
          </div>
        ) : null}

        {!streaming && (tokens > 0 || message.info.cost) ? (
          <footer class="msg-meta">
            {tokens ? (
              <span>
                <Icon name="sparkle" size={12} /> {formatTokens(tokens)} {t("message.tokens")}
              </span>
            ) : null}
            {message.info.cost ? <span>{formatCost(message.info.cost)}</span> : null}
            {elapsed ? (
              <span>
                <Icon name="clock" size={12} /> {elapsed}
              </span>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}

function ReasoningCard({ part, streaming }: { part: ReasoningPart; streaming: boolean }) {
  const { state, t, dispatch } = useApp();
  const override = state.showReasoningLocal[part.id];
  const live = !part.time?.end;
  const open = override !== undefined ? override : state.ui.showReasoning || live;
  const toggle = () => dispatch({ type: "local:reasoning", messageId: part.id, open: !open });

  return (
    <div class={`reasoning ${open ? "is-open" : ""}`}>
      <button type="button" class="reasoning-head" onClick={toggle} aria-expanded={open}>
        <Icon name="brain" size={14} />
        <span class={`reasoning-label ${live && open ? "is-live" : ""}`}>
          {live ? t("message.thinking") : t("message.reasoning")}
        </span>
        {live ? <span class="thinking-dots"><i /><i /><i /></span> : null}
        <span class="reasoning-chevron">
          <Icon name={open ? "chevron-down" : "chevron-right"} size={13} />
        </span>
      </button>
      {open ? (
        <div class="reasoning-body" dir="auto">
          {part.text}
          {live ? <span class="stream-caret small" aria-hidden="true" /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ThinkingRow() {
  const { t, state } = useApp();
  return (
    <div class="msg msg-assistant thinking-msg">
      <div class="msg-avatar">
        <Logo size={26} />
      </div>
      <div class="thinking">
        <span class="thinking-orb">
          <Spinner size={14} />
        </span>
        <span class="thinking-label">{state.status.type === "retry" ? state.status.message || t("message.thinking") : t("message.thinking")}</span>
        <span class="thinking-dots"><i /><i /><i /></span>
      </div>
    </div>
  );
}
