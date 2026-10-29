import * as vscode from "vscode";
import type { ChatHub } from "../core/hub";
import { ChatWebviewBridge } from "./bridge";

export class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = "opencodeRtl.chat";
  private bridge?: ChatWebviewBridge;
  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly hub: ChatHub,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist"), vscode.Uri.joinPath(this.extensionUri, "media")],
    };
    this.bridge?.dispose();
    const bridge = new ChatWebviewBridge(webviewView.webview, this.hub, this.extensionUri, true);
    this.bridge = bridge;
    webviewView.onDidDispose(
      () => {
        if (this.bridge !== bridge) return;
        bridge.dispose();
        this.bridge = undefined;
        this.view = undefined;
      },
      null,
      this.disposables,
    );
  }

  focusInput() {
    this.view?.show?.(true);
    this.bridge?.focusInput();
  }

  dispose() {
    this.bridge?.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }
}
