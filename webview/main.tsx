import { render } from "preact";
import { createBridge, hasHost, resolveView } from "./bridge";
import { App } from "./components/App";

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme");
if (theme === "dark") document.body.classList.add("vscode-dark");
if (theme === "light") document.body.classList.add("vscode-light");
if (!hasHost()) document.body.classList.add("is-preview");

const root = document.getElementById("root");
if (root) {
  render(<App bridge={createBridge()} view={resolveView()} />, root);
}
