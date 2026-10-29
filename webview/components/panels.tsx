import { useState } from "preact/hooks";
import type { PermissionRequest, QuestionRequest } from "../../src/shared/types";
import { useApp } from "../context";
import { greetingKey } from "../format";
import { Icon, IconButton, Logo, Spinner, type IconName } from "./ui";

export function ConnectionBanner() {
  const { state, t, post, dispatch } = useApp();
  const phase = state.connection.phase;
  if (phase === "ready" || phase === "external") return null;
  if (state.bannerDismissed) return null;

  if (phase === "starting") {
    return (
      <div class="banner banner-starting">
        <div class="banner-head">
          <Spinner size={18} />
          <div>
            <div class="banner-title">{t("connection.starting.title")}</div>
            <div class="banner-text">{t("connection.starting.body")}</div>
          </div>
        </div>
        <div class="banner-progress">
          <span />
        </div>
      </div>
    );
  }

  const error = phase === "error";
  return (
    <div class={`banner ${error ? "banner-error" : "banner-idle"}`}>
      <div class="banner-head">
        <span class={`banner-icon ${error ? "is-error" : ""}`}>
          <Icon name={error ? "alert" : "terminal"} size={18} />
        </span>
        <div class="banner-copy">
          <div class="banner-title">{error ? t("connection.error.title") : t("connection.idle.title")}</div>
          <div class="banner-text">{state.connection.error || t(error ? "connection.error.body" : "connection.idle.body")}</div>
        </div>
        <IconButton
          icon="x"
          label={t("common.close")}
          size={14}
          className="banner-close"
          onClick={() => dispatch({ type: "local:dismissBanner" })}
        />
      </div>
      <div class="banner-actions">
        <button type="button" class="btn btn-primary" onClick={() => post({ type: "retryConnection" })}>
          <Icon name="refresh" size={14} />
          {error ? t("connection.retry") : t("connection.start")}
        </button>
        <button type="button" class="btn btn-ghost" onClick={() => post({ type: "command", name: "openSettings" })}>
          {t("connection.settings")}
        </button>
        <button type="button" class="btn btn-quiet" onClick={() => post({ type: "openUrl", url: "https://opencode.ai/docs" })}>
          {t("connection.docs")}
          <Icon name="external" size={12} />
        </button>
      </div>
    </div>
  );
}

const SUGGESTIONS: Array<{ icon: IconName; title: string; prompt: string }> = [
  { icon: "book", title: "empty.s1.title", prompt: "empty.s1.prompt" },
  { icon: "diff", title: "empty.s2.title", prompt: "empty.s2.prompt" },
  { icon: "check-circle", title: "empty.s3.title", prompt: "empty.s3.prompt" },
  { icon: "wrench", title: "empty.s4.title", prompt: "empty.s4.prompt" },
];

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { state, t, view } = useApp();
  const greeting = t(greetingKey());

  return (
    <div class={`hero hero-${view}`}>
      <div class="hero-orb">
        <div class="hero-ring" />
        <div class="hero-ring hero-ring-2" />
        <Logo size={64} glow />
      </div>
      <div class="hero-greeting">{greeting}</div>
      <h1 class="hero-title">{t("empty.title")}</h1>
      <p class="hero-subtitle">{t("empty.subtitle")}</p>
      <div class="hero-workspace">
        <Icon name="folder" size={13} />
        <span>{t("empty.workspace")}</span>
        <strong dir="auto">{state.hasWorkspace ? state.workspaceName : t("empty.noWorkspace")}</strong>
      </div>

      <div class="suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button type="button" key={suggestion.title} class="suggestion" onClick={() => onPick(t(suggestion.prompt))}>
            <span class="suggestion-icon">
              <Icon name={suggestion.icon} size={17} />
            </span>
            <span class="suggestion-title">{t(suggestion.title)}</span>
            <span class="suggestion-arrow">
              <Icon name={view === "sidebar" ? "chevron-down" : "chevron-left"} size={14} />
            </span>
          </button>
        ))}
      </div>

      <div class="hero-shortcuts">
        <span class="shortcut">
          <span class="keys">
            <kbd>⌘</kbd>
            <kbd>⌥</kbd>
            <kbd>N</kbd>
          </span>
          {t("empty.shortcutNew")}
        </span>
        <span class="shortcut">
          <span class="keys">
            <kbd>⌘</kbd>
            <kbd>⌥</kbd>
            <kbd>R</kbd>
          </span>
          {t("empty.shortcutDir")}
        </span>
      </div>
    </div>
  );
}

