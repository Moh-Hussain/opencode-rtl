import type { Attachment, FilePart } from "../../src/shared/types";
import { useApp } from "../context";
import { basename } from "../format";
import { Icon, IconButton } from "./ui";

export function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: (id: string) => void;
}) {
  const { t, post } = useApp();
  const isImage = attachment.kind === "image" && attachment.preview;
  const label =
    attachment.kind === "selection"
      ? `${basename(attachment.path || attachment.name)} · ${attachment.range?.start}-${attachment.range?.end}`
      : attachment.name;

  return (
    <div class={`attachment ${isImage ? "attachment-image" : ""}`} title={attachment.path || attachment.name}>
      {isImage ? (
        <img class="attachment-thumb" src={attachment.preview} alt="" />
      ) : (
        <span class="attachment-icon">
          <Icon name={attachment.kind === "selection" ? "code" : attachment.kind === "image" ? "image" : "file"} size={15} />
        </span>
      )}
      <span class="attachment-meta">
        <span class="attachment-name">{label}</span>
        <span class="attachment-kind">
          {attachment.kind === "selection"
            ? `${t("composer.lines")} ${attachment.range?.start}-${attachment.range?.end}`
            : attachment.kind === "image"
              ? t("composer.attachImage")
              : (attachment.mime || t("composer.files")).replace("text/", "")}
        </span>
      </span>
      {attachment.path && !onRemove ? (
        <button
          type="button"
          class="attachment-open"
          aria-label={t("tool.openFile")}
          onClick={() => post({ type: "openFile", path: attachment.path!, line: attachment.range?.start })}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      ) : null}
      {onRemove ? (
        <IconButton
          icon="x"
          label={t("composer.remove")}
          size={12}
          className="attachment-remove"
          onClick={() => onRemove(attachment.id)}
        />
      ) : null}
    </div>
  );
}

export function FilePartChip({ part }: { part: FilePart }) {
  const { t, post } = useApp();
  const name = part.filename || basename(part.url || "");
  const isImage = (part.mime || "").startsWith("image/");
  return (
    <button
      type="button"
      class="file-chip"
      onClick={() => {
        const path = decodeURIComponent((part.url || "").replace(/^file:\/\//, ""));
        if (path) post({ type: "openFile", path });
      }}
      title={part.url}
    >
      <Icon name={isImage ? "image" : "file"} size={14} />
      <span>{name}</span>
      <span class="file-chip-meta">{t("message.attached")}</span>
    </button>
  );
}
