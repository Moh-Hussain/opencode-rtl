import type { HostMessage } from "../src/shared/protocol";
import type {
  AgentInfo,
  Attachment,
  ChatMessage,
  ChatPart,
  ConnectionState,
  Direction,
  ModelInfo,
  PermissionRequest,
  QuestionRequest,
  SessionDiffFile,
  SessionStatus,
  SessionSummary,
  TodoItem,
  UiPrefs,
} from "../src/shared/types";
import type { Language } from "../src/shared/types";

export interface Toast {
  id: number;
  kind: "info" | "success" | "warn" | "error";
  message: string;
}

export interface SentSnapshot {
  text: string;
  attachments: Attachment[];
  at: number;
}

export interface State {
  ready: boolean;
  connection: ConnectionState;
  ui: UiPrefs;
  models: ModelInfo[];
  agents: AgentInfo[];
  selectedModel?: { providerID: string; modelID: string };
  selectedAgent?: string;
  sessions: SessionSummary[];
  currentSession: SessionSummary | null;
  messages: ChatMessage[];
  todos: TodoItem[];
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  status: SessionStatus;
  workspaceName: string;
  hasWorkspace: boolean;
  version: string;

  composerText: string;
  attachments: Attachment[];
  focusToken: number;
  lastDraftId?: string;
  lastSent?: SentSnapshot;
  sending: boolean;

  sessionsOpen: boolean;
  settingsOpen: boolean;
  picker: "model" | "agent" | null;
  diffOpen: boolean;
  diffFiles: SessionDiffFile[];
  showReasoningLocal: Record<string, boolean>;
  toasts: Toast[];
  bannerDismissed: boolean;
}

export const initialState: State = {
  ready: false,
  connection: { phase: "idle" },
  ui: {
    language: "ar",
    languageSetting: "auto",
    direction: "rtl",
    directionSetting: "auto",
    fontSize: 14,
    showReasoning: false,
    sendKey: "enter",
    compact: false,
    codeWrap: true,
  },
  models: [],
  agents: [],
  sessions: [],
  currentSession: null,
  messages: [],
  todos: [],
  permissions: [],
  questions: [],
  status: { type: "idle" },
  workspaceName: "",
  hasWorkspace: false,
  version: "",
  composerText: "",
  attachments: [],
  focusToken: 0,
  sending: false,
  sessionsOpen: false,
  settingsOpen: false,
  picker: null,
  diffOpen: false,
  diffFiles: [],
  showReasoningLocal: {},
  toasts: [],
  bannerDismissed: false,
};

let toastId = 0;

export type Action =
  | { type: "host"; message: HostMessage }
  | { type: "local:composer"; text: string }
  | { type: "local:clearComposer" }
  | { type: "local:attachments"; attachments: Attachment[] }
  | { type: "local:removeAttachment"; id: string }
  | { type: "local:submit" }
  | { type: "local:restore" }
  | { type: "local:sessionsOpen"; open: boolean }
  | { type: "local:settingsOpen"; open: boolean }
  | { type: "local:picker"; picker: "model" | "agent" | null }
  | { type: "local:diffOpen"; open: boolean }
  | { type: "local:dismissToast"; id: number }
  | { type: "local:dismissBanner" }
  | { type: "local:reasoning"; messageId: string; open: boolean }
  | { type: "local:focusComposer" }
  | { type: "local:ready" }
  | { type: "local:setStatus"; status: SessionStatus };

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => (a.info.time?.created || 0) - (b.info.time?.created || 0));
}

function upsertMessage(messages: ChatMessage[], info: ChatMessage["info"]): ChatMessage[] {
  const index = messages.findIndex((entry) => entry.info.id === info.id);
  if (index === -1) return sortMessages([...messages, { info, parts: [] }]);
  const next = messages.slice();
  next[index] = { ...next[index], info: { ...next[index].info, ...info } };
  return next;
}

function patchMessage(messages: ChatMessage[], messageID: string, update: (message: ChatMessage) => ChatMessage): ChatMessage[] {
  const index = messages.findIndex((entry) => entry.info.id === messageID);
  if (index === -1) return messages;
  const next = messages.slice();
  next[index] = update(next[index]);
  return next;
}