const PERMISSION_LABEL: Record<string, { ar: string; en: string }> = {
  bash: { ar: "تشغيل أمر في الطرفية", en: "Run a shell command" },
  edit: { ar: "تعديل ملفات المشروع", en: "Edit project files" },
  write: { ar: "كتابة ملفات جديدة", en: "Write files" },
  webfetch: { ar: "جلب محتوى من الإنترنت", en: "Fetch content from the web" },
  external_directory: { ar: "الوصول لمجلد خارج المشروع", en: "Access a folder outside the project" },
  doom_loop: { ar: "تكرار عملية كثيرة", en: "Repeat an action many times" },
  patch: { ar: "تطبيق تعديلات", en: "Apply a patch" },
};

export function PermissionCard({ request }: { request: PermissionRequest }) {
  const { state, t, post } = useApp();
  const label = PERMISSION_LABEL[request.permission];
  const description = label ? label[state.ui.language] : request.permission;
  const [busy, setBusy] = useState(false);

  const reply = (value: "once" | "always" | "reject") => {
    setBusy(true);
    post({ type: "replyPermission", sessionId: request.sessionID, requestId: request.id, reply: value });
  };

  return (
    <div class="permission">
      <div class="permission-head">
        <span class="permission-icon">
          <Icon name="alert" size={17} />
        </span>
        <div>
          <div class="permission-title">{t("permission.title")}</div>
          <div class="permission-sub" dir="auto">{description}</div>
        </div>
      </div>
      {request.patterns?.length ? (
        <div class="permission-patterns">
          {request.patterns.slice(0, 4).map((pattern, index) => (
            <code key={index} dir="ltr">
              {pattern}
            </code>
          ))}
          {request.patterns.length > 4 ? <span class="permission-more">+{request.patterns.length - 4}</span> : null}
        </div>
      ) : null}
      <div class="permission-actions">
        <button type="button" class="btn btn-primary btn-sm" disabled={busy} onClick={() => reply("once")}>
          {t("permission.once")}
        </button>
        <button type="button" class="btn btn-soft btn-sm" disabled={busy} onClick={() => reply("always")}>
          {t("permission.always")}
        </button>
        <button type="button" class="btn btn-danger-quiet btn-sm" disabled={busy} onClick={() => reply("reject")}>
          {t("permission.reject")}
        </button>
      </div>
    </div>
  );
}

