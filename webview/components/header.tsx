import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../context";
import { Icon, IconButton, Logo } from "./ui";

export function Header() {
  const { state, t, post, dispatch, view } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const phase = state.connection.phase;
  const connected = phase === "ready" || phase === "external";
  const model = state.models.find(
    (entry) => entry.id === state.selectedModel?.modelID && entry.providerID === state.selectedModel?.providerID,
  );
  const title = state.currentSession?.title || t("header.noSession");

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const toggleLanguage = () => {
    const next = state.ui.language === "ar" ? "en" : "ar";
    post({ type: "setUi", patch: { languageSetting: next, language: next } });
  };

  return (
    <header class="header">
      <div class="header-start">
        <span class="header-logo">
          <Logo size={27} />
        </span>
        <div class="header-titles">
          <div class="header-title" title={view === "panel" ? title : undefined}>
            {view === "panel" ? title : "OpenCode"}
            {view === "sidebar" ? <span class="brand-tag">RTL</span> : null}
          </div>
          <div class="header-sub">
            <span class={`conn-dot phase-${phase}`} />
            <span class="header-status">
              {phase === "ready" || phase === "external"
                ? `${t("header.connected")} · ${state.connection.managed ? t("header.managed") : t("header.external")}`
                : phase === "starting"
                  ? t("header.starting")
                  : t("header.disconnected")}
            </span>
            {state.workspaceName ? (
              <>
                <span class="header-sep">·</span>
                <span class="header-workspace" dir="auto">{state.workspaceName}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="chip chip-model"
          title={t("composer.model")}
          onClick={() => dispatch({ type: "local:picker", picker: "model" })}
        >
          <Icon name="sparkle" size={13} />
          <span class="chip-label" dir="ltr">{model?.name || t("picker.auto")}</span>
          <Icon name="chevron-down" size={11} />
        </button>

        <IconButton
          icon="swap"
          label={t("header.toggleDir")}
          size={17}
          className="header-icon"
          onClick={() => post({ type: "command", name: "toggleDirection" })}
        />
        <button type="button" class="lang-btn" onClick={toggleLanguage} title={t("header.toggleLang")} aria-label={t("header.toggleLang")}>
          {state.ui.language === "ar" ? "EN" : "ع"}
        </button>

        {view === "sidebar" ? (
          <IconButton
            icon="chat"
            label={t("header.sessions")}
            size={17}
            className="header-icon"
            onClick={() => dispatch({ type: "local:sessionsOpen", open: true })}
          />
        ) : null}

        <IconButton
          icon="plus"
          label={t("header.newChat")}
          size={18}
          className="header-icon header-new"
          onClick={() => post({ type: "newSession" })}
        />

        <IconButton
          icon="settings"
          label={t("header.settings")}
          size={17}
          className="header-icon header-settings"
          onClick={() => dispatch({ type: "local:settingsOpen", open: true })}
        />

        <div class="menu-wrap" ref={menuRef}>
          <IconButton
            icon="more"
            label={t("header.more")}
            size={18}
            className="header-icon"
            active={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          />
          {menuOpen ? (
            <div class="menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); post({ type: "command", name: "exportMarkdown" }); }}>
                <Icon name="download" size={15} /> {t("header.export")}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); post({ type: "command", name: "openDiff" }); }}>
                <Icon name="diff" size={15} /> {t("header.diff")}
              </button>
              {view === "sidebar" ? (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); post({ type: "command", name: "openPanel" }); }}>
                  <Icon name="panel" size={15} /> {t("header.openPanel")}
                </button>
              ) : (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); post({ type: "command", name: "openSidebar" }); }}>
                  <Icon name="message" size={15} /> {t("header.openSidebar")}
                </button>
              )}
              <div class="menu-sep" />
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); post({ type: "command", name: "restartServer" }); }}>
                <Icon name="refresh" size={15} /> {t("header.restart")}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); post({ type: "command", name: "openSettings" }); }}>
                <Icon name="sliders" size={15} /> {t("settings.openSettings")}
              </button>
              <div class="menu-meta">
                <span>OpenCode RTL</span>
                <span>v{state.version}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {connected ? null : <span class="header-stripe" />}
    </header>
  );
}
