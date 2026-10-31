import type {
  AgentInfo,
  Attachment,
  Bootstrap,
  ChatMessage,
  ConnectionState,
  ModelInfo,
  PermissionRequest,
  QuestionRequest,
  SessionDiffFile,
  SessionStatus,
  SessionSummary,
  TodoItem,
  UiPrefs,
} from "./types";

export interface OpencodeEvent {
  id?: string;
  type: string;
  properties?: Record<string, any>;
  data?: Record<string, any>;
  durable?: { aggregateID: string; seq: number; version: number };
  location?: Record<string, any>;
}

export interface SelectionPayload {
  text: string;
  path: string;
  language?: string;
  startLine: number;
  endLine: number;
}

export type ClientMessage =
  | { type: "ready" }
  | { type: "retryConnection" }
  | { type: "submit"; text: string; attachments: Attachment[]; sessionId?: string }
  | { type: "abort"; sessionId: string }
  | { type: "newSession"; title?: string }
  | { type: "selectSession"; id: string }
  | { type: "deleteSession"; id: string }
  | { type: "forkSession"; id: string }
  | { type: "refreshSessions" }
  | { type: "replyPermission"; sessionId: string; requestId: string; reply: "once" | "always" | "reject"; message?: string }
  | { type: "replyQuestion"; sessionId: string; requestId: string; answers: string[][] }
  | { type: "rejectQuestion"; sessionId: string; requestId: string }
  | { type: "setUi"; patch: Partial<UiPrefs> }
  | { type: "selectModel"; providerID: string; modelID: string }
  | { type: "selectAgent"; agent: string }
  | { type: "command"; name: string; args?: Record<string, unknown> }
  | { type: "insertText"; text: string }
  | { type: "copyText"; text: string }
  | { type: "openFile"; path: string; line?: number; endLine?: number }
  | { type: "openUrl"; url: string }
  | { type: "pickFiles"; kind: "file" | "image" }
  | { type: "attachData"; files: Array<{ name: string; mime: string; data: string }> }
  | { type: "attachSelection" }
  | { type: "attachActiveFile" }
  | { type: "previewImage"; path: string }
  | { type: "toggleTodo"; index: number }
  | { type: "getDiff"; sessionId: string }
  | { type: "log"; level: "debug" | "info" | "warn" | "error"; message: string }
  | { type: "showToast"; kind: "info" | "success" | "warn" | "error"; message: string };

export type HostMessage =
  | { type: "init"; payload: Bootstrap }
  | { type: "connection"; payload: ConnectionState }
  | { type: "ui"; payload: UiPrefs }
  | { type: "models"; payload: { models: ModelInfo[]; selected?: { providerID: string; modelID: string } } }
  | { type: "agents"; payload: { agents: AgentInfo[]; selected?: string } }
  | { type: "sessions"; payload: SessionSummary[] }
  | { type: "session"; payload: { session: SessionSummary | null; status?: SessionStatus } }
  | {
      type: "history";
      payload: {
        sessionId: string;
        messages: ChatMessage[];
        todos: TodoItem[];
        permissions: PermissionRequest[];
        questions: QuestionRequest[];
        status: SessionStatus;
      };
    }
  | {
      type: "event";
      payload: { sessionId: string; event: OpencodeEvent };
    }
  | { type: "status"; payload: { sessionId: string; status: SessionStatus } }
  | { type: "permissions"; payload: { sessionId: string; requests: PermissionRequest[] } }
  | { type: "questions"; payload: { sessionId: string; requests: QuestionRequest[] } }
  | { type: "todos"; payload: { sessionId: string; todos: TodoItem[] } }
  | { type: "diff"; payload: { sessionId: string; files: SessionDiffFile[] } }
  | { type: "draft"; payload: { id: string; text?: string; attachments?: Attachment[]; focus?: boolean; sessionId?: string } }
  | { type: "imagePreview"; payload: { path: string; data: string } }
  | { type: "toast"; payload: { kind: "info" | "success" | "warn" | "error"; message: string } }
  | { type: "busy"; payload: { busy: boolean; label?: string } }
  | { type: "editorContext"; payload: { selection?: SelectionPayload; file?: { path: string; name: string } } }
  | { type: "error"; payload: { message: string; detail?: string } }
  | { type: "openPanel" };
