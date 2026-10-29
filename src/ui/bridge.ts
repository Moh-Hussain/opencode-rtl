import * as vscode from "vscode";
import type { ClientMessage, HostMessage } from "../shared/protocol";
import type { ChatHub } from "../core/hub";
import { renderWebviewHtml } from "./html";

export class ChatWebviewBridge implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private alive = true;

  constructor(
    private readonly webview: vscode.Webview,
    private readonly hub: ChatHub,
    extensionUri: vscode.Uri,
    compact: boolean,
  ) {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist"), vscode.Uri.joinPath(extensionUri, "media")],
    };
    webview.html = renderWebviewHtml(webview, extensionUri, { compact });

    this.disposables.push(
      webview.onDidReceiveMessage((message: ClientMessage) => {
        if (!this.alive) return;
        this.hub.handleClientMessage(message).catch((error) => {
          this.post({
            type: "error",
            payload: { message: error instanceof Error ? error.message : String(error) },
          });
        });
      }),
    );

    this.disposables.push(this.hub.register((message) => this.post(message)));
    this.disposables.push(vscode.workspace.onDidChangeConfiguration((event) => this.onConfig(event)));
  }

  private onConfig(event: vscode.ConfigurationChangeEvent) {
    if (event.affectsConfiguration("opencodeRtl")) {
      // The hub reads configuration on demand; ask it for a fresh bootstrap-like update.
      this.hub.broadcastAll({ type: "ui", payload: this.hub.snapshot().ui });
    }
  }

  private post(message: HostMessage) {
    if (!this.alive) return;
    void this.webview.postMessage(message);
  }

  focusInput() {
    this.post({ type: "draft", payload: { id: `focus-${Date.now()}`, focus: true } });
  }

  dispose() {
    this.alive = false;
    for (const disposable of this.disposables) disposable.dispose();
  }
}