export function QuestionCard({ request }: { request: QuestionRequest }) {
  const { state, t, post } = useApp();
  const [answers, setAnswers] = useState<string[][]>(() => request.questions.map(() => []));
  const [custom, setCustom] = useState<string[]>(() => request.questions.map(() => ""));
  const [error, setError] = useState(false);

  const toggle = (questionIndex: number, label: string, multiple?: boolean) => {
    setError(false);
    setAnswers((current) => {
      const next = current.map((entry) => [...entry]);
      const list = next[questionIndex] || [];
      if (multiple) {
        const at = list.indexOf(label);
        if (at >= 0) list.splice(at, 1);
        else list.push(label);
        next[questionIndex] = list;
      } else {
        next[questionIndex] = list[0] === label ? [] : [label];
      }
      return next;
    });
  };

  const submit = () => {
    const final = answers.map((entry, index) => {
      const typed = custom[index]?.trim();
      return typed ? [...entry, typed] : entry;
    });
    if (final.some((entry) => entry.length === 0)) {
      setError(true);
      return;
    }
    post({ type: "replyQuestion", sessionId: request.sessionID, requestId: request.id, answers: final });
  };

  return (
    <div class="question">
      <div class="question-head">
        <span class="question-icon">
          <Icon name="message" size={16} />
        </span>
        <div class="question-title">{request.questions[0]?.header || t("question.title")}</div>
      </div>
      {request.questions.map((question, questionIndex) => (
        <div class="question-block" key={questionIndex}>
          <div class="question-text" dir="auto">{question.question}</div>
          <div class="question-options">
            {question.options.map((option) => {
              const selected = answers[questionIndex]?.includes(option.label);
              return (
                <button
                  type="button"
                  key={option.label}
                  class={`question-option ${selected ? "is-selected" : ""}`}
                  onClick={() => toggle(questionIndex, option.label, question.multiple)}
                >
                  <span class={`question-check ${question.multiple ? "is-check" : ""}`}>
                    {selected ? <Icon name="check" size={11} /> : null}
                  </span>
                  <span class="question-option-copy">
                    <span class="question-option-label">{option.label}</span>
                    {option.description ? <span class="question-option-desc">{option.description}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {question.custom ? (
            <input
              class="question-input"
              type="text"
              dir="auto"
              placeholder={t("question.other")}
              value={custom[questionIndex] || ""}
              onInput={(event) =>
                setCustom((current) => {
                  const next = [...current];
                  next[questionIndex] = (event.target as HTMLInputElement).value;
                  return next;
                })
              }
            />
          ) : null}
        </div>
      ))}
      <div class="question-actions">
        {error ? <span class="question-error">{t("question.required")}</span> : <span />}
        <button type="button" class="btn btn-quiet btn-sm" onClick={() => post({ type: "rejectQuestion", sessionId: request.sessionID, requestId: request.id })}>
          {t("question.skip")}
        </button>
        <button type="button" class="btn btn-primary btn-sm" onClick={submit}>
          {t("question.submit")}
        </button>
      </div>
    </div>
  );
}

export function TodoStrip() {
  const { state, t, view, post } = useApp();
  const [open, setOpen] = useState(false);
  const todos = state.todos;
  if (!todos.length) return null;

  const done = todos.filter((todo) => todo.status === "completed").length;
  const active = todos.find((todo) => todo.status === "in_progress") || todos.find((todo) => todo.status === "pending");
  const percent = Math.round((done / todos.length) * 100);
  const allDone = done === todos.length;

  return (
    <div class={`todos ${open ? "is-open" : ""} ${allDone ? "is-done" : ""}`}>
      {open ? (
        <div class="todos-panel">
          <div class="todos-panel-head">
            <span>
              <Icon name="list" size={14} /> {t("todo.title")}
            </span>
            <span class="todos-count">{t("todo.progress", { done, total: todos.length })}</span>
          </div>
          <ul>
            {todos.map((todo, index) => (
              <button
                type="button"
                key={index}
                class={`todos-item status-${todo.status}`}
                title={t("todo.toggleHint")}
                aria-pressed={todo.status === "completed"}
                onClick={() => post({ type: "toggleTodo", index })}
              >
                <span class="todos-status">
                  <Icon
                    name={todo.status === "completed" ? "check-circle" : todo.status === "in_progress" ? "clock" : "circle"}
                    size={15}
                  />
                </span>
                <span class="todos-text">{todo.content}</span>
                {todo.priority === "high" ? <span class="todos-prio">{todo.priority}</span> : null}
              </button>
            ))}
          </ul>
        </div>
      ) : null}
      <button type="button" class="todos-bar" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span class="todos-ring" style={{ "--percent": `${percent}%` } as any}>
          <span>{done}</span>
          <small>/{todos.length}</small>
        </span>
        <span class="todos-summary">
          <span class="todos-main">{allDone ? t("todo.progress", { done, total: todos.length }) : active?.content || t("todo.title")}</span>
          <span class="todos-track">
            <span class="todos-fill" style={{ width: `${percent}%` }} />
          </span>
        </span>
        {view === "sidebar" ? null : <span class="todos-hint">{t("todo.title")}</span>}
        <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
      </button>
    </div>
  );
}
