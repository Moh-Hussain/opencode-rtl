import { useMemo } from "preact/hooks";
import { useApp } from "../context";
import { renderMarkdown } from "../markdown";

export function Markdown({ text, className }: { text: string; className?: string }) {
  const { state, t, post } = useApp();
  const html = useMemo(() => renderMarkdown(text || "", state.ui.language), [text, state.ui.language]);

  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const copyButton = target.closest<HTMLButtonElement>(".code-copy");
    if (copyButton) {
      const block = copyButton.closest(".code-block");
      const code = block?.querySelector("pre")?.textContent || "";
      post({ type: "copyText", text: code });
      copyButton.classList.add("is-copied");
      const label = copyButton.querySelector("span");
      const previous = label?.textContent || "";
      if (label) label.textContent = t("message.copied");
      window.setTimeout(() => {
        copyButton.classList.remove("is-copied");
        if (label) label.textContent = previous;
      }, 1500);
      return;
    }
    const link = target.closest<HTMLElement>("[data-href]");
    if (link) {
      event.preventDefault();
      const href = link.dataset.href;
      if (href) post({ type: "openUrl", url: href });
    }
  };

  return (
    <div
      class={`md ${className || ""}`}
      dir="auto"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
