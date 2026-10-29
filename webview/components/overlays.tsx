import { useEffect, useMemo, useState } from "preact/hooks";
import type { AgentInfo, ModelInfo } from "../../src/shared/types";
import { useApp } from "../context";
import { formatCost } from "../markdown";
import { renderDiff } from "../markdown";
import { Icon, IconButton, Modal, Segmented, Sheet, Spinner, Toggle } from "./ui";

export function SettingsSheet() {
  const { state, t, post, dispatch } = useApp();
  const ui = state.ui;
  const setUi = (patch: any) => post({ type: "setUi", patch });
  const close = () => dispatch({ type: "local:settingsOpen", open: false });
  const num = (value: number) => String(value);

  return (
    <Sheet open={state.settingsOpen} onClose={close} className="settings-sheet">
      <div class="sheet-head">
        <div class="sheet-title">
          <Icon name="settings" size={17} /> {t("settings.title")}
        </div>
        <button type="button" class="btn btn-soft btn-sm" onClick={close}>
          {t("settings.done")}
        </button>
      </div>

      <div class="settings-body">
        <section class="settings-section">
          <div class="settings-label">{t("settings.appearance")}</div>

          <div class="settings-row">
            <div class="settings-copy">
              <span>{t("settings.language")}</span>
            </div>
            <Segmented
              small
              value={ui.languageSetting}
              options={[
                { value: "auto", label: t("settings.languageAuto") },
                { value: "ar", label: t("settings.arabic") },
                { value: "en", label: t("settings.english") },
              ]}
              onChange={(value) => {
                if (value === "auto") setUi({ languageSetting: "auto" });
                else setUi({ languageSetting: value, language: value });
              }}
            />
          </div>

          <div class="settings-row">
            <div class="settings-copy">
              <span>{t("settings.direction")}</span>
            </div>
            <Segmented
              small
              value={ui.directionSetting}
              options={[
                { value: "auto", label: t("settings.auto") },
                { value: "rtl", label: "RTL" },
                { value: "ltr", label: "LTR" },
              ]}
              onChange={(value) => {
                if (value === "auto") setUi({ directionSetting: "auto" });
                else setUi({ directionSetting: value, direction: value });
              }}
            />
          </div>

          <div class="settings-row">
            <div class="settings-copy">
              <span>{t("settings.fontSize")}</span>
              <small>{num(ui.fontSize)}px</small>
            </div>
            <div class="stepper">
              <button type="button" aria-label="-" onClick={() => setUi({ fontSize: Math.max(11, ui.fontSize - 1) })}>
                −
              </button>
              <span>{ui.fontSize}</span>
              <button type="button" aria-label="+" onClick={() => setUi({ fontSize: Math.min(22, ui.fontSize + 1) })}>
                +
              </button>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-copy">
              <span>{t("settings.sendKey")}</span>
            </div>
            <Segmented
              small
              value={ui.sendKey}
              options={[
                { value: "enter", label: "Enter" },
                { value: "ctrlEnter", label: "⌘ ↵" },
              ]}
              onChange={(value) => setUi({ sendKey: value })}
            />
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-label">{t("settings.behavior")}</div>
          <div class="settings-row">
            <div class="settings-copy">
              <span>{t("settings.reasoning")}</span>
            </div>
            <Toggle checked={ui.showReasoning} label={t("settings.reasoning")} onChange={(value) => setUi({ showReasoning: value })} />
          </div>
          <div class="settings-row">
            <div class="settings-copy">
              <span>{t("settings.codeWrap")}</span>
            </div>
            <Toggle checked={ui.codeWrap} label={t("settings.codeWrap")} onChange={(value) => setUi({ codeWrap: value })} />
          </div>
          <div class="settings-row">
            <div class="settings-copy">
              <span>{t("settings.compact")}</span>
            </div>
            <Toggle checked={ui.compact} label={t("settings.compact")} onChange={(value) => setUi({ compact: value })} />
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-label">{t("settings.server")}</div>
          <div class="settings-server">
            <div class="settings-server-row">
              <span class={`conn-dot phase-${state.connection.phase}`} />
              <span class="settings-server-state">
                {state.connection.phase === "ready" || state.connection.phase === "external"
                  ? t("header.connected")
                  : state.connection.phase === "starting"
                    ? t("header.starting")
                    : t("header.disconnected")}
              </span>
              {state.connection.version ? <span class="settings-version">v{state.connection.version}</span> : null}
            </div>
            <div class="settings-kv" dir="ltr">
              <span>{state.connection.url || "—"}</span>
            </div>
            {state.connection.executable ? (
              <div class="settings-kv settings-kv-muted" dir="ltr">
                {state.connection.executable}
              </div>
            ) : null}
            {state.connection.error ? (
              <div class="settings-error" dir="auto">{state.connection.error}</div>
            ) : null}
            <div class="settings-server-actions">
              <button type="button" class="btn btn-soft btn-sm" onClick={() => post({ type: "command", name: "restartServer" })}>
                <Icon name="refresh" size={14} /> {t("settings.restartServer")}
              </button>
              <button type="button" class="btn btn-quiet btn-sm" onClick={() => post({ type: "command", name: "openSettings" })}>
                {t("settings.openSettings")}
              </button>
            </div>
          </div>
        </section>

        <section class="settings-section">
          <div class="settings-label">{t("settings.about")}</div>
          <p class="settings-about">{t("settings.aboutBody")}</p>
          <div class="settings-about-foot">
            <span>OpenCode RTL · v{state.version}</span>
            <button type="button" class="link-btn" onClick={() => post({ type: "openUrl", url: "https://opencode.ai" })}>
              opencode.ai <Icon name="external" size={11} />
            </button>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

export function PickerModal() {
  const { state, t, post, dispatch } = useApp();
  const [query, setQuery] = useState("");
  const kind = state.picker;

  useEffect(() => {
    setQuery("");
  }, [kind]);

  const close = () => dispatch({ type: "local:picker", picker: null });

  const modelGroups = useMemo(() => {
    if (kind !== "model") return [];
    const search = query.trim().toLowerCase();
    const filtered = state.models.filter(
      (model) =>
        !search ||
        model.name.toLowerCase().includes(search) ||
        model.providerName.toLowerCase().includes(search) ||
        model.id.toLowerCase().includes(search),
    );
    const groups = new Map<string, ModelInfo[]>();
    for (const model of filtered) {
      const list = groups.get(model.providerName) || [];
      list.push(model);
      groups.set(model.providerName, list);
    }
    return [...groups.entries()];
  }, [kind, state.models, query]);

  const agentList = useMemo(() => {
    if (kind !== "agent") return [];
    const search = query.trim().toLowerCase();
    return state.agents.filter(
      (agent) => !search || agent.name.toLowerCase().includes(search) || (agent.description || "").toLowerCase().includes(search),
    );
  }, [kind, state.agents, query]);

  const chooseModel = (model: ModelInfo) => {
    post({ type: "selectModel", providerID: model.providerID, modelID: model.id });
    close();
  };

  const chooseAgent = (agent: AgentInfo) => {
    post({ type: "selectAgent", agent: agent.name });
    close();
  };

  return (
    <Modal open={kind !== null} onClose={close} className="picker">
      <div class="picker-head">
        <div class="picker-title">
          <Icon name={kind === "agent" ? "wrench" : "sparkle"} size={17} />
          {kind === "agent" ? t("picker.agents") : t("picker.models")}
        </div>
        <IconButton icon="x" label={t("common.close")} size={16} onClick={close} />
      </div>
      <label class="picker-search">
        <Icon name="search" size={15} />
        <input
          autoFocus
          type="search"
          value={query}
          placeholder={t("picker.search")}
          onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
        />
      </label>

      <div class="picker-list">
        {kind === "model" ? (
          modelGroups.length ? (
            modelGroups.map(([provider, models]) => (
              <div class="picker-group" key={provider}>
                <div class="picker-group-head">{provider}</div>
                {models.map((model) => {
                  const selected = state.selectedModel?.modelID === model.id && state.selectedModel?.providerID === model.providerID;
                  return (
                    <button
                      type="button"
                      key={`${model.providerID}/${model.id}`}
                      class={`picker-item ${selected ? "is-selected" : ""}`}
                      onClick={() => chooseModel(model)}
                    >
                      <span class="picker-item-main">
                        <span class="picker-item-name">{model.name}</span>
                        <span class="picker-item-id">{model.id}</span>
                        <span class="picker-item-meta">
                          {model.context ? <span class="tag">{t("picker.context", { value: `${Math.round(model.context / 1000)}k` })}</span> : null}
                          {model.reasoning ? <span class="tag tag-soft">reasoning</span> : null}
                          {model.cost?.input ? <span class="tag tag-soft">{formatCost(model.cost.input)}/M</span> : null}
                        </span>
                      </span>
                      {selected ? <Icon name="check" size={15} className="picker-check" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div class="picker-empty">{t("picker.empty")}</div>
          )
        ) : agentList.length ? (
          agentList.map((agent) => {
            const selected = state.selectedAgent === agent.name;
            return (
              <button
                type="button"
                key={agent.name}
                class={`picker-item ${selected ? "is-selected" : ""}`}
                onClick={() => chooseAgent(agent)}
              >
                <span class="picker-item-main">
                  <span class="picker-item-name">{agent.name}</span>
                  <span class="picker-item-desc">{agent.description}</span>
                  <span class="picker-item-meta">
                    {agent.mode ? <span class="tag tag-soft">{agent.mode}</span> : null}
                  </span>
                </span>
                {selected ? <Icon name="check" size={15} className="picker-check" /> : null}
              </button>
            );
          })
        ) : (
          <div class="picker-empty">{t("picker.empty")}</div>
        )}
      </div>
      <div class="picker-foot">
        <span>{state.models.length} models</span>
        <span>{state.agents.length} agents</span>
      </div>
    </Modal>
  );
}

export function DiffSheet() {
  const { state, t, post, dispatch } = useApp();
  const close = () => dispatch({ type: "local:diffOpen", open: false });
  const [openFile, setOpenFile] = useState<string | null>(null);
  const totalAdd = state.diffFiles.reduce((sum, file) => sum + (file.additions || 0), 0);
  const totalDel = state.diffFiles.reduce((sum, file) => sum + (file.deletions || 0), 0);

  return (
    <Sheet open={state.diffOpen} onClose={close} className="diff-sheet">
      <div class="sheet-head">
        <div class="sheet-title">
          <Icon name="diff" size={17} /> {t("diff.title")}
        </div>
        <div class="sheet-head-actions">
          <span class="diff-count">{t("diff.files", { count: state.diffFiles.length })}</span>
          <IconButton
            icon="refresh"
            label={t("header.restart")}
            size={15}
            onClick={() => state.currentSession && post({ type: "getDiff", sessionId: state.currentSession.id })}
          />
          <IconButton icon="x" label={t("common.close")} size={16} onClick={close} />
        </div>
      </div>
      <div class="diff-summary">
        <span class="diff-add">+{totalAdd}</span>
        <span class="diff-del">−{totalDel}</span>
      </div>
      <div class="diff-body">
        {state.diffFiles.length === 0 ? (
          <div class="diff-empty">{t("diff.empty")}</div>
        ) : (
          state.diffFiles.map((file) => {
            const expanded = openFile === file.file;
            return (
              <div class={`diff-file ${expanded ? "is-open" : ""}`} key={file.file}>
                <div class="diff-file-head">
                  <button
                    type="button"
                    class="diff-file-toggle"
                    aria-expanded={expanded}
                    onClick={() => setOpenFile(expanded ? null : file.file)}
                  >
                    <Icon
                      name={expanded ? "chevron-down" : "chevron-right"}
                      size={13}
                      className="diff-file-chevron"
                    />
                    <span class="diff-file-name"><bdi dir="ltr">{file.file}</bdi></span>
                    <span class="diff-file-stats">
                      {file.additions ? <span class="diff-add">+{file.additions}</span> : null}
                      {file.deletions ? <span class="diff-del">−{file.deletions}</span> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="diff-file-open"
                    title={t("diff.open")}
                    aria-label={`${t("diff.open")}: ${file.file}`}
                    onClick={() => post({ type: "openFile", path: file.file })}
                  >
                    <Icon name="external" size={13} />
                  </button>
                </div>
                {expanded && file.patch ? (
                  <div dangerouslySetInnerHTML={{ __html: renderDiff(file.patch) }} />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}

export function Toasts() {
  const { state, dispatch } = useApp();
  return (
    <div class="toasts" aria-live="polite">
      {state.toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} kind={toast.kind} message={toast.message} />
      ))}
    </div>
  );
}

function ToastItem({ id, kind, message }: { id: number; kind: "info" | "success" | "warn" | "error"; message: string }) {
  const { dispatch } = useApp();
  useEffect(() => {
    const timer = window.setTimeout(() => dispatch({ type: "local:dismissToast", id }), 4200);
    return () => window.clearTimeout(timer);
  }, [id, dispatch]);

  const icon = kind === "success" ? "check-circle" : kind === "error" ? "alert" : kind === "warn" ? "alert" : "message";

  return (
    <div class={`toast toast-${kind}`}>
      <Icon name={icon} size={15} />
      <span dir="auto">{message}</span>
      <button type="button" aria-label="close" onClick={() => dispatch({ type: "local:dismissToast", id })}>
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

export function BootSpinner() {
  return (
    <div class="boot">
      <Spinner size={22} />
    </div>
  );
}
