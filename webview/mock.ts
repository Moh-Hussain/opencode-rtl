import type { HostMessage, ClientMessage } from "../src/shared/protocol";
import type {
  Attachment,
  Bootstrap,
  ChatMessage,
  ChatPart,
  ModelInfo,
  PermissionRequest,
  QuestionRequest,
  SessionDiffFile,
  SessionSummary,
  TodoItem,
  UiPrefs,
} from "../src/shared/types";

export interface BridgeApi {
  post(message: ClientMessage): void;
  subscribe(handler: (message: HostMessage) => void): () => void;
  preview: boolean;
}

const now = Date.now();

const models: ModelInfo[] = [
  { id: "big-pickle", name: "Big Pickle", providerID: "opencode", providerName: "OpenCode", context: 200_000, reasoning: true, cost: { input: 0, output: 0 } },
  { id: "deepseek-v4.1-flash-free", name: "DeepSeek V4.1 Flash", providerID: "opencode", providerName: "OpenCode", context: 128_000, reasoning: true },
  { id: "glm-5.3-flash-free", name: "GLM 5.3 Flash", providerID: "opencode", providerName: "OpenCode", context: 128_000 },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", providerID: "anthropic", providerName: "Anthropic", context: 200_000, reasoning: true, cost: { input: 3, output: 15 } },
  { id: "gpt-5.2", name: "GPT-5.2", providerID: "openai", providerName: "OpenAI", context: 400_000, reasoning: true, cost: { input: 1.25, output: 10 } },
];

const sessions: SessionSummary[] = [
  { id: "ses_demo_1", title: "تحسين واجهة المحادثة ودعم RTL", updated: now - 60_000, created: now - 3_600_000, tokens: 18_420, cost: 0.021 },
  { id: "ses_demo_2", title: "إصلاح خطأ في رفع الملفات", updated: now - 3_600_000, created: now - 7_200_000, tokens: 6_120 },
  { id: "ses_demo_3", title: "كتابة اختبارات لوحدة المصادقة", updated: now - 26 * 3_600_000, created: now - 28 * 3_600_000, tokens: 12_004 },
  { id: "ses_demo_4", title: "مراجعة تغييرات فرع الميزات", updated: now - 2 * 86_400_000, created: now - 2 * 86_400_000, tokens: 9_870 },
  { id: "ses_demo_5", title: "ترقية الحزم وتحسين البناء", updated: now - 5 * 86_400_000, created: now - 5 * 86_400_000, tokens: 21_300 },
];

const readOutput = `import { useState } from 'react'
import { Chat } from './Chat'

export function App() {
  return (
    <div className="app">
      <Chat />
    </div>
  )
}`;

const explainText = `## خطة التنفيذ

الطريقة الأنظف هي جعل الاتجاه حالة واحدة على مستوى الواجهة، ثم اشتقاقه من اللغة:

- ضع \`dir\` على العنصر الجذري فقط
- استخدم خصائص CSS المنطقية مثل \`padding-inline\` و\`margin-inline\`
- ثبّت بلوكات الكود على LTR حتى لا ينعكس الكود

\`\`\`tsx
const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl')

return (
  <div dir={dir} className="app">
    <Chat />
  </div>
)
\`\`\`

> لا تستخدم \`left\` أو \`right\` أو \`float\` — استخدم \`start\` و\`end\` حتى تنعكس الواجهة تلقائياً.

بعدها أضفت زراً في الهيدر يبدّل الاتجاه فوراً، وربطته بإعداد VS Code حتى يبقى محفوظاً.`;

const summaryText = `### الخلاصة

- الاتجاه أصبح تلقائياً حسب لغة الواجهة
- زر التبديل ظاهر في الهيدر ويعمل أثناء المحادثة
- الكود والأوامر تبقى دائماً من اليسار إلى اليمين
- تم التحقق من البناء بدون أخطاء

الخطوة التالية المقترحة: إضافة اختصار لوحة مفاتيح لتبديل الاتجاه.`;

