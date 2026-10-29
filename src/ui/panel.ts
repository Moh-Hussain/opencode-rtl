import * as vscode from "vscode";
import type { ChatHub } from "../core/hub";
import { ChatWebviewBridge } from "./bridge";

export class ChatPanel {
  private static current?: ChatPanel;
  private readonly bridge: ChatWebviewBridge;
  private readonly disposables: vscode.Disposable[] = [];
  private disposed = false;

  static createOrShow(hub: ChatHub, extensionUri: vscode.Uri): ChatPanel {
    if (ChatPanel.current) {
      ChatPanel.current.panel.reveal(vscode.ViewColumn.Beside, false);
      return ChatPanel.current;
    }
    const panel = vscode.window.createWebviewPanel("opencodeRtl.chatPanel", "OpenCode RTL", vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")],
    });
    ChatPanel.current = new ChatPanel(panel, hub, extensionUri);
    return ChatPanel.current;
  }

  static get instance(): ChatPanel | undefined {
    return ChatPanel.current;
  }

  private constructor(
    readonly panel: vscode.WebviewPanel,
    hub: ChatHub,
    extensionUri: vscode.Uri,
  ) {
    this.bridge = new ChatWebviewBridge(panel.webview, hub, extensionUri, false);
    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, "media", "icon.png");
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  focusInput() {
    this.panel.reveal(vscode.ViewColumn.Beside, false);
    this.bridge.focusInput();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (ChatPanel.current === this) ChatPanel.current = undefined;
    this.bridge.dispose();
    this.panel.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }
}
