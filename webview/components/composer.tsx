import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useApp } from "../context";
import { AttachmentChip } from "./attachments";
import { Icon, IconButton, Spinner, type IconName } from "./ui";

const SLASH: Array<{ command: string; icon: IconName; title: string; description: string }> = [
  { command: "new", icon: "plus", title: "slash.new", description: "slash.newDesc" },
  { command: "clear", icon: "x", title: "slash.clear", description: "slash.clearDesc" },
  { command: "export", icon: "download", title: "slash.export", description: "slash.exportDesc" },
  { command: "model", icon: "sparkle", title: "slash.model", description: "slash.modelDesc" },
  { command: "agent", icon: "wrench", title: "slash.agent", description: "slash.agentDesc" },
  { command: "rtl", icon: "swap", title: "slash.rtl", description: "slash.rtlDesc" },
  { command: "settings", icon: "settings", title: "slash.settings", description: "slash.settingsDesc" },
];

export function Composer() {
  const { state, t, dispatch, post, view } = useApp();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const busy = state.status.type === "busy" || state.status.type === "retry";
  const connected = state.connection.phase === "ready" || state.connection.phase === "external";
  const text = state.composerText;
  const canSend = Boolean(text.trim() || state.attachments.length);
  const model = state.models.find(
    (entry) => entry.id === state.selectedModel?.modelID && entry.providerID === state.selectedModel?.providerID,
  );

  const slashQuery = text.startsWith("/") && !text.includes(" ") ? text.slice(1).toLowerCase() : null;
  const slashMatches = useMemo(
    () => (slashQuery === null ? [] : SLASH.filter((entry) => entry.command.startsWith(slashQuery))),
    [slashQuery],
  );

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (state.focusToken > 0) {
      const element = textarea.current;
      element?.focus();
      element?.setSelectionRange(element.value.length, element.value.length);
    }
  }, [state.focusToken]);

  useEffect(() => {
    if (!state.sessionsOpen && !state.settingsOpen && !state.picker) setAttachOpen(false);
  }, [state.sessionsOpen, state.settingsOpen, state.picker]);

  const addFiles = (incoming: File[]) => {
    const maxSize = 20 * 1024 * 1024;
    const files = incoming.filter((file) => file.size > 0).slice(0, 12);
    if (!files.length) return;
    const oversized = files.find((file) => file.size > maxSize);
    if (oversized) {
      post({ type: "showToast", kind: "warn", message: t("composer.attachTooLarge", { name: oversized.name }) });
    }
    const accepted = files.filter((file) => file.size <= maxSize);
    if (!accepted.length) return;
    void Promise.all(
      accepted.map(
        (file) =>
          new Promise<{ name: string; mime: string; data: string } | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = typeof reader.result === "string" ? reader.result : "";
              const comma = result.indexOf(",");
              if (comma < 0) return resolve(null);
              resolve({
                name: file.name || `pasted-${Date.now()}`,
                mime: file.type || "application/octet-stream",
                data: result.slice(comma + 1),
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((items) => {
      const payload = items.filter(Boolean) as Array<{ name: string; mime: string; data: string }>;
      if (payload.length) post({ type: "attachData", files: payload });
    });
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      if (!data?.types?.includes("Files")) return;
      const files = Array.from(data.files || []);
      if (!files.length) {
        for (const item of Array.from(data.items || [])) {
          if (item.kind !== "file") continue;
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [post, t]);

  const execute = (command: string) => {
    dispatch({ type: "local:composer", text: "" });
    switch (command) {
      case "new":
        post({ type: "newSession" });
        break;
      case "clear":
        dispatch({ type: "local:clearComposer" });
        break;
      case "export":
        post({ type: "command", name: "exportMarkdown" });
        break;
      case "model":
        dispatch({ type: "local:picker", picker: "model" });
        break;
      case "agent":
        dispatch({ type: "local:picker", picker: "agent" });
        break;
      case "rtl":
        post({ type: "command", name: "toggleDirection" });
        break;
      case "settings":
        dispatch({ type: "local:settingsOpen", open: true });
        break;
      default:
        break;
    }
  };

  const trySlash = (value: string): boolean => {
    if (!value.startsWith("/")) return false;
    const [command, ...rest] = value.slice(1).trim().split(/\s+/);
    if (rest.length) return false;
    const match = SLASH.find((entry) => entry.command === command.toLowerCase());
    if (!match) return false;
    execute(match.command);
    return true;
  };

  const send = () => {
    if (busy) return;
    const value = text.trim();
    if (!value && !state.attachments.length) return;
    if (trySlash(value)) return;
    if (!connected) {
      post({ type: "showToast", kind: "warn", message: t("error.connection") });
      return;
    }
    const attachments = state.attachments;
    dispatch({ type: "local:submit" });
    post({ type: "submit", text: value, attachments });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setAttachOpen(false);
      return;
    }
    if (event.key !== "Enter") return;
    if ((event as any).isComposing) return;
    const withModifier = event.metaKey || event.ctrlKey;
    const wantsSend = state.ui.sendKey === "ctrlEnter" ? withModifier : !event.shiftKey && !withModifier;
    if (wantsSend) {
      if (slashMatches.length && (slashQuery === "" || slashQuery !== null)) {
        const exact = slashMatches.find((entry) => entry.command === slashQuery);
        if (exact || slashQuery === "") {
          event.preventDefault();
          execute((exact || slashMatches[0]).command);
          return;
        }
      }
      event.preventDefault();
      send();
    }
  };

  return (
    <div
      class={`composer-dock ${busy ? "is-busy" : ""} ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer?.types || []).includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        addFiles(Array.from(event.dataTransfer?.files || []));
      }}
    >
      {dragging ? (
        <div class="composer-drop">
          <Icon name="clip" size={16} />
          <span>{t("composer.dropHint")}</span>
        </div>
      ) : null}
      <div class="composer-shell">
        {slashQuery !== null ? (
          <div class="slash-menu" role="listbox" aria-label={t("slash.title")}>
            <div class="slash-head">{t("slash.title")}</div>
            {slashMatches.length ? (
              slashMatches.map((entry) => (
                <button
                  type="button"
                  key={entry.command}
                  class="slash-item"
                  role="option"
                  onClick={() => execute(entry.command)}
                >
                  <span class="slash-icon">
                    <Icon name={entry.icon} size={15} />
                  </span>
                  <span class="slash-copy">
                    <span class="slash-title">
                      /{entry.command} <span>{t(entry.title)}</span>
                    </span>
                    <span class="slash-desc">{t(entry.description)}</span>
                  </span>
                </button>
              ))
            ) : (
              <div class="slash-empty">{t("slash.empty")}</div>
            )}
          </div>
        ) : null}

        {state.attachments.length ? (
          <div class="composer-attachments">
            {state.attachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                onRemove={(id) => dispatch({ type: "local:removeAttachment", id })}
              />
            ))}
          </div>
        ) : null}

        <div class="composer">
          <textarea
            ref={textarea}
            class="composer-input"
            dir="auto"
            rows={1}
            value={text}
            placeholder={busy ? t("composer.placeholderBusy") : t("composer.placeholder")}
            aria-label={t("composer.placeholder")}
            onInput={(event) => dispatch({ type: "local:composer", text: (event.target as HTMLTextAreaElement).value })}
            onKeyDown={onKeyDown}
          />

          <div class="composer-bar">
            <div class="composer-tools">
              <div class="attach-wrap">
                <IconButton
                  icon="clip"
                  label={t("composer.attachHint")}
                  size={17}
                  active={attachOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setAttachOpen((value) => !value);
                  }}
                />
                {attachOpen ? (
                  <>
                    <div class="attach-scrim" onClick={() => setAttachOpen(false)} />
                    <div class="attach-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setAttachOpen(false);
                          post({ type: "pickFiles", kind: "file" });
                        }}
                      >
                        <Icon name="file" size={15} /> {t("composer.attachFile")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachOpen(false);
                          post({ type: "pickFiles", kind: "image" });
                        }}
                      >
                        <Icon name="image" size={15} /> {t("composer.attachImage")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachOpen(false);
                          post({ type: "attachSelection" });
                        }}
                      >
                        <Icon name="code" size={15} /> {t("composer.attachSelection")}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              <button
                type="button"
                class="mini-chip"
                title={t("composer.model")}
                onClick={() => dispatch({ type: "local:picker", picker: "model" })}
              >
                <Icon name="sparkle" size={13} />
                <span class="mini-label" dir="ltr">{model?.name || t("picker.auto")}</span>
                <Icon name="chevron-down" size={11} />
              </button>

              {view !== "sidebar" || state.agents.length > 1 ? (
                <button
                  type="button"
                  class="mini-chip mini-agent"
                  title={t("composer.agent")}
                  onClick={() => dispatch({ type: "local:picker", picker: "agent" })}
                >
                  <Icon name="wrench" size={12} />
                  <span class="mini-label" dir="ltr">{state.selectedAgent || t("picker.auto")}</span>
                </button>
              ) : null}
            </div>

            <div class="composer-send">
              <span class="send-hint">
                <Icon name="keyboard" size={12} />
                {state.ui.sendKey === "enter" ? "Enter" : "⌘ ↵"}
              </span>
              {busy ? (
                <button
                  type="button"
                  class="send-btn send-stop"
                  aria-label={t("composer.stop")}
                  title={t("composer.stop")}
                  onClick={() => state.currentSession && post({ type: "abort", sessionId: state.currentSession.id })}
                >
                  <Icon name="stop" size={16} />
                  <span class="send-label">{t("composer.stop")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  class="send-btn"
                  aria-label={t("composer.send")}
                  title={t("composer.send")}
                  disabled={!canSend || !connected}
                  onClick={send}
                >
                  <Icon name={state.ui.direction === "rtl" ? "arrow-up" : "arrow-up"} size={17} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div class="composer-foot">
          <span class="foot-hint">
            {busy ? (
              <>
                <Spinner size={11} /> {t("composer.placeholderBusy")}
              </>
            ) : connected ? (
              state.ui.sendKey === "enter" ? t("composer.hintEnter") : t("composer.hintCtrlEnter")
            ) : (
              t("composer.disconnected")
            )}
          </span>
          <span class={`foot-dot ${connected ? "is-on" : ""}`} title={connected ? t("header.connected") : t("header.disconnected")} />
        </div>
      </div>
    </div>
  );
}
