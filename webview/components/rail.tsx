import { useMemo, useState } from "preact/hooks";
import type { SessionSummary } from "../../src/shared/types";
import { useApp } from "../context";
import { relativeTime, sessionGroup } from "../format";
import { formatTokens } from "../markdown";
import { Icon, IconButton, Logo, Modal, Sheet } from "./ui";

const GROUP_ORDER: Array<{ key: "today" | "yesterday" | "week" | "older"; label: string }> = [
  { key: "today", label: "sessions.today" },
  { key: "yesterday", label: "sessions.yesterday" },
  { key: "week", label: "sessions.week" },
  { key: "older", label: "sessions.older" },
];

export function SessionRail() {
  const { state, t, post, dispatch } = useApp();

  return (
    <aside class="rail">
      <div class="rail-brand">
        <Logo size={30} />
        <div class="rail-brand-copy">
          <span class="rail-brand-name">OpenCode <em>RTL</em></span>
          <span class="rail-brand-tag">{t("app.subtitle")}</span>
        </div>
      </div>

      <button type="button" class="rail-new" onClick={() => post({ type: "newSession" })}>
        <Icon name="plus" size={16} />
        <span>{t("sessions.new")}</span>
        <span class="rail-new-keys">
          <kbd>⌘</kbd>
          <kbd>⌥</kbd>
          <kbd>N</kbd>
        </span>
      </button>

      <SessionList />

      <div class="rail-foot">
        <button
          type="button"
          class="server-card"
          onClick={() => dispatch({ type: "local:settingsOpen", open: true })}
        >
          <span class={`conn-dot phase-${state.connection.phase}`} />
          <span class="server-copy">
            <span class="server-title">
              {state.connection.phase === "ready" || state.connection.phase === "external"
                ? state.connection.managed
                  ? t("header.managed")
                  : t("header.external")
                : state.connection.phase === "starting"
                  ? t("header.starting")
                  : t("header.disconnected")}
            </span>
            <span class="server-url"><bdi dir="ltr">{state.connection.url || "—"}</bdi></span>
          </span>
          <Icon name="settings" size={15} />
        </button>
        <div class="rail-foot-row">
          <span>v{state.version}</span>
          <button type="button" onClick={() => post({ type: "command", name: "openSettings" })}>
            {t("settings.openSettings")}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function SessionList({ onSelect, compact }: { onSelect?: () => void; compact?: boolean }) {
  const { state, t, post } = useApp();
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<SessionSummary | null>(null);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query ? state.sessions.filter((entry) => entry.title.toLowerCase().includes(query)) : state.sessions;
    const buckets: Record<string, SessionSummary[]> = { today: [], yesterday: [], week: [], older: [] };
    for (const session of filtered) buckets[sessionGroup(session.updated)].push(session);
    return GROUP_ORDER.map((group) => ({ ...group, sessions: buckets[group.key] })).filter((group) => group.sessions.length);
  }, [state.sessions, search]);

  const choose = (id: string) => {
    post({ type: "selectSession", id });
    onSelect?.();
  };

  return (
    <div class={`session-list ${compact ? "is-compact" : ""}`}>
      <label class="rail-search">
        <Icon name="search" size={14} />
        <input
          type="search"
          value={search}
          placeholder={t("sessions.search")}
          aria-label={t("sessions.search")}
          onInput={(event) => setSearch((event.target as HTMLInputElement).value)}
        />
      </label>

      <div class="rail-scroll">
        {groups.length === 0 ? (
          <div class="rail-empty">{search ? t("sessions.emptySearch") : t("sessions.empty")}</div>
        ) : (
          groups.map((group) => (
            <div class="session-group" key={group.key}>
              <div class="session-group-head">{t(group.label)}</div>
              {group.sessions.map((session) => (
                <div
                  key={session.id}
                  class={`session-item ${state.currentSession?.id === session.id ? "is-active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => choose(session.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      choose(session.id);
                    }
                  }}
                >
                  <div class="session-copy">
                    <div class="session-title" dir="auto">{session.title}</div>
                    <div class="session-meta">
                      {relativeTime(session.updated, t, state.ui.language)}
                      {session.tokens ? <span> · {formatTokens(session.tokens)} {t("header.tokens")}</span> : null}
                    </div>
                  </div>
                  <div class="session-actions">
                    <IconButton
                      icon="fork"
                      label={t("sessions.fork")}
                      size={14}
                      onClick={(event) => {
                        event.stopPropagation();
                        post({ type: "forkSession", id: session.id });
                      }}
                    />
                    <IconButton
                      icon="trash"
                      label={t("sessions.delete")}
                      size={14}
                      className="session-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirm(session);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} className="confirm">
        <div class="confirm-head">
          <span class="confirm-icon">
            <Icon name="trash" size={17} />
          </span>
          <div>
            <div class="confirm-title">{t("sessions.deleteConfirm")}</div>
            <div class="confirm-text">{confirm?.title}</div>
          </div>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn btn-quiet" onClick={() => setConfirm(null)}>
            {t("sessions.cancel")}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick={() => {
              if (confirm) post({ type: "deleteSession", id: confirm.id });
              setConfirm(null);
            }}
          >
            {t("sessions.deleteYes")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export function SessionsSheet() {
  const { state, t, post, dispatch } = useApp();
  return (
    <Sheet
      open={state.sessionsOpen}
      onClose={() => dispatch({ type: "local:sessionsOpen", open: false })}
      className="sessions-sheet"
      from="start"
    >
      <div class="sheet-head">
        <div class="sheet-title">
          <Icon name="chat" size={17} /> {t("sessions.title")}
        </div>
        <div class="sheet-head-actions">
          <IconButton
            icon="plus"
            label={t("sessions.new")}
            size={16}
            onClick={() => {
              post({ type: "newSession" });
              dispatch({ type: "local:sessionsOpen", open: false });
            }}
          />
          <IconButton
            icon="x"
            label={t("common.close")}
            size={16}
            onClick={() => dispatch({ type: "local:sessionsOpen", open: false })}
          />
        </div>
      </div>
      <SessionList compact onSelect={() => dispatch({ type: "local:sessionsOpen", open: false })} />
    </Sheet>
  );
}