function upsertPart(messages: ChatMessage[], part: ChatPart): ChatMessage[] {
  let found = false;
  const next = messages.map((message) => {
    if (message.info.id !== part.messageID) return message;
    const index = message.parts.findIndex((entry) => entry.id === part.id);
    const parts = message.parts.slice();
    if (index === -1) parts.push(part);
    else parts[index] = { ...parts[index], ...part };
    found = true;
    return { ...message, parts };
  });
  if (found) return next;
  return sortMessages([
    ...messages,
    {
      info: {
        id: part.messageID,
        sessionID: part.sessionID,
        role: "assistant",
      },
      parts: [part],
    },
  ]);
}

function applyEvent(state: State, event: any): State {
  const props = event.properties || {};
  const data = event.data || {};
  const sessionId: string | undefined = props.sessionID || data.sessionID || props.info?.sessionID || props.part?.sessionID;
  if (sessionId && state.currentSession && sessionId !== state.currentSession.id) {
    if (event.type === "session.deleted") {
      return { ...state, sessions: state.sessions.filter((entry) => entry.id !== sessionId) };
    }
    return state;
  }

  switch (event.type) {
    case "message.updated": {
      if (!props.info?.id) return state;
      return { ...state, messages: upsertMessage(state.messages, props.info) };
    }
    case "message.part.updated": {
      if (!props.part?.messageID || !props.part?.id) return state;
      return { ...state, messages: upsertPart(state.messages, props.part) };
    }
    case "message.part.delta": {
      const delta = props.partID ? props : data;
      if (!delta.partID || !delta.messageID) return state;
      if (delta.field !== "text" && delta.field !== "reasoning") return state;
      const message = state.messages.find((entry) => entry.info.id === delta.messageID);
      if (!message) return state;
      // Deltas only extend parts the server has announced. Unknown parts are
      // usually discarded reasoning drafts that never appear in the history.
      if (!message.parts.some((entry) => entry.id === delta.partID)) return state;
      return {
        ...state,
        messages: patchMessage(state.messages, delta.messageID, (entry) => ({
          ...entry,
          parts: entry.parts.map((part) =>
            part.id === delta.partID ? { ...part, text: String(part.text || "") + String(delta.delta || "") } : part,
          ),
        })),
      };
    }
    case "message.part.removed": {
      if (!props.messageID || !props.partID) return state;
      return {
        ...state,
        messages: patchMessage(state.messages, props.messageID, (entry) => ({
          ...entry,
          parts: entry.parts.filter((part) => part.id !== props.partID),
        })),
      };
    }
    case "message.removed": {
      if (!props.messageID) return state;
      return { ...state, messages: state.messages.filter((entry) => entry.info.id !== props.messageID) };
    }
    case "session.status": {
      return {
        ...state,
        status: props.status || { type: "idle" },
        sending: props.status?.type === "busy" ? state.sending : false,
      };
    }
    case "session.idle": {
      return { ...state, status: { type: "idle" }, sending: false };
    }
    case "session.error": {
      const text = props.error?.data?.message || props.error?.message || "The model returned an error";
      return {
        ...state,
        status: { type: "idle" },
        sending: false,
        toasts: [...state.toasts, { id: ++toastId, kind: "error", message: String(text) }],
      };
    }
    case "session.created": {
      const info = props.info;
      if (!info?.id) return state;
      const summary = toSummary(info);
      const exists = state.sessions.some((entry) => entry.id === summary.id);
      return { ...state, sessions: exists ? state.sessions : [summary, ...state.sessions] };
    }
    case "session.updated": {
      const info = props.info;
      if (!info?.id) return state;
      const summary = toSummary(info);
      const sessions = state.sessions.map((entry) => (entry.id === summary.id ? { ...entry, ...summary } : entry));
      const current = state.currentSession?.id === summary.id ? { ...state.currentSession, ...summary } : state.currentSession;
      return { ...state, sessions, currentSession: current };
    }
    case "session.deleted": {
      return { ...state, sessions: state.sessions.filter((entry) => entry.id !== sessionId) };
    }
    case "todo.updated": {
      if (!Array.isArray(props.todos)) return state;
      return { ...state, todos: props.todos };
    }
    case "permission.asked": {
      const request = (props.request || props) as PermissionRequest;
      if (!request?.id) return state;
      const exists = state.permissions.some((entry) => entry.id === request.id);
      return {
        ...state,
        permissions: exists ? state.permissions : [...state.permissions, request],
      };
    }
    case "permission.replied": {
      return { ...state, permissions: state.permissions.filter((entry) => entry.id !== props.requestID) };
    }
    case "question.asked": {
      const request = (props.request || props) as QuestionRequest;
      if (!request?.id) return state;
      const exists = state.questions.some((entry) => entry.id === request.id);
      return { ...state, questions: exists ? state.questions : [...state.questions, request] };
    }
    case "question.replied":
    case "question.rejected": {
      return { ...state, questions: state.questions.filter((entry) => entry.id !== props.requestID) };
    }
    default:
      return state;
  }
}

