import * as vscode from "vscode";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { access } from "node:fs/promises";
import type { HostMessage, ClientMessage, OpencodeEvent, SelectionPayload } from "../shared/protocol";
import type {
  AgentInfo,
  Attachment,
  Bootstrap,
  ChatMessage,
  ChatPart,
  ConnectionState,
  Direction,
  Language,
  ModelInfo,
  PermissionRequest,
  QuestionRequest,
  SessionDiffFile,
  SessionStatus,
  SessionSummary,
  TodoItem,
  UiPrefs,
} from "../shared/types";
import { OpencodeApi, toSessionSummary, type ProviderInfo, type PromptInput } from "./api";
import { ServerManager, probeServer, resolveExecutable } from "./server";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".py": "text/x-python",
  ".go": "text/x-go",
  ".rs": "text/x-rust",
  ".java": "text/x-java",
  ".php": "text/x-php",
  ".rb": "text/x-ruby",
  ".sh": "text/x-sh",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const EXT_FOR_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/json": ".json",
};

function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function safeFileName(name: string, mime: string): string {
  const base = path.basename((name || "").replace(/\\/g, "/")).replace(/[^\w.\-() \u0600-\u06FF]/g, "_").trim();
  const cleaned = base.slice(0, 100) || `paste-${Date.now()}`;
  if (path.extname(cleaned)) return cleaned;
  return `${cleaned}${EXT_FOR_MIME[mime] || ""}`;
}

