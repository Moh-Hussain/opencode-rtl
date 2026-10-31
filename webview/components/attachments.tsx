import { useState } from "preact/hooks";
import type { Attachment, FilePart } from "../../src/shared/types";
import { useApp } from "../context";
import { basename } from "../format";
import { Icon, IconButton, Lightbox } from "./ui";

export function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: (id: string) => void;
}) {
  const { t, post } = useApp();
  const [zoom, setZoom] = useState(false);
  const isImage = attachment.kind === "image" && Boolean(attachment.preview);
  const label =
    attachment.kind === "selection"
      ? `${basename(attachment.path || attachment.name)} · ${attachment.range?.start}-${attachment.range?.end}`
      : attachment.name;

  return (
    <div class={`attachment ${isImage ? "attachment-image" : ""}`} title={attachment.path || attachment.name}>
      {isImage ? (
        <button
          type="button"
          class="attachment-thumb-btn"
          aria-label={t("image.preview")}
          title={t("image.preview")}
          onClick={() => setZoom(true)}
        >
          <img class="attachment-thumb" src={attachment.preview} alt={label} />
        </button>
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
      {attachment.path && !onRemove && !isImage ? (
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
      {zoom && attachment.preview ? (
        <Lightbox src={attachment.preview} alt={label} onClose={() => setZoom(false)} />
      ) : null}
    </div>
  );
}

export function FilePartChip({ part }: { part: FilePart }) {
  const { state, t, post } = useApp();
  const [zoom, setZoom] = useState(false);
  const name = part.filename || basename(part.url || "");
  const rawUrl = part.url || "";
  const dataUrl = rawUrl.startsWith("data:") ? rawUrl : "";
  let path = "";
  if (rawUrl.startsWith("file:")) {
    const raw = rawUrl.replace(/^file:\/\//, "");
    try {
      path = decodeURIComponent(raw);
    } catch {
      path = raw;
    }
  }
  const isImage = (part.mime || "").startsWith("image/") && Boolean(path || dataUrl);
  const src = dataUrl || (path ? state.images[path] : undefined);

  const open = () => {
    if (isImage) {
      setZoom(true);
      if (!dataUrl && path && state.images[path] === undefined) post({ type: "previewImage", path });
      return;
    }
    if (path) post({ type: "openFile", path });
  };

  return (
    <>
      <button type="button" class="file-chip" onClick={open} title={isImage ? t("image.preview") : part.url}>
        <Icon name={isImage ? "image" : "file"} size={14} />
        <span>{name}</span>
        <span class="file-chip-meta">{t("message.attached")}</span>
      </button>
      {zoom ? <Lightbox src={isImage ? src : undefined} alt={name} onClose={() => setZoom(false)} /> : null}
    </>
  );
}