function toSummary(info: any): SessionSummary {
  return {
    id: info.id,
    title: info.title || "Untitled",
    created: info.time?.created,
    updated: info.time?.updated,
    cost: info.cost,
    tokens: (info.tokens?.input || 0) + (info.tokens?.output || 0),
    directory: info.directory,
    parentID: info.parentID,
  };
}

function sameSession(a: SessionSummary | null, b: SessionSummary | null): boolean {
  return (a?.id || "") === (b?.id || "");
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "local:ready":
      return { ...state, ready: true };
    case "local:composer":
      return { ...state, composerText: action.text };
    case "local:clearComposer":
      return { ...state, composerText: "", attachments: [] };
    case "local:attachments": {
      const merged = [...state.attachments];
      for (const attachment of action.attachments) {
        const duplicate = merged.some(
          (entry) =>
            entry.path === attachment.path &&
            entry.name === attachment.name &&
            entry.range?.start === attachment.range?.start,
        );
        if (!duplicate) merged.push(attachment);
      }
      return { ...state, attachments: merged.slice(0, 12) };
    }
    case "local:removeAttachment":
      return { ...state, attachments: state.attachments.filter((entry) => entry.id !== action.id) };
    case "local:submit":
      return {
        ...state,
        lastSent: { text: state.composerText, attachments: state.attachments, at: Date.now() },
        composerText: "",
        attachments: [],
        sending: true,
      };
    case "local:restore": {
      const lastSent = state.lastSent;
      if (!lastSent) return state;
      return {
        ...state,
        composerText: state.composerText || lastSent.text,
        attachments: state.attachments.length ? state.attachments : lastSent.attachments,
        sending: false,
      };
    }
    case "local:sessionsOpen":
      return { ...state, sessionsOpen: action.open };
    case "local:settingsOpen":
      return { ...state, settingsOpen: action.open };
    case "local:picker":
      return { ...state, picker: action.picker };
    case "local:diffOpen":
      return { ...state, diffOpen: action.open };
    case "local:dismissToast":
      return { ...state, toasts: state.toasts.filter((entry) => entry.id !== action.id) };
    case "local:dismissBanner":
      return { ...state, bannerDismissed: true };
    case "local:reasoning":
      return { ...state, showReasoningLocal: { ...state.showReasoningLocal, [action.messageId]: action.open } };
    case "local:focusComposer":
      return { ...state, focusToken: state.focusToken + 1 };
    case "local:setStatus":
      return { ...state, status: action.status, sending: action.status.type === "busy" ? state.sending : false };
    case "host":
      return reduceHost(state, action.message);
    default:
      return state;
  }
}