const messages: ChatMessage[] = [
  {
    info: {
      id: "msg_demo_u1",
      sessionID: "ses_demo_1",
      role: "user",
      time: { created: now - 240_000 },
    },
    parts: [
      {
        id: "prt_demo_u1",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_u1",
        type: "text",
        text: "أبغى أضيف دعم RTL لواجهة المحادثة في VS Code. وش أفضل طريقة؟",
      },
    ],
  },
  {
    info: {
      id: "msg_demo_a1",
      sessionID: "ses_demo_1",
      role: "assistant",
      time: { created: now - 230_000, completed: now - 180_000 },
      modelID: "deepseek-v4.1-flash-free",
      providerID: "opencode",
      agent: "build",
      tokens: { input: 18_340, output: 2_641 },
      cost: 0.0124,
    },
    parts: [
      {
        id: "prt_demo_r1",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a1",
        type: "reasoning",
        text: "المستخدم يريد دعماً كاملاً للاتجاه من اليمين إلى اليسار دون كسر الكود. سأشرح المبدأ أولاً ثم أفحص الملفات الحالية قبل التعديل.",
        time: { start: now - 230_000, end: now - 225_000 },
      },
      {
        id: "prt_demo_t1",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a1",
        type: "text",
        text: explainText,
      },
      {
        id: "prt_demo_tool1",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a1",
        type: "tool",
        callID: "call_read_1",
        tool: "read",
        state: {
          status: "completed",
          input: { filePath: "webview/App.tsx" },
          title: "webview/App.tsx",
          output: readOutput,
          metadata: {},
          time: { start: now - 224_000, end: now - 223_800 },
        },
      },
      {
        id: "prt_demo_t2",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a1",
        type: "text",
        text: "بعد قراءة الملف، طبّقت التعديلات على الغلاف الجذري وأضفت زر التبديل:",
      },
      {
        id: "prt_demo_tool2",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a1",
        type: "tool",
        callID: "call_bash_1",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "npm run build" },
          title: "npm run build",
          output: "dist/extension.js   148.2kb\n⚡ Done in 212ms",
          metadata: {},
          time: { start: now - 200_000, end: now - 198_000 },
        },
      },
      {
        id: "prt_demo_t3",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a1",
        type: "text",
        text: summaryText,
      },
    ],
  },
  {
    info: {
      id: "msg_demo_u2",
      sessionID: "ses_demo_1",
      role: "user",
      time: { created: now - 120_000 },
    },
    parts: [
      {
        id: "prt_demo_u2",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_u2",
        type: "text",
        text: "ممتاز. أضف زر تبديل اللغة أيضاً، وخله صغير وواضح في الهيدر.",
      },
    ],
  },
  {
    info: {
      id: "msg_demo_a2",
      sessionID: "ses_demo_1",
      role: "assistant",
      time: { created: now - 110_000, completed: now - 80_000 },
      modelID: "deepseek-v4.1-flash-free",
      providerID: "opencode",
      agent: "build",
      tokens: { input: 21_020, output: 1_105 },
      cost: 0.0082,
    },
    parts: [
      {
        id: "prt_demo_r2",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a2",
        type: "reasoning",
        text: "التبديل يجب أن يغيّر اللغة والاتجاه معاً، لذلك سأربطه بإعداد واحد.",
        time: { start: now - 110_000, end: now - 108_000 },
      },
      {
        id: "prt_demo_t4",
        sessionID: "ses_demo_1",
        messageID: "msg_demo_a2",
        type: "text",
        text:
          "تم. زر اللغة الآن يعرض \`EN\` و**ع** فقط، ويتغير معه الاتجاه تلقائياً إذا كان الإعداد على «تلقائي».\n\n" +
          "أضفت أيضاً تلميحاً عند المرور عليه يوضح اللغة القادمة، وحفظت الاختيار في إعدادات مساحة العمل.",
      },
    ],
  },
];

const demoTodos: TodoItem[] = [
  { content: "فحص الملفات الحالية وفهم بنية الواجهة", status: "completed", priority: "high" },
  { content: "إضافة الاتجاه الجذري وزر التبديل", status: "completed", priority: "high" },
  { content: "دعم اللغة العربية في نصوص الواجهة", status: "completed", priority: "medium" },
  { content: "التحقق من البناء واختبار الواجهة", status: "in_progress", priority: "high" },
  { content: "توثيق الإعدادات الجديدة", status: "pending", priority: "low" },
];

const demoPermissions: PermissionRequest[] = [
  {
    id: "per_demo_1",
    sessionID: "ses_demo_1",
    permission: "bash",
    patterns: ["npm run test -- --watch=false"],
    always: [],
    metadata: {},
  },
];