function messageText(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface HubDeps {
  context: vscode.ExtensionContext;
  output: vscode.OutputChannel;
}

export class ChatHub implements vscode.Disposable {
  private readonly api = new AbortController();
  private server: ServerManager;
  private client?: OpencodeApi;
  private connection: ConnectionState = { phase: "idle" };
  private sessions: SessionSummary[] = [];
  private current: SessionSummary | null = null;
  private messages: ChatMessage[] = [];
  private todos: TodoItem[] = [];
  private permissions: PermissionRequest[] = [];
  private questions: QuestionRequest[] = [];
  private status: SessionStatus = { type: "idle" };
  private models: ModelInfo[] = [];
  private agents: AgentInfo[] = [];
  private selectedModel?: { providerID: string; modelID: string };
  private selectedAgent?: string;
  private initialized = false;
  private initializing?: Promise<void>;
  private disposed = false;
  private listeners = new Set<(message: HostMessage) => void>();
  private eventController?: AbortController;
  private refreshTimer?: NodeJS.Timeout;
  private draft?: { id: string; text?: string; attachments?: Attachment[]; focus?: boolean; sessionId?: string };
  private draftTimer?: NodeJS.Timeout;
  private suppressAutoComplete = false;
  private turnActive = false;
  private readonly stateEmitter = new vscode.EventEmitter<void>();
  private readonly openEmitter = new vscode.EventEmitter<"sidebar" | "panel">();
  private readonly changeSets = new Map<string, SessionDiffFile[]>();

  readonly onDidChangeState = this.stateEmitter.event;
  readonly onDidRequestOpen = this.openEmitter.event;

  constructor(private readonly deps: HubDeps) {
    this.server = new ServerManager(deps.output, this.serverPassword());
  }

  private config() {
    return vscode.workspace.getConfiguration("opencodeRtl");
  }

  private serverPassword(): string | undefined {
    return this.config().get<string>("serverPassword") || process.env.OPENCODE_SERVER_PASSWORD || undefined;
  }

  private get workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  get connectionState(): ConnectionState {
    return this.connection;
  }

  get currentSession(): SessionSummary | null {
    return this.current;
  }

  get selectedModelLabel(): string {
    if (!this.selectedModel) return "Auto";
    const model = this.models.find(
      (entry) => entry.id === this.selectedModel?.modelID && entry.providerID === this.selectedModel?.providerID,
    );
    return model?.name || `${this.selectedModel.providerID}/${this.selectedModel.modelID}`;
  }

  get busy(): boolean {
    return this.status.type === "busy" || this.status.type === "retry";
  }

  private output(line: string) {
    this.deps.output.appendLine(line);
  }

  // ---------------------------------------------------------------------
  // Webview plumbing
  // ---------------------------------------------------------------------

  register(listener: (message: HostMessage) => void): vscode.Disposable {
    this.listeners.add(listener);
    listener({ type: "init", payload: this.snapshot() });
    if (this.draft) listener({ type: "draft", payload: this.draft });
    return new vscode.Disposable(() => this.listeners.delete(listener));
  }

  broadcastAll(message: HostMessage) {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        this.output(`[hub] listener failed: ${messageText(error)}`);
      }
    }
  }

  private changed() {
    this.stateEmitter.fire();
  }

  private broadcast(message: HostMessage) {
    this.broadcastAll(message);
  }

  async handleClientMessage(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.broadcast({ type: "init", payload: this.snapshot() });
        if (this.draft) this.broadcast({ type: "draft", payload: this.draft });
        if (!this.initialized) void this.initialize();
        break;
      case "retryConnection":
        await this.initialize(true);
        break;
      case "submit":
        await this.submit(message.text, message.attachments || []);
        break;
      case "abort":
        await this.abort();
        break;
      case "newSession":
        await this.newSession(message.title);
        break;
      case "selectSession":
        await this.selectSession(message.id);
        break;
      case "deleteSession":
        await this.deleteSession(message.id);
        break;
      case "forkSession":
        await this.forkSession(message.id);
        break;
      case "refreshSessions":
        await this.refreshSessions(true);
        break;
      case "replyPermission":
        await this.replyPermission(message.requestId, message.reply, message.message);
        break;
      case "replyQuestion":
        await this.replyQuestion(message.requestId, message.answers);
        break;
      case "rejectQuestion":
        await this.rejectQuestion(message.requestId);
        break;
      case "setUi":
        await this.setUi(message.patch);
        break;
      case "selectModel":
        await this.setModel({ providerID: message.providerID, modelID: message.modelID });
        break;
      case "selectAgent":
        await this.setAgent(message.agent);
        break;
      case "command":
        await this.runCommand(message.name, message.args || {});
        break;
      case "insertText":
        await this.insertText(message.text);
        break;
      case "copyText":
        await vscode.env.clipboard.writeText(message.text);
        break;
      case "openFile":
        await this.openFile(message.path, message.line, message.endLine);
        break;
      case "openUrl": {
        const url = message.url.trim();
        let protocol = "";
        try {
          protocol = new URL(url).protocol;
        } catch {
          break;
        }
        if (protocol === "http:" || protocol === "https:" || protocol === "mailto:") {
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
      }
      case "pickFiles":
        await this.pickFiles(message.kind);
        break;
      case "attachData":
        await this.attachData(message.files);
        break;
      case "toggleTodo":
        this.toggleTodo(message.index);
        break;
      case "attachSelection":
        await this.attachSelection(false);
        break;
      case "attachActiveFile":
        await this.attachActiveFile();
        break;
      case "getDiff":
        this.changeSets.set(message.sessionId, await this.requireApi().diff(message.sessionId));
        this.broadcast({ type: "diff", payload: { sessionId: message.sessionId, files: this.changeSets.get(message.sessionId)! } });
        break;
      case "log":
        this.output(`[webview:${message.level}] ${message.message}`);
        break;
      case "showToast":
        this.broadcast({ type: "toast", payload: { kind: message.kind, message: message.message } });
        break;
      default:
        this.output(`[hub] unhandled client message ${(message as { type: string }).type}`);
    }
  }

  snapshot(): Bootstrap {
    return {
      connection: this.connection,
      ui: this.resolveUi(),
      models: this.models,
      agents: this.agents,
      sessions: this.sessions,
      currentSession: this.current,
      messages: this.messages,
      todos: this.todos,
      permissions: this.permissions.filter((entry) => !this.current || entry.sessionID === this.current.id),
      questions: this.questions.filter((entry) => !this.current || entry.sessionID === this.current.id),
      selectedModel: this.selectedModel,
      selectedAgent: this.selectedAgent,
      status: this.status,
      workspaceName: this.workspaceRoot ? path.basename(this.workspaceRoot) : "No folder",
      hasWorkspace: Boolean(this.workspaceRoot),
      version: this.deps.context.extension.packageJSON.version || "0.1.0",
    };
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  async initialize(force = false): Promise<void> {
    if (this.disposed) return;
    if (this.initializing) return this.initializing;
    if (this.initialized && !force) return;
    this.initialized = true;

    this.initializing = (async () => {
      this.eventController?.abort();
      if (force) {
        this.server.dispose();
        this.server = new ServerManager(this.deps.output, this.serverPassword());
        this.client = undefined;
      }

      this.setConnection({ phase: "starting", managed: !this.config().get<string>("serverUrl") });
      try {
        const configuredUrl = (this.config().get<string>("serverUrl") || "").trim();
        const password = this.serverPassword();
        let url: string;
        let version: string;
        let managed = false;
        let executable: string | undefined;

        if (configuredUrl) {
          url = configuredUrl.replace(/\/+$/, "");
          const health = await probeServer(url, password);
          version = health.version;
          this.output(`[hub] attached to ${url} (v${version})`);
          this.setConnection({ phase: "external", url, version, managed: false });
        } else {
          if (!this.config().get<boolean>("autoStartServer")) {
            this.setConnection({
              phase: "idle",
              error: "OpenCode server is not running. Start it from the command palette or enable opencodeRtl.autoStartServer.",
            });
            this.broadcast({ type: "connection", payload: this.connection });
            return;
          }
          const started = await this.server.start({
            executable: this.config().get<string>("executable") || "opencode",
            cwd: this.workspaceRoot || process.cwd(),
          });
          url = started.url;
          version = started.version;
          managed = true;
          executable = started.executable;
          this.setConnection({ phase: "ready", url, version, managed, executable });
        }

        this.client = new OpencodeApi({ baseUrl: url, password, directory: this.workspaceRoot });
        await this.bootstrap();
        this.startEvents();
        this.broadcast({ type: "init", payload: this.snapshot() });
        this.output("[hub] ready");
      } catch (error) {
        const detail = messageText(error);
        this.initialized = false;
        this.output(`[hub] initialization failed: ${detail}`);
        this.setConnection({ phase: "error", error: detail, managed: !this.config().get<string>("serverUrl") });
        this.broadcast({ type: "connection", payload: this.connection });
        this.broadcast({ type: "error", payload: { message: detail } });
      } finally {
        this.initializing = undefined;
      }
    })();

    return this.initializing;
  }

  private setConnection(state: ConnectionState) {
    this.connection = state;
    this.changed();
    this.broadcast({ type: "connection", payload: state });
  }

  private async bootstrap() {
    const api = this.requireApi();
    const [providersResult, agents, sessions, savedModel, savedAgent] = await Promise.all([
      api.providers().catch((error) => {
        this.output(`[hub] provider discovery failed: ${messageText(error)}`);
        return { providers: [] as ProviderInfo[], default: {} as Record<string, string> };
      }),
      api.agents().catch(() => [] as AgentInfo[]),
      api.sessions().catch(() => [] as SessionSummary[]),
      Promise.resolve(this.deps.context.workspaceState.get<string>("opencodeRtl.model")),
      Promise.resolve(this.deps.context.workspaceState.get<string>("opencodeRtl.agent")),
    ]);

    this.models = this.flattenModels(providersResult.providers);
    this.agents = agents;
    this.selectedModel = this.pickInitialModel(providersResult, savedModel);
    this.selectedAgent = savedAgent || this.config().get<string>("defaultAgent") || "build";
    this.sessions = sessions;

    const savedSession = this.deps.context.workspaceState.get<string>("opencodeRtl.session");
    const found = savedSession ? sessions.find((entry) => entry.id === savedSession) : undefined;
    this.current = found || sessions[0] || null;
    if (!this.current) {
      this.messages = [];
      this.todos = [];
      this.status = { type: "idle" };
    } else {
      await this.loadHistory(this.current.id);
    }

    this.broadcast({ type: "models", payload: { models: this.models, selected: this.selectedModel } });
    this.broadcast({ type: "agents", payload: { agents: this.agents, selected: this.selectedAgent } });
    this.broadcast({ type: "sessions", payload: this.sessions });
    this.broadcast({ type: "ui", payload: this.resolveUi() });
    this.broadcast({ type: "session", payload: { session: this.current, status: this.status } });
    this.broadcast({ type: "history", payload: this.historyPayload(this.current?.id || "") });
    this.changed();
  }

  private pickInitialModel(providersResult: { default: Record<string, string> }, saved?: string) {
    const configured = this.config().get<string>("defaultModel") || "";
    const candidate = saved || configured;
    if (candidate) {
      const slash = candidate.indexOf("/");
      if (slash > 0) {
        const providerID = candidate.slice(0, slash);
        const modelID = candidate.slice(slash + 1);
        if (this.models.some((model) => model.providerID === providerID && model.id === modelID)) {
          return { providerID, modelID };
        }
      }
    }
    const defaults = providersResult.default || {};
    const providerID = Object.keys(defaults)[0];
    if (providerID) return { providerID, modelID: defaults[providerID] };
    const first = this.models[0];
    return first ? { providerID: first.providerID, modelID: first.id } : undefined;
  }

  private flattenModels(providers: ProviderInfo[]): ModelInfo[] {
    const result: ModelInfo[] = [];
    for (const provider of providers) {
      for (const [id, model] of Object.entries(provider.models || {})) {
        result.push({
          id,
          name: model.name || id,
          providerID: provider.id,
          providerName: provider.name || provider.id,
          context: model.limit?.context,
          output: model.limit?.output,
          reasoning: model.capabilities?.reasoning,
          cost: model.cost ? { input: model.cost.input, output: model.cost.output } : undefined,
        });
      }
    }
    return result.sort((a, b) => `${a.providerName}/${a.name}`.localeCompare(`${b.providerName}/${b.name}`));
  }

  private async loadHistory(sessionId: string) {
    const api = this.requireApi();
    const [messages, todos, permissions, questions, statuses] = await Promise.all([
      api.messages(sessionId).catch((error) => {
        this.output(`[hub] history failed: ${messageText(error)}`);
        return [] as ChatMessage[];
      }),
      api.todos(sessionId).catch(() => [] as TodoItem[]),
      api.permissions().catch(() => [] as PermissionRequest[]),
      api.questions().catch(() => [] as QuestionRequest[]),
      api.statuses().catch(() => ({}) as Record<string, SessionStatus>),
    ]);
    this.messages = messages;
    this.todos = this.resolveTodos(sessionId, todos);
    this.permissions = permissions;
    this.questions = questions;
    this.status = statuses[sessionId] || { type: "idle" };
    this.turnActive = this.status.type === "busy" || this.status.type === "retry";
    this.deps.context.workspaceState.update("opencodeRtl.session", sessionId);
    this.changed();
  }

  private historyPayload(sessionId: string) {
    return {
      sessionId,
      messages: this.messages,
      todos: this.todos,
      permissions: this.permissions.filter((entry) => entry.sessionID === sessionId),
      questions: this.questions.filter((entry) => entry.sessionID === sessionId),
      status: this.status,
    };
  }

  // ---------------------------------------------------------------------
  // Session actions
  // ---------------------------------------------------------------------

  async newSession(title?: string): Promise<void> {
    const api = this.requireApi();
    this.turnActive = false;
    this.status = { type: "idle" };
    const session = await api.createSession({
      title,
      agent: this.selectedAgent,
      model: this.selectedModel ? { id: this.selectedModel.modelID, providerID: this.selectedModel.providerID } : undefined,
    });
    this.current = session;
    this.messages = [];
    this.todos = [];
    this.permissions = [];
    this.questions = [];
    this.sessions = [session, ...this.sessions.filter((entry) => entry.id !== session.id)];
    this.deps.context.workspaceState.update("opencodeRtl.session", session.id);
    this.broadcast({ type: "sessions", payload: this.sessions });
    this.broadcast({ type: "session", payload: { session, status: this.status } });
    this.broadcast({ type: "history", payload: this.historyPayload(session.id) });
    this.changed();
  }

  async selectSession(id: string): Promise<void> {
    if (this.current?.id === id) return;
    const session = this.sessions.find((entry) => entry.id === id) || toSessionSummary(await this.requireApi().session(id));
    this.current = session;
    this.turnActive = false;
    this.messages = [];
    this.todos = [];
    this.status = { type: "idle" };
    this.broadcast({ type: "session", payload: { session, status: this.status } });
    this.broadcast({ type: "history", payload: this.historyPayload(id) });
    await this.loadHistory(id);
    this.broadcast({ type: "history", payload: this.historyPayload(id) });
    this.changed();
  }

  async deleteSession(id: string): Promise<void> {
    await this.requireApi().deleteSession(id);
    this.sessions = this.sessions.filter((entry) => entry.id !== id);
    this.broadcast({ type: "sessions", payload: this.sessions });
    if (this.current?.id === id) {
      if (this.sessions[0]) await this.selectSession(this.sessions[0].id);
      else {
        this.current = null;
        this.messages = [];
        this.todos = [];
        this.deps.context.workspaceState.update("opencodeRtl.session", undefined);
        this.broadcast({ type: "session", payload: { session: null, status: this.status } });
        this.broadcast({ type: "history", payload: this.historyPayload("") });
      }
    }
    this.changed();
  }

  async forkSession(id: string): Promise<void> {
    const forked = await this.requireApi().forkSession(id);
    this.sessions = [forked, ...this.sessions];
    this.broadcast({ type: "sessions", payload: this.sessions });
    await this.selectSession(forked.id);
    this.broadcast({ type: "toast", payload: { kind: "success", message: "Forked session" } });
  }

  async refreshSessions(notify = false): Promise<void> {
    if (!this.client) return;
    try {
      this.sessions = await this.client.sessions();
      this.broadcast({ type: "sessions", payload: this.sessions });
      if (this.current) {
        const updated = this.sessions.find((entry) => entry.id === this.current?.id);
        if (updated) {
          this.current = updated;
          this.broadcast({ type: "session", payload: { session: updated, status: this.status } });
        }
      }
      if (notify) this.broadcast({ type: "toast", payload: { kind: "success", message: "Sessions refreshed" } });
    } catch (error) {
      this.output(`[hub] refresh sessions failed: ${messageText(error)}`);
    }
  }

  private scheduleSessionRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refreshSessions();
    }, 500);
  }

  // ---------------------------------------------------------------------
  // Prompting
  // ---------------------------------------------------------------------

  async submit(text: string, attachments: Attachment[]): Promise<void> {
    const api = this.requireApi();
    if (!this.current) await this.newSession();
    if (!this.current) throw new Error("Could not create a session");

    const parts = await this.buildPrompt(text, attachments);
    this.suppressAutoComplete = false;
    this.turnActive = true;
    this.status = { type: "busy" };
    this.broadcast({ type: "status", payload: { sessionId: this.current.id, status: this.status } });
    this.changed();

    try {
      await api.prompt(this.current.id, parts, { model: this.selectedModel, agent: this.selectedAgent });
      this.draft = undefined;
    } catch (error) {
      this.turnActive = false;
      this.status = { type: "idle" };
      this.broadcast({ type: "status", payload: { sessionId: this.current.id, status: this.status } });
      this.broadcast({ type: "error", payload: { message: messageText(error) } });
      this.changed();
      throw error;
    }
  }

  private async buildPrompt(text: string, attachments: Attachment[]): Promise<PromptInput> {
    const files: NonNullable<PromptInput["files"]> = [];
    const notes: string[] = [];

    for (const attachment of attachments) {
      if (attachment.kind === "selection") {
        const location = attachment.path
          ? `${attachment.path}${attachment.range ? ` (lines ${attachment.range.start}-${attachment.range.end})` : ""}`
          : attachment.name;
        notes.push(
          `Selected code from ${location}:\n\n\`\`\`${attachment.language || ""}\n${attachment.content || ""}\n\`\`\``,
        );
        continue;
      }
      if (!attachment.path) continue;
      const uri = pathToFileURL(attachment.path);
      files.push({ url: uri.href, mime: attachment.mime || mimeFor(attachment.path), filename: path.basename(attachment.path) });
    }

    const finalText = [text.trim(), ...notes].filter(Boolean).join("\n\n");
    return { text: finalText, files };
  }

  async abort(): Promise<void> {
    if (!this.current) return;
    this.suppressAutoComplete = true;
    this.turnActive = false;
    await this.requireApi().abort(this.current.id);
    this.status = { type: "idle" };
    this.broadcast({ type: "status", payload: { sessionId: this.current.id, status: this.status } });
    this.changed();
  }

  // ---------------------------------------------------------------------
  // Permission + question replies
  // ---------------------------------------------------------------------

  async replyPermission(requestId: string, reply: "once" | "always" | "reject", message?: string): Promise<void> {
    if (reply !== "reject") this.turnActive = true;
    this.suppressAutoComplete = false;
    await this.requireApi().replyPermission(requestId, reply, message);
    this.permissions = this.permissions.filter((entry) => entry.id !== requestId);
    if (this.current) this.broadcast({ type: "permissions", payload: { sessionId: this.current.id, requests: this.permissions } });
  }

  async replyQuestion(requestId: string, answers: string[][]): Promise<void> {
    this.turnActive = true;
    this.suppressAutoComplete = false;
    await this.requireApi().replyQuestion(requestId, answers);
    this.questions = this.questions.filter((entry) => entry.id !== requestId);
    if (this.current) this.broadcast({ type: "questions", payload: { sessionId: this.current.id, requests: this.questions } });
  }

  async rejectQuestion(requestId: string): Promise<void> {
    await this.requireApi().rejectQuestion(requestId);
    this.questions = this.questions.filter((entry) => entry.id !== requestId);
    if (this.current) this.broadcast({ type: "questions", payload: { sessionId: this.current.id, requests: this.questions } });
  }

  // ---------------------------------------------------------------------
  // UI + model preferences
  // ---------------------------------------------------------------------

  private resolveUi(): UiPrefs {
    const config = this.config();
    const languageSetting = (config.get<string>("language") || "auto") as UiPrefs["languageSetting"];
    const directionSetting = (config.get<string>("direction") || "auto") as UiPrefs["directionSetting"];
    const vscodeArabic = (vscode.env.language || "en").toLowerCase().startsWith("ar");
    const language: Language = languageSetting === "auto" ? (vscodeArabic ? "ar" : "en") : (languageSetting as Language);
    const direction: Direction = directionSetting === "auto" ? (language === "ar" ? "rtl" : "ltr") : (directionSetting as Direction);
    return {
      language,
      languageSetting,
      direction,
      directionSetting,
      fontSize: config.get<number>("fontSize") || 14,
      showReasoning: config.get<boolean>("showReasoning") ?? false,
      sendKey: (config.get<string>("sendKey") as UiPrefs["sendKey"]) || "enter",
      compact: this.deps.context.workspaceState.get<boolean>("opencodeRtl.compact") ?? false,
      codeWrap: this.deps.context.workspaceState.get<boolean>("opencodeRtl.codeWrap") ?? true,
    };
  }

  async setUi(patch: Partial<UiPrefs>): Promise<void> {
    const config = this.config();
    const target = vscode.ConfigurationTarget.Global;
    if (patch.languageSetting || patch.language) {
      const value = patch.languageSetting || patch.language;
      await config.update("language", value, target);
    }
    if (patch.directionSetting || patch.direction) {
      const value = patch.directionSetting || patch.direction;
      await config.update("direction", value, target);
    }
    if (typeof patch.fontSize === "number") await config.update("fontSize", patch.fontSize, target);
    if (typeof patch.showReasoning === "boolean") await config.update("showReasoning", patch.showReasoning, target);
    if (patch.sendKey) await config.update("sendKey", patch.sendKey, target);
    if (typeof patch.compact === "boolean") await this.deps.context.workspaceState.update("opencodeRtl.compact", patch.compact);
    if (typeof patch.codeWrap === "boolean") await this.deps.context.workspaceState.update("opencodeRtl.codeWrap", patch.codeWrap);
    this.broadcast({ type: "ui", payload: this.resolveUi() });
    this.changed();
  }

  async setModel(model: { providerID: string; modelID: string }): Promise<void> {
    this.selectedModel = model;
    await this.deps.context.workspaceState.update("opencodeRtl.model", `${model.providerID}/${model.modelID}`);
    this.broadcast({ type: "models", payload: { models: this.models, selected: model } });
    this.changed();
  }

  async setAgent(agent: string): Promise<void> {
    this.selectedAgent = agent;
    await this.deps.context.workspaceState.update("opencodeRtl.agent", agent);
    this.broadcast({ type: "agents", payload: { agents: this.agents, selected: agent } });
    this.changed();
  }

  async toggleDirection(): Promise<void> {
    const ui = this.resolveUi();
    await this.setUi({ directionSetting: ui.direction === "rtl" ? "ltr" : "rtl", direction: ui.direction === "rtl" ? "ltr" : "rtl" });
  }

  // ---------------------------------------------------------------------
  // Editor integration
  // ---------------------------------------------------------------------

  requestOpen(target: "sidebar" | "panel") {
    this.openEmitter.fire(target);
  }

  pushDraft(draft: { text?: string; attachments?: Attachment[]; focus?: boolean }) {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draft = { ...draft, id: randomUUID(), sessionId: this.current?.id };
    this.broadcast({ type: "draft", payload: this.draft });
    if (draft.text || draft.attachments?.length) {
      this.draftTimer = setTimeout(() => {
        this.draft = undefined;
        this.draftTimer = undefined;
      }, 90_000);
    }
  }

  private selectionPayload(editor: vscode.TextEditor): Attachment {
    const selection = editor.selection;
    const document = editor.document;
    const hasSelection = !selection.isEmpty;
    const range = hasSelection
      ? new vscode.Range(selection.start, selection.end)
      : new vscode.Range(selection.active.line, 0, selection.active.line, document.lineAt(selection.active.line).text.length);
    const text = document.getText(range);
    return {
      id: randomUUID(),
      kind: "selection",
      name: `${path.basename(document.uri.fsPath)}:${range.start.line + 1}-${range.end.line + 1}`,
      path: document.uri.fsPath,
      language: document.languageId,
      content: text.slice(0, 60_000),
      range: { start: range.start.line + 1, end: range.end.line + 1 },
    };
  }

  async attachSelection(silent = true): Promise<Attachment | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      if (!silent) this.broadcast({ type: "toast", payload: { kind: "warn", message: "No active editor" } });
      return undefined;
    }
    const attachment = this.selectionPayload(editor);
    this.pushDraft({ attachments: [attachment], focus: true });
    return attachment;
  }

  async attachActiveFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.broadcast({ type: "toast", payload: { kind: "warn", message: "No active editor" } });
      return;
    }
    const document = editor.document;
    const attachment: Attachment = {
      id: randomUUID(),
      kind: IMAGE_EXT.has(path.extname(document.uri.fsPath).toLowerCase()) ? "image" : "file",
      name: path.basename(document.uri.fsPath),
      path: document.uri.fsPath,
      mime: mimeFor(document.uri.fsPath),
    };
    this.pushDraft({ attachments: [attachment], focus: true });
  }

  async pickFiles(kind: "file" | "image"): Promise<void> {
    const result = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: kind === "image" ? "Attach images" : "Attach files",
      filters:
        kind === "image"
          ? { Images: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }
          : undefined,
    });
    if (!result || !result.length) return;
    const attachments: Attachment[] = [];
    for (const uri of result) {
      let stat: vscode.FileStat | undefined;
      try {
        stat = await vscode.workspace.fs.stat(uri);
      } catch {
        continue;
      }
      const attachment: Attachment = {
        id: randomUUID(),
        kind: IMAGE_EXT.has(path.extname(uri.fsPath).toLowerCase()) ? "image" : "file",
        name: path.basename(uri.fsPath),
        path: uri.fsPath,
        mime: mimeFor(uri.fsPath),
      };
      if (attachment.kind === "image" && stat.size < 3_000_000) {
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          attachment.preview = `data:${attachment.mime};base64,${Buffer.from(bytes).toString("base64")}`;
        } catch {
          /* ignore preview failures */
        }
      }
      attachments.push(attachment);
    }
    if (attachments.length) this.pushDraft({ attachments, focus: true });
  }

  async attachData(files: Array<{ name: string; mime: string; data: string }>): Promise<void> {
    if (!Array.isArray(files) || !files.length) return;
    const maxFile = 20 * 1024 * 1024;
    const dir = vscode.Uri.joinPath(this.deps.context.globalStorageUri, "attachments");
    await vscode.workspace.fs.createDirectory(dir);
    const attachments: Attachment[] = [];
    for (const file of files.slice(0, 12)) {
      const mime = (file.mime || "application/octet-stream").toLowerCase();
      let bytes: Buffer;
      try {
        bytes = Buffer.from(String(file.data || ""), "base64");
      } catch {
        continue;
      }
      if (!bytes.length) continue;
      if (bytes.length > maxFile) {
        this.broadcast({
          type: "toast",
          payload: { kind: "warn", message: `${file.name || "File"} is larger than 20 MB and was skipped` },
        });
        continue;
      }
      const name = safeFileName(file.name, mime);
      const target = vscode.Uri.joinPath(dir, `${Date.now()}-${randomUUID().slice(0, 8)}-${name}`);
      try {
        await vscode.workspace.fs.writeFile(target, bytes);
      } catch (error) {
        this.output(`[hub] could not store attachment: ${messageText(error)}`);
        continue;
      }
      const extension = path.extname(name).toLowerCase();
      const kind = mime.startsWith("image/") || IMAGE_EXT.has(extension) ? "image" : "file";
      const attachment: Attachment = {
        id: randomUUID(),
        kind,
        name,
        path: target.fsPath,
        mime: mime.startsWith("image/") ? mime : mimeFor(name),
      };
      if (kind === "image" && bytes.length < 3_000_000) {
        attachment.preview = `data:${attachment.mime};base64,${bytes.toString("base64")}`;
      }
      attachments.push(attachment);
    }
    if (attachments.length) this.pushDraft({ attachments, focus: true });
  }

  private todoKey(sessionId: string): string {
    return `opencodeRtl.todos.${sessionId}`;
  }

  private resolveTodos(sessionId: string, incoming: TodoItem[]): TodoItem[] {
    const stored = this.deps.context.workspaceState.get<TodoItem[]>(this.todoKey(sessionId));
    if (!stored || !stored.length) return incoming;
    if (stored.length !== incoming.length) {
      void this.deps.context.workspaceState.update(this.todoKey(sessionId), undefined);
      return incoming;
    }
    const samePlan = stored.every((entry, index) => entry.content === incoming[index]?.content);
    if (!samePlan) {
      void this.deps.context.workspaceState.update(this.todoKey(sessionId), undefined);
      return incoming;
    }
    const storedDone = stored.filter((entry) => entry.status === "completed").length;
    const incomingDone = incoming.filter((entry) => entry.status === "completed").length;
    if (incomingDone >= storedDone) {
      if (incomingDone === incoming.length) {
        void this.deps.context.workspaceState.update(this.todoKey(sessionId), undefined);
      }
      return incoming;
    }
    return stored;
  }

  private persistTodos() {
    const sessionId = this.current?.id;
    if (!sessionId || !this.todos.length) return;
    void this.deps.context.workspaceState.update(this.todoKey(sessionId), this.todos);
  }

  private toggleTodo(index: number): void {
    if (!this.current) return;
    const todo = this.todos[index];
    if (!todo) return;
    this.suppressAutoComplete = true;
    this.todos = this.todos.map((entry, position) =>
      position === index ? { ...entry, status: entry.status === "completed" ? "pending" : "completed" } : entry,
    );
    this.persistTodos();
    this.broadcast({ type: "todos", payload: { sessionId: this.current.id, todos: this.todos } });
    this.changed();
  }

  private autoCompleteTodos(): void {
    const sessionId = this.current?.id;
    if (!sessionId) return;
    if (!this.turnActive) return;
    if (!this.config().get<boolean>("autoCompletePlan")) return;
    if (this.suppressAutoComplete) return;
    if (!this.todos.length || this.todos.every((entry) => entry.status === "completed")) return;
    if (this.questions.some((entry) => entry.sessionID === sessionId)) return;
    if (this.permissions.some((entry) => entry.sessionID === sessionId)) return;
    this.todos = this.todos.map((entry) =>
      entry.status === "completed" || entry.status === "cancelled" ? entry : { ...entry, status: "completed" },
    );
    this.persistTodos();
    this.broadcast({ type: "todos", payload: { sessionId, todos: this.todos } });
  }

  private editorContext(): { selection?: SelectionPayload; file?: { path: string; name: string } } | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return undefined;
    const document = editor.document;
    const file = { path: document.uri.fsPath, name: path.basename(document.uri.fsPath) };
    if (editor.selection.isEmpty) return { file };
    const text = document.getText(editor.selection);
    if (!text.trim()) return { file };
    return {
      file,
      selection: {
        text: text.slice(0, 60_000),
        path: document.uri.fsPath,
        language: document.languageId,
        startLine: editor.selection.start.line + 1,
        endLine: editor.selection.end.line + 1,
      },
    };
  }

  async sendSelection(mode: "send" | "explain" | "fix"): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage("Open a file and select some code first.");
      return;
    }
    const attachment = this.selectionPayload(editor);
    const ui = this.resolveUi();
    const prompts: Record<typeof mode, { ar: string; en: string }> = {
      send: { ar: "", en: "" },
      explain: {
        ar: "اشرح الكود المحدد بالتفصيل، واذكر أي مشاكل أو تحسينات محتملة.",
        en: "Explain the selected code in detail and point out potential issues or improvements.",
      },
      fix: {
        ar: "أصلح المشاكل في الكود المحدد، وأعد الكود النهائي كاملاً.",
        en: "Fix the issues in the selected code and return the complete final version.",
      },
    };
    this.pushDraft({ text: prompts[mode][ui.language], attachments: [attachment], focus: true });
  }

  async insertText(text: string): Promise<void> {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      const document = await vscode.workspace.openTextDocument({ content: "", language: "markdown" });
      editor = await vscode.window.showTextDocument(document);
    }
    await editor.edit((builder) => {
      if (editor!.selection.isEmpty) builder.insert(editor!.selection.active, text);
      else builder.replace(editor!.selection, text);
    });
  }

  async openFile(target: string, line?: number, endLine?: number): Promise<void> {
    const root = this.workspaceRoot || process.cwd();
    let filePath = target;
    if (!path.isAbsolute(filePath)) filePath = path.join(root, target);
    try {
      await access(filePath);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      const editor = await vscode.window.showTextDocument(document, { preview: false });
      if (line) {
        const start = new vscode.Position(Math.max(0, line - 1), 0);
        const end = new vscode.Position(Math.max(0, (endLine || line) - 1), 0);
        const range = new vscode.Range(start, end);
        editor.selection = new vscode.Selection(start, end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      }
    } catch {
      this.broadcast({ type: "toast", payload: { kind: "warn", message: `File not found: ${target}` } });
    }
  }

  async exportMarkdown(): Promise<void> {
    if (this.current) {
      try {
        this.messages = await this.requireApi().messages(this.current.id);
      } catch {
        /* fall back to the last known transcript */
      }
    }
    if (!this.messages.length) {
      this.broadcast({ type: "toast", payload: { kind: "warn", message: "Nothing to export yet" } });
      return;
    }
    const title = this.current?.title || "opencode-chat";
    const uri = await vscode.window.showSaveDialog({
      saveLabel: "Export chat",
      filters: { Markdown: ["md"] },
      defaultUri: vscode.Uri.file(path.join(this.workspaceRoot || process.cwd(), `${title.replace(/[\\/:*?"<>|]/g, "-")}.md`)),
    });
    if (!uri) return;
    const lines: string[] = [`# ${title}`, ""];
    for (const message of this.messages) {
      lines.push(`## ${message.info.role === "user" ? "You" : "Assistant"}`, "");
      for (const part of message.parts) {
        if (part.type === "text" && typeof part.text === "string") lines.push(part.text, "");
        else if (part.type === "reasoning" && typeof part.text === "string") {
          lines.push("<details><summary>Reasoning</summary>", "", part.text, "", "</details>", "");
        } else if (part.type === "tool") {
          const toolPart = part as ChatPart & { tool: string; state?: { status?: string; title?: string } };
          lines.push(`> Tool: \`${toolPart.tool}\` — ${toolPart.state?.status || ""} ${toolPart.state?.title || ""}`, "");
        }
      }
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(lines.join("\n"), "utf8"));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: true });
    this.broadcast({ type: "toast", payload: { kind: "success", message: "Chat exported" } });
  }

  async runCommand(name: string, args: Record<string, unknown>): Promise<void> {
    switch (name) {
      case "openPanel":
        this.requestOpen("panel");
        break;
      case "openSidebar":
        this.requestOpen("sidebar");
        break;
      case "openSettings":
        await vscode.commands.executeCommand("workbench.action.openSettings", "opencodeRtl");
        break;
      case "pickModel":
        await vscode.commands.executeCommand("opencodeRtl.pickModel");
        break;
      case "pickAgent":
        await vscode.commands.executeCommand("opencodeRtl.pickAgent");
        break;
      case "restartServer":
        await this.initialize(true);
        this.broadcast({ type: "toast", payload: { kind: "info", message: "OpenCode server restarted" } });
        break;
      case "newSession":
        await this.newSession();
        break;
      case "exportMarkdown":
        await this.exportMarkdown();
        break;
      case "toggleDirection":
        await this.toggleDirection();
        break;
      case "openDiff":
        if (this.current) {
          const files = await this.requireApi().diff(this.current.id);
          this.changeSets.set(this.current.id, files);
          this.broadcast({ type: "diff", payload: { sessionId: this.current.id, files } });
        }
        break;
      case "openFile":
        if (typeof args.path === "string") await this.openFile(args.path, args.line as number | undefined);
        break;
      default:
        this.output(`[hub] unknown command: ${name}`);
    }
  }

  async pickModel(): Promise<void> {
    type Item = vscode.QuickPickItem & { model: ModelInfo };
    const items: Item[] = this.models.map((model) => ({
      label: model.name,
      description: model.providerName,
      detail: [
        model.context ? `${Math.round(model.context / 1000)}k context` : undefined,
        model.reasoning ? "reasoning" : undefined,
        model.cost?.input ? `$${model.cost.input}/M in` : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
      picked: this.selectedModel?.modelID === model.id && this.selectedModel?.providerID === model.providerID,
      model,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: "OpenCode model",
      placeHolder: "Choose a model",
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!picked) return;
    await this.setModel({ providerID: picked.model.providerID, modelID: picked.model.id });
    this.broadcast({ type: "toast", payload: { kind: "success", message: `Model: ${picked.model.name}` } });
  }

  async pickAgent(): Promise<void> {
    type Item = vscode.QuickPickItem & { agent: AgentInfo };
    const items: Item[] = this.agents.map((agent) => ({
      label: agent.name,
      description: agent.mode,
      detail: agent.description,
      picked: this.selectedAgent === agent.name,
      agent,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: "OpenCode agent",
      placeHolder: "Choose an agent",
      matchOnDescription: true,
    });
    if (!picked) return;
    await this.setAgent(picked.agent.name);
    this.broadcast({ type: "toast", payload: { kind: "success", message: `Agent: ${picked.agent.name}` } });
  }

  private requireApi(): OpencodeApi {
    if (!this.client) {
      throw new Error(
        this.connection.phase === "error"
          ? this.connection.error || "OpenCode is not connected"
          : "OpenCode is starting. Please try again in a moment.",
      );
    }
    return this.client;
  }

  // ---------------------------------------------------------------------
  // Event stream
  // ---------------------------------------------------------------------

  private startEvents() {
    this.eventController?.abort();
    const controller = new AbortController();
    this.eventController = controller;

    const run = async () => {
      let delay = 600;
      while (!this.disposed && !controller.signal.aborted) {
        const api = this.client;
        if (!api) break;
        try {
          await api.events((event) => this.onEvent(event), controller.signal);
          delay = 600;
        } catch (error) {
          if (controller.signal.aborted || this.disposed) break;
          this.output(`[hub] event stream dropped: ${messageText(error)}`);
        }
        if (controller.signal.aborted || this.disposed) break;
        if (this.connection.managed && !this.server.running) {
          this.setConnection({ ...this.connection, phase: "error", error: "The OpenCode server stopped unexpectedly." });
          break;
        }
        void this.resync();
        await sleep(delay);
        delay = Math.min(delay * 2, 8000);
      }
    };
    void run();
  }

  private eventSessionId(event: OpencodeEvent): string | undefined {
    const props = event.properties || {};
    const data = event.data || {};
    return (
      props.sessionID ||
      props.info?.sessionID ||
      props.part?.sessionID ||
      data.sessionID ||
      data.info?.sessionID
    );
  }

  private onEvent(event: OpencodeEvent): void {
    const sessionId = this.eventSessionId(event);
    switch (event.type) {
      case "session.created":
      case "session.updated":
      case "session.deleted":
        this.scheduleSessionRefresh();
        if (event.type === "session.updated" && this.current?.id === sessionId) {
          const info = event.properties?.info;
          if (info) this.current = toSessionSummary(info);
        }
        break;
      case "permission.asked":
        if (event.properties) {
          const request = (event.properties.request || event.properties) as unknown as PermissionRequest;
          this.permissions = [...this.permissions.filter((entry) => entry.id !== request.id), request];
          if (this.current) {
            this.broadcast({
              type: "permissions",
              payload: { sessionId: this.current.id, requests: this.permissions.filter((entry) => entry.sessionID === this.current?.id) },
            });
          }
          if (request.sessionID === this.current?.id) {
            this.broadcast({ type: "toast", payload: { kind: "warn", message: "OpenCode needs your permission" } });
          }
        }
        break;
      case "permission.replied": {
        const requestId = event.properties?.requestID;
        if (requestId) this.permissions = this.permissions.filter((entry) => entry.id !== requestId);
        if (this.current) {
          this.broadcast({
            type: "permissions",
            payload: { sessionId: this.current.id, requests: this.permissions.filter((entry) => entry.sessionID === this.current?.id) },
          });
        }
        break;
      }
      case "question.asked":
        if (event.properties) {
          const request = (event.properties.request || event.properties) as unknown as QuestionRequest;
          this.questions = [...this.questions.filter((entry) => entry.id !== request.id), request];
          this.broadcast({
            type: "questions",
            payload: { sessionId: request.sessionID, requests: this.questions.filter((entry) => entry.sessionID === request.sessionID) },
          });
        }
        break;
      case "question.replied":
      case "question.rejected": {
        const requestId = event.properties?.requestID;
        if (requestId) this.questions = this.questions.filter((entry) => entry.id !== requestId);
        if (sessionId) {
          this.broadcast({
            type: "questions",
            payload: { sessionId, requests: this.questions.filter((entry) => entry.sessionID === sessionId) },
          });
        }
        break;
      }
      case "file.edited":
        if (this.current) this.changeSets.delete(this.current.id);
        break;
      default:
        break;
    }

    if (sessionId && this.current && sessionId === this.current.id) {
      this.applyLocal(event);
      this.broadcast({ type: "event", payload: { sessionId, event } });
    } else if (!sessionId) {
      // Global session-independent events are still useful to the UI (e.g. server.connected).
      this.broadcast({ type: "event", payload: { sessionId: this.current?.id || "", event } });
    }
  }

  private applyLocal(event: OpencodeEvent): void {
    const props = event.properties || {};
    switch (event.type) {
      case "session.status": {
        this.status = props.status || { type: "idle" };
        this.broadcast({ type: "status", payload: { sessionId: this.current?.id || "", status: this.status } });
        if (this.status.type === "idle") {
          this.autoCompleteTodos();
          this.turnActive = false;
        }
        this.changed();
        break;
      }
      case "session.idle": {
        this.status = { type: "idle" };
        this.broadcast({ type: "status", payload: { sessionId: this.current?.id || "", status: this.status } });
        this.autoCompleteTodos();
        this.turnActive = false;
        this.changed();
        void this.syncHistory();
        break;
      }
      case "todo.updated": {
        const incoming = Array.isArray(props.todos) ? props.todos : [];
        const sessionId = this.current?.id || "";
        if (sessionId) void this.deps.context.workspaceState.update(this.todoKey(sessionId), undefined);
        this.todos = incoming;
        this.broadcast({ type: "todos", payload: { sessionId, todos: this.todos } });
        break;
      }
      case "session.error": {
        this.suppressAutoComplete = true;
        this.turnActive = false;
        this.status = { type: "idle" };
        this.broadcast({ type: "status", payload: { sessionId: this.current?.id || "", status: this.status } });
        break;
      }
      default:
        break;
    }
  }

  private async resync(): Promise<void> {
    const session = this.current;
    if (!session) return;
    try {
      const statuses = await this.requireApi().statuses();
      this.status = statuses[session.id] || { type: "idle" };
      this.broadcast({ type: "status", payload: { sessionId: session.id, status: this.status } });
      this.changed();
      if (this.status.type === "idle") await this.syncHistory();
    } catch (error) {
      this.output(`[hub] resync failed: ${messageText(error)}`);
    }
  }

  private async syncHistory(): Promise<void> {
    const session = this.current;
    if (!session) return;
    try {
      const [messages, todos, statuses] = await Promise.all([
        this.requireApi().messages(session.id),
        this.requireApi().todos(session.id).catch(() => this.todos),
        this.requireApi().statuses().catch(() => ({}) as Record<string, SessionStatus>),
      ]);
      if (this.current?.id !== session.id) return;
      // A new prompt may have started while this request was in flight; do not
      // overwrite the live transcript in that case.
      if (this.status.type !== "idle") return;
      this.messages = messages;
      this.todos = this.resolveTodos(session.id, todos);
      this.status = statuses[session.id] || { type: "idle" };
      this.broadcast({ type: "history", payload: this.historyPayload(session.id) });
      this.changed();
    } catch (error) {
      this.output(`[hub] history sync failed: ${messageText(error)}`);
    }
  }

  async resolveExecutablePath(): Promise<string | undefined> {
    return resolveExecutable(this.config().get<string>("executable") || "opencode");
  }

  dispose(): void {
    this.disposed = true;
    this.eventController?.abort();
    this.api.abort();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.server.dispose();
    this.listeners.clear();
    this.stateEmitter.dispose();
    this.openEmitter.dispose();
  }
}