function reduceHost(state: State, message: HostMessage): State {
  switch (message.type) {
    case "init": {
      const payload = message.payload;
      const sessionChanged = !sameSession(state.currentSession, payload.currentSession);
      return {
        ...state,
        ready: true,
        connection: payload.connection,
        ui: payload.ui,
        models: payload.models,
        agents: payload.agents,
        selectedModel: payload.selectedModel,
        selectedAgent: payload.selectedAgent,
        sessions: payload.sessions,
        currentSession: payload.currentSession,
        messages: payload.messages,
        todos: payload.todos,
        permissions: payload.permissions,
        questions: payload.questions,
        status: payload.status,
        workspaceName: payload.workspaceName,
        hasWorkspace: payload.hasWorkspace,
        version: payload.version,
        composerText: sessionChanged ? "" : state.composerText,
        attachments: sessionChanged ? [] : state.attachments,
        sending: payload.status.type === "busy",
      };
    }
    case "connection":
      return {
        ...state,
        connection: message.payload,
        bannerDismissed: message.payload.phase === "ready" || message.payload.phase === "external" ? false : state.bannerDismissed,
      };
    case "ui":
      return { ...state, ui: message.payload };
    case "models":
      return { ...state, models: message.payload.models, selectedModel: message.payload.selected };
    case "agents":
      return { ...state, agents: message.payload.agents, selectedAgent: message.payload.selected };
    case "sessions":
      return { ...state, sessions: message.payload };
    case "session": {
      const changed = !sameSession(state.currentSession, message.payload.session);
      return {
        ...state,
        currentSession: message.payload.session,
        status: message.payload.status || state.status,
        messages: changed ? [] : state.messages,
        permissions: changed ? [] : state.permissions,
        questions: changed ? [] : state.questions,
        todos: changed ? [] : state.todos,
        composerText: changed ? "" : state.composerText,
        attachments: changed ? [] : state.attachments,
        sending: changed ? false : state.sending,
      };
    }
    case "history": {
      const changed = state.currentSession?.id !== message.payload.sessionId;
      return {
        ...state,
        messages: message.payload.messages,
        todos: message.payload.todos,
        permissions: message.payload.permissions,
        questions: message.payload.questions,
        status: message.payload.status,
        composerText: changed ? "" : state.composerText,
        attachments: changed ? [] : state.attachments,
        sending: message.payload.status.type === "busy",
      };
    }
    case "event":
      return applyEvent(state, message.payload.event);
    case "status":
      return {
        ...state,
        status: message.payload.status,
        sending: message.payload.status.type === "busy" ? state.sending : false,
      };
    case "permissions":
      return { ...state, permissions: message.payload.requests };
    case "questions":
      return { ...state, questions: message.payload.requests };
    case "todos":
      return { ...state, todos: message.payload.todos };
    case "diff":
      return { ...state, diffFiles: message.payload.files, diffOpen: true };
    case "draft": {
      const payload = message.payload;
      if (payload.id && payload.id === state.lastDraftId) return state;
      const attachments = payload.attachments ? [...state.attachments] : state.attachments;
      for (const attachment of payload.attachments || []) {
        const duplicate = attachments.some((entry) => entry.path === attachment.path && entry.name === attachment.name);
        if (!duplicate) attachments.push(attachment);
      }
      return {
        ...state,
        composerText: payload.text !== undefined ? payload.text : state.composerText,
        attachments: attachments.slice(0, 12),
        focusToken: payload.focus ? state.focusToken + 1 : state.focusToken,
        lastDraftId: payload.id,
      };
    }
    case "toast":
      return {
        ...state,
        toasts: [...state.toasts, { id: ++toastId, kind: message.payload.kind, message: message.payload.message }],
      };
    case "busy":
      return { ...state, sending: message.payload.busy };
    case "error": {
      const canRestore = state.lastSent && Date.now() - state.lastSent.at < 20_000;
      return {
        ...state,
        sending: false,
        toasts: [...state.toasts, { id: ++toastId, kind: "error", message: message.payload.message }],
        composerText: canRestore && !state.composerText ? state.lastSent!.text : state.composerText,
        attachments: canRestore && !state.attachments.length ? state.lastSent!.attachments : state.attachments,
      };
    }
    default:
      return state;
  }
}

export function currentDirection(state: State): Direction {
  return state.ui.direction;
}

export function language(state: State): Language {
  return state.ui.language;
}

export function messageKey(message: ChatMessage): string {
  const last = message.parts[message.parts.length - 1] as any;
  return `${message.info.id}:${message.parts.length}:${last?.text?.length || 0}`;
}
