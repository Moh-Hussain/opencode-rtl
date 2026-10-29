import { useCallback, useEffect, useMemo, useReducer } from "preact/hooks";
import type { ClientMessage } from "../../src/shared/protocol";
import { AppContext, type AppContextValue } from "../context";
import { createTranslator } from "../i18n";
import type { BridgeApi } from "../bridge";
import { currentDirection, initialState, language, reduce } from "../store";
import { Composer } from "./composer";
import { Header } from "./header";
import { DiffSheet, PickerModal, SettingsSheet, Toasts } from "./overlays";
import { PermissionCard, QuestionCard, TodoStrip } from "./panels";
import { SessionRail, SessionsSheet } from "./rail";
import { Transcript } from "./transcript";

export function App({ bridge, view }: { bridge: BridgeApi; view: "sidebar" | "panel" }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const t = useMemo(() => createTranslator(language(state)), [state.ui.language]);
  const post = useCallback((message: ClientMessage) => bridge.post(message), [bridge]);

  useEffect(() => {
    const unsubscribe = bridge.subscribe((message) => dispatch({ type: "host", message }));
    post({ type: "ready" });
    dispatch({ type: "local:ready" });
    return unsubscribe;
  }, [bridge, post]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("dir", currentDirection(state));
    root.setAttribute("lang", language(state));
    root.style.setProperty("--app-font-size", `${state.ui.fontSize}px`);
    document.body.dataset.view = view;
    document.body.classList.toggle("is-compact", state.ui.compact);
    document.body.classList.toggle("wrap-code", state.ui.codeWrap);
  }, [state.ui, view]);

  useEffect(() => {
    document.title = state.currentSession?.title ? `${state.currentSession.title} — OpenCode RTL` : "OpenCode RTL";
  }, [state.currentSession?.title]);

  const value = useMemo<AppContextValue>(
    () => ({ state, dispatch, t, post, view }),
    [state, t, post, view],
  );

  const dockCards = (
    <div class="dock-stack">
      {state.permissions.map((request) => (
        <PermissionCard key={request.id} request={request} />
      ))}
      {state.questions.map((request) => (
        <QuestionCard key={request.id} request={request} />
      ))}
    </div>
  );

  return (
    <AppContext.Provider value={value}>
      <div class={`app app-${view} ${state.ui.compact ? "is-compact" : ""}`}>
        {view === "panel" ? <SessionRail /> : null}
        <div class="app-main">
          <Header />
          <div class="app-body">
            <Transcript />
          </div>
          <div class="dock">
            {dockCards}
            <TodoStrip />
            <Composer />
          </div>
        </div>
      </div>

      <SessionsSheet />
      <SettingsSheet />
      <PickerModal />
      <DiffSheet />
      <Toasts />
    </AppContext.Provider>
  );
}
