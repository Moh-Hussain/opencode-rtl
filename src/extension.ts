import * as vscode from "vscode";
import { ChatHub } from "./core/hub";
import { ChatPanel } from "./ui/panel";
import { ChatViewProvider } from "./ui/view";

let hub: ChatHub | undefined;
let output: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("OpenCode RTL");
  context.subscriptions.push(output);

  hub = new ChatHub({ context, output });
  const extensionUri = context.extensionUri;
  const provider = new ChatViewProvider(extensionUri, hub);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
  context.subscriptions.push(provider);

  const config = () => vscode.workspace.getConfiguration("opencodeRtl");

  const openChat = async (options: { attachSelection?: boolean; focus?: boolean } = {}) => {
    const target = config().get<string>("openIn") || "sidebar";
    if (target === "panel") {
      ChatPanel.createOrShow(hub!, extensionUri);
      if (options.focus) ChatPanel.instance?.focusInput();
    } else {
      await vscode.commands.executeCommand("workbench.view.extension.opencodeRtl");
      await vscode.commands.executeCommand("opencodeRtl.chat.focus");
      if (options.focus) provider.focusInput();
    }
    if (options.attachSelection !== false && config().get<boolean>("autoAttachSelection")) {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) await hub!.attachSelection();
    }
  };

  const commands: Array<[string, (...args: any[]) => any]> = [
    ["opencodeRtl.openChat", () => openChat({ focus: true })],
    [
      "opencodeRtl.openPanel",
      () => {
        ChatPanel.createOrShow(hub!, extensionUri);
      },
    ],
    [
      "opencodeRtl.newSession",
      async () => {
        await openChat({ attachSelection: false });
        await hub!.newSession();
        provider.focusInput();
      },
    ],
    [
      "opencodeRtl.sendSelection",
      async () => {
        await openChat({ attachSelection: false });
        await hub!.sendSelection("send");
      },
    ],
    [
      "opencodeRtl.explainSelection",
      async () => {
        await openChat({ attachSelection: false });
        await hub!.sendSelection("explain");
      },
    ],
    [
      "opencodeRtl.fixSelection",
      async () => {
        await openChat({ attachSelection: false });
        await hub!.sendSelection("fix");
      },
    ],
    ["opencodeRtl.toggleDirection", () => hub!.toggleDirection()],
    [
      "opencodeRtl.pickModel",
      async () => {
        await hub!.initialize();
        await hub!.pickModel();
      },
    ],
    [
      "opencodeRtl.pickAgent",
      async () => {
        await hub!.initialize();
        await hub!.pickAgent();
      },
    ],
    [
      "opencodeRtl.restartServer",
      async () => {
        await hub!.initialize(true);
        await openChat({ attachSelection: false });
      },
    ],
    ["opencodeRtl.openSettings", () => vscode.commands.executeCommand("workbench.action.openSettings", "opencodeRtl")],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async (...args: any[]) => {
        try {
          await handler(...args);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          output?.appendLine(`[command:${id}] ${message}`);
          void vscode.window.showErrorMessage(`OpenCode RTL: ${message}`);
        }
      }),
    );
  }

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  status.name = "OpenCode RTL";
  status.command = "opencodeRtl.openChat";
  status.show();
  context.subscriptions.push(status);

  const updateStatus = () => {
    if (!hub) return;
    const connection = hub.connectionState;
    const model = hub.selectedModelLabel;
    if (connection.phase === "error") {
      status.text = "$(warning) OpenCode RTL";
      status.tooltip = `OpenCode RTL: ${connection.error || "Connection error"}\nClick to open chat`;
      status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else if (connection.phase === "starting") {
      status.text = "$(sync~spin) OpenCode";
      status.tooltip = "Starting OpenCode server…";
      status.backgroundColor = undefined;
    } else if (connection.phase === "ready" || connection.phase === "external") {
      status.text = `$(sparkle) ${model.length > 26 ? model.slice(0, 25) + "…" : model}`;
      status.tooltip = `OpenCode RTL · ${connection.url || ""}\nModel: ${model}\nClick to open chat`;
      status.backgroundColor = undefined;
    } else {
      status.text = "$(sparkle) OpenCode RTL";
      status.tooltip = "OpenCode RTL — click to start chatting";
      status.backgroundColor = undefined;
    }
  };
  updateStatus();
  context.subscriptions.push(hub.onDidChangeState(updateStatus));

  context.subscriptions.push(
    hub.onDidRequestOpen((target) => {
      if (target === "panel") ChatPanel.createOrShow(hub!, extensionUri);
      else void openChat({ attachSelection: false, focus: true });
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("opencodeRtl.serverUrl") || event.affectsConfiguration("opencodeRtl.executable")) {
        output?.appendLine("[extension] server configuration changed; restart the server to apply");
      }
      updateStatus();
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      hub?.dispose();
      hub = undefined;
    },
  });

  void hub.initialize();
  output.appendLine(`[extension] OpenCode RTL activated (v${context.extension.packageJSON.version})`);
}

export function deactivate(): void {
  hub?.dispose();
  hub = undefined;
  output = undefined;
}
