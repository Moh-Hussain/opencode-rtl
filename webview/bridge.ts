import type { ClientMessage, HostMessage } from "../src/shared/protocol";
import { createMockBridge } from "./mock";

export interface BridgeApi {
  post(message: ClientMessage): void;
  subscribe(handler: (message: HostMessage) => void): () => void;
  preview: boolean;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare const acquireVsCodeApi: (() => VsCodeApi) | undefined;

let cachedApi: VsCodeApi | undefined;

function hostApi(): VsCodeApi {
  if (!cachedApi) cachedApi = acquireVsCodeApi!();
  return cachedApi;
}

export function hasHost(): boolean {
  return typeof acquireVsCodeApi === "function";
}

export function createHostBridge(): BridgeApi {
  const api = hostApi();
  return {
    preview: false,
    post(message) {
      api.postMessage(message);
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== "object" || typeof (data as HostMessage).type !== "string") return;
        handler(data as HostMessage);
      };
      window.addEventListener("message", listener);
      return () => window.removeEventListener("message", listener);
    },
  };
}

export function createBridge(): BridgeApi {
  if (hasHost()) return createHostBridge();
  return createMockBridge();
}

export function resolveView(): "sidebar" | "panel" {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("view");
  if (requested === "panel" || requested === "sidebar") return requested;
  return document.body.dataset.view === "panel" ? "panel" : "sidebar";
}
