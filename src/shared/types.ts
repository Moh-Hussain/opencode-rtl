export type Language = "ar" | "en";
export type LanguageSetting = "auto" | Language;
export type Direction = "rtl" | "ltr";
export type DirectionSetting = "auto" | Direction;

export type ConnectionPhase = "idle" | "starting" | "ready" | "error" | "external";

export interface ConnectionState {
  phase: ConnectionPhase;
  url?: string;
  version?: string;
  error?: string;
  executable?: string;
  managed?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerID: string;
  providerName: string;
  context?: number;
  output?: number;
  reasoning?: boolean;
  cost?: { input?: number; output?: number };
}

export interface AgentInfo {
  name: string;
  description?: string;
  mode?: string;
  native?: boolean;
}

export interface SessionSummary {
  id: string;
  title: string;
  created?: number;
  updated?: number;
  cost?: number;
  tokens?: number;
  directory?: string;
  parentID?: string;
}

export interface Attachment {
  id: string;
  kind: "file" | "image" | "selection" | "symbol";
  name: string;
  path?: string;
  mime?: string;
  preview?: string;
  range?: { start: number; end: number };
  language?: string;
  content?: string;
}

export interface MessageInfo {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time?: { created?: number; completed?: number };
  agent?: string;
  mode?: string;
  modelID?: string;
  providerID?: string;
  cost?: number;
  tokens?: Record<string, number>;
  error?: MessageError;
  summary?: boolean;
  parentID?: string;
}

export interface MessageError {
  name?: string;
  message?: string;
  data?: { message?: string; providerID?: string; [key: string]: unknown };
}

export interface PartTime {
  start?: number;
  end?: number;
}

export interface BasePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  time?: PartTime;
  [key: string]: unknown;
}

export interface TextPart extends BasePart {
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
}

export interface ReasoningPart extends BasePart {
  type: "reasoning";
  text: string;
}

export interface ToolState {
  status: "pending" | "running" | "completed" | "error";
  input?: Record<string, unknown>;
  raw?: string;
  title?: string;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  time?: PartTime;
  attachments?: FilePart[];
}

export interface ToolPart extends BasePart {
  type: "tool";
  callID: string;
  tool: string;
  state: ToolState;
  metadata?: Record<string, unknown>;
}

export interface FilePart extends BasePart {
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: Record<string, unknown>;
}

export type ChatPart = BasePart & Record<string, unknown>;

export interface ChatMessage {
  info: MessageInfo;
  parts: ChatPart[];
}

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | string;
  priority?: string;
}

export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata?: Record<string, unknown>;
  always?: string[];
  tool?: { messageID?: string; callID?: string };
}

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionItem {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionItem[];
  tool?: { messageID?: string; callID?: string };
}

export interface SessionDiffFile {
  file: string;
  patch?: string;
  additions?: number;
  deletions?: number;
  status?: "added" | "deleted" | "modified" | string;
}

export interface SessionStatus {
  type: "idle" | "busy" | "retry";
  attempt?: number;
  message?: string;
  next?: number;
}

export interface UiPrefs {
  language: Language;
  languageSetting: LanguageSetting;
  direction: Direction;
  directionSetting: DirectionSetting;
  fontSize: number;
  showReasoning: boolean;
  sendKey: "enter" | "ctrlEnter";
  compact: boolean;
  codeWrap: boolean;
}

export interface Bootstrap {
  connection: ConnectionState;
  ui: UiPrefs;
  models: ModelInfo[];
  agents: AgentInfo[];
  sessions: SessionSummary[];
  currentSession: SessionSummary | null;
  messages: ChatMessage[];
  todos: TodoItem[];
  permissions: PermissionRequest[];
  questions: QuestionRequest[];
  selectedModel?: { providerID: string; modelID: string };
  selectedAgent?: string;
  status: SessionStatus;
  workspaceName: string;
  hasWorkspace: boolean;
  version: string;
}