const demoQuestions: QuestionRequest[] = [
  {
    id: "que_demo_1",
    sessionID: "ses_demo_1",
    questions: [
      {
        header: "طريقة الاختبار",
        question: "كيف تفضّل أن نتحقق من التغييرات؟",
        options: [
          { label: "اختبارات آلية", description: "تشغيل مجموعة الاختبارات كاملة" },
          { label: "بناء سريع", description: "التأكد من نجاح البناء فقط" },
          { label: "مراجعة يدوية", description: "أعرض لك الملفات المعدلة" },
        ],
        multiple: false,
        custom: true,
      },
    ],
  },
];

function bootstrap(prefs: UiPrefs): Bootstrap {
  const cards = typeof location !== "undefined" && location.hash.includes("cards");
  const empty = typeof location !== "undefined" && location.search.includes("empty=1");
  return {
    connection: { phase: "ready", url: "http://127.0.0.1:4096", version: "1.19.5", managed: true, executable: "opencode" },
    ui: prefs,
    models,
    agents: [
      { name: "build", description: "The default agent. Executes tools based on configured permissions.", mode: "primary", native: true },
      { name: "plan", description: "Read-only planning agent.", mode: "primary", native: true },
      { name: "explore", description: "Fast codebase exploration.", mode: "subagent", native: true },
    ],
    sessions,
    currentSession: empty ? null : sessions[0],
    messages: empty ? [] : messages,
    todos: empty ? [] : demoTodos,
    permissions: cards ? demoPermissions : [],
    questions: cards ? demoQuestions : [],
    selectedModel: { providerID: "opencode", modelID: "deepseek-v4.1-flash-free" },
    selectedAgent: "build",
    status: { type: "idle" },
    workspaceName: "rtl-opencode",
    hasWorkspace: true,
    version: "0.1.0",
  };
}

export function createMockBridge(): BridgeApi {
  const params = new URLSearchParams(location.search);
  const language = params.get("lang") === "en" ? "en" : "ar";
  let prefs: UiPrefs = {
    language,
    languageSetting: "auto",
    direction: language === "en" ? "ltr" : "rtl",
    directionSetting: "auto",
    fontSize: 14,
    showReasoning: false,
    sendKey: "enter",
    compact: false,
    codeWrap: true,
  };
  let state = bootstrap(prefs);
  const demoDiff: SessionDiffFile[] = [
    {
      file: "webview/App.tsx",
      status: "modified",
      additions: 18,
      deletions: 3,
      patch:
        "@@ -12,7 +12,9 @@ export function App() {\n   const { messages } = useChat()\n-  return <Chat messages={messages} />\n+  const [dir] = useDirection()\n+  return (\n+    <div dir={dir}>{<Chat messages={messages} />}</div>\n+  )\n }",
    },
    {
      file: "webview/styles.css",
      status: "modified",
      additions: 42,
      deletions: 6,
      patch: "@@ -88,4 +88,6 @@ .app {\n-  margin-left: 0;\n+  margin-inline-start: 0;\n+  direction: inherit;\n }",
    },
  ];
  const handlers = new Set<(message: HostMessage) => void>();
  const timers: number[] = [];

  const emit = (message: HostMessage) => {
    for (const handler of handlers) handler(message);
  };

  const clearTimers = () => {
    while (timers.length) window.clearTimeout(timers.pop()!);
  };

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
  };

  const send = (message: HostMessage) => emit(message);

  const simulateReply = (text: string) => {
    const userId = `msg_user_${Date.now()}`;
    const assistantId = `msg_asst_${Date.now()}`;
    const created = Date.now();
    const userPart: ChatPart = {
      id: `prt_${userId}`,
      sessionID: state.currentSession!.id,
      messageID: userId,
      type: "text",
      text,
    };
    send({
      type: "event",
      payload: {
        sessionId: state.currentSession!.id,
        event: { type: "message.updated", properties: { sessionID: state.currentSession!.id, info: { id: userId, sessionID: state.currentSession!.id, role: "user", time: { created } } } },
      },
    });
    send({ type: "event", payload: { sessionId: state.currentSession!.id, event: { type: "message.part.updated", properties: { sessionID: state.currentSession!.id, part: userPart } } } });
    send({ type: "status", payload: { sessionId: state.currentSession!.id, status: { type: "busy" } } });

    later(() => {
      send({
        type: "event",
        payload: {
          sessionId: state.currentSession!.id,
          event: {
            type: "message.updated",
            properties: {
              sessionID: state.currentSession!.id,
              info: {
                id: assistantId,
                sessionID: state.currentSession!.id,
                role: "assistant",
                time: { created: Date.now() },
                modelID: "deepseek-v4.1-flash-free",
                providerID: "opencode",
                agent: "build",
              },
            },
          },
        },
      });
      const reasoningId = `prt_reason_${Date.now()}`;
      const textId = `prt_text_${Date.now()}`;
      send({
        type: "event",
        payload: {
          sessionId: state.currentSession!.id,
          event: {
            type: "message.part.updated",
            properties: {
              sessionID: state.currentSession!.id,
              part: { id: reasoningId, sessionID: state.currentSession!.id, messageID: assistantId, type: "reasoning", text: "أفهم الطلب، سأراجع الملفات المتعلقة ثم أرد بخطوات عملية.", time: { start: Date.now() } },
            },
          },
        },
      });
      send({
        type: "event",
        payload: {
          sessionId: state.currentSession!.id,
          event: {
            type: "message.part.updated",
            properties: {
              sessionID: state.currentSession!.id,
              part: { id: textId, sessionID: state.currentSession!.id, messageID: assistantId, type: "text", text: "" },
            },
          },
        },
      });

      const reply =
        "تمام، هذا عرض تجريبي للواجهة. في النسخة الحقيقية سيصل الرد مباشرة من OpenCode المحلي على جهازك، مع أدوات الملفات والطرفية.\n\n" +
        "جرّب:\n\n- تبديل الاتجاه من الهيدر\n- فتح المحادثات السابقة\n- تغيير النموذج\n- إرفاق صورة أو تحديد من المحرر";
      const words = reply.split(" ");
      let index = 0;
      const tick = () => {
        if (index >= words.length) {
          send({ type: "status", payload: { sessionId: state.currentSession!.id, status: { type: "idle" } } });
          return;
        }
        const delta = (index === 0 ? "" : " ") + words[index++];
        send({
          type: "event",
          payload: {
            sessionId: state.currentSession!.id,
            event: { type: "message.part.delta", data: { sessionID: state.currentSession!.id, messageID: assistantId, partID: textId, field: "text", delta } },
          },
        });
        later(tick, 38);
      };
      later(tick, 140);
    }, 420);
  };

  return {
    preview: true,
    post(message: ClientMessage) {
      switch (message.type) {
        case "ready":
          send({ type: "init", payload: { ...state, ui: prefs } });
          break;
        case "submit":
          simulateReply(message.text);
          break;
        case "abort":
          clearTimers();
          send({ type: "status", payload: { sessionId: state.currentSession!.id, status: { type: "idle" } } });
          send({ type: "toast", payload: { kind: "info", message: "تم الإيقاف" } });
          break;
        case "newSession": {
          const session: SessionSummary = {
            id: `ses_${Date.now()}`,
            title: message.title || "محادثة جديدة",
            created: Date.now(),
            updated: Date.now(),
          };
          state = { ...state, currentSession: session, sessions: [session, ...state.sessions], messages: [], todos: [] };
          send({ type: "sessions", payload: state.sessions });
          send({ type: "session", payload: { session, status: { type: "idle" } } });
          send({ type: "history", payload: { sessionId: session.id, messages: [], todos: [], permissions: [], questions: [], status: { type: "idle" } } });
          break;
        }
        case "selectSession": {
          const session = state.sessions.find((entry) => entry.id === message.id) || null;
          const isDemo = session?.id === "ses_demo_1";
          state = {
            ...state,
            currentSession: session,
            messages: isDemo ? messages : [],
            todos: isDemo ? demoTodos : [],
          };
          send({ type: "session", payload: { session, status: { type: "idle" } } });
          send({
            type: "history",
            payload: {
              sessionId: session?.id || "",
              messages: state.messages,
              todos: state.todos,
              permissions: [],
              questions: [],
              status: { type: "idle" },
            },
          });
          break;
        }
        case "deleteSession": {
          state = { ...state, sessions: state.sessions.filter((entry) => entry.id !== message.id) };
          send({ type: "sessions", payload: state.sessions });
          if (state.currentSession?.id === message.id) {
            const next = state.sessions[0] || null;
            state = { ...state, currentSession: next, messages: next?.id === "ses_demo_1" ? messages : [] };
            send({ type: "session", payload: { session: next, status: { type: "idle" } } });
          }
          send({ type: "toast", payload: { kind: "success", message: "تم حذف المحادثة" } });
          break;
        }
        case "forkSession": {
          const source = state.sessions.find((entry) => entry.id === message.id);
          const session: SessionSummary = { id: `ses_${Date.now()}`, title: `نسخة من ${source?.title || "محادثة"}`, created: Date.now(), updated: Date.now() };
          state = { ...state, sessions: [session, ...state.sessions], currentSession: session, messages: [] };
          send({ type: "sessions", payload: state.sessions });
          send({ type: "session", payload: { session, status: { type: "idle" } } });
          send({ type: "toast", payload: { kind: "success", message: "تم نسخ المحادثة" } });
          break;
        }
        case "setUi": {
          const patch = message.patch;
          prefs = { ...prefs, ...patch };
          if (patch.language || patch.languageSetting) {
            const lang = patch.language || (patch.languageSetting === "auto" ? "ar" : patch.languageSetting);
            prefs.language = lang as UiPrefs["language"];
            if (prefs.directionSetting === "auto") prefs.direction = lang === "ar" ? "rtl" : "ltr";
          }
          if (patch.direction) prefs.direction = patch.direction;
          send({ type: "ui", payload: prefs });
          break;
        }
        case "selectModel": {
          const model = models.find((entry) => entry.id === message.modelID);
          state = { ...state, selectedModel: { providerID: message.providerID, modelID: message.modelID } };
          send({ type: "models", payload: { models, selected: state.selectedModel } });
          send({ type: "toast", payload: { kind: "success", message: `النموذج: ${model?.name || message.modelID}` } });
          break;
        }
        case "selectAgent":
          state = { ...state, selectedAgent: message.agent };
          send({ type: "agents", payload: { agents: state.agents, selected: message.agent } });
          send({ type: "toast", payload: { kind: "success", message: `الوكيل: ${message.agent}` } });
          break;
        case "replyPermission":
          send({ type: "permissions", payload: { sessionId: state.currentSession?.id || "", requests: [] } });
          send({ type: "toast", payload: { kind: "success", message: "تم منح الإذن" } });
          break;
        case "replyQuestion":
          send({ type: "questions", payload: { sessionId: state.currentSession?.id || "", requests: [] } });
          send({ type: "toast", payload: { kind: "success", message: "تم إرسال الإجابة" } });
          break;
        case "rejectQuestion":
          send({ type: "questions", payload: { sessionId: state.currentSession?.id || "", requests: [] } });
          break;
        case "getDiff":
          send({ type: "diff", payload: { sessionId: message.sessionId, files: demoDiff } });
          break;
        case "command": {
          if (message.name === "toggleDirection") {
            prefs = { ...prefs, direction: prefs.direction === "rtl" ? "ltr" : "rtl" };
            send({ type: "ui", payload: prefs });
            send({ type: "toast", payload: { kind: "info", message: prefs.direction === "rtl" ? "الاتجاه: من اليمين إلى اليسار" : "الاتجاه: من اليسار إلى اليمين" } });
          } else if (message.name === "openDiff") {
            send({ type: "diff", payload: { sessionId: state.currentSession?.id || "", files: demoDiff } });
          } else if (message.name === "exportMarkdown") {
            send({ type: "toast", payload: { kind: "success", message: "تم تصدير المحادثة (عرض تجريبي)" } });
          } else if (message.name === "restartServer") {
            send({ type: "connection", payload: { phase: "starting" } });
            later(() => {
              send({ type: "connection", payload: { phase: "ready", url: "http://127.0.0.1:4096", version: "1.19.5", managed: true } });
              send({ type: "toast", payload: { kind: "success", message: "تم تشغيل الخادم" } });
            }, 900);
          } else {
            send({ type: "toast", payload: { kind: "info", message: `عرض تجريبي: ${message.name}` } });
          }
          break;
        }
        case "copyText":
          void navigator.clipboard?.writeText(message.text);
          send({ type: "toast", payload: { kind: "success", message: "تم النسخ إلى الحافظة" } });
          break;
        case "insertText":
        case "openFile":
        case "openUrl":
          send({ type: "toast", payload: { kind: "info", message: `عرض تجريبي: ${message.type}` } });
          break;
        case "pickFiles":
        case "attachSelection":
        case "attachActiveFile":
          break;
        case "refreshSessions":
          send({ type: "sessions", payload: state.sessions });
          break;
        default:
          break;
      }
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
