import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { useApp } from "../context";

export type IconName =
  | "plus"
  | "chat"
  | "settings"
  | "sliders"
  | "swap"
  | "chevron-down"
  | "chevron-right"
  | "chevron-left"
  | "send"
  | "stop"
  | "clip"
  | "image"
  | "code"
  | "terminal"
  | "search"
  | "folder"
  | "file"
  | "wrench"
  | "brain"
  | "x"
  | "more"
  | "trash"
  | "fork"
  | "download"
  | "refresh"
  | "alert"
  | "check"
  | "check-circle"
  | "circle"
  | "loader"
  | "list"
  | "external"
  | "panel"
  | "message"
  | "copy"
  | "insert"
  | "globe"
  | "keyboard"
  | "diff"
  | "sparkle"
  | "book"
  | "arrow-up"
  | "clock"
  | "user"
  | "stop-circle";

const paths: Record<IconName, ComponentChildren> = {
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 9 9 0 0 1-3.8-.8L3 21l1.9-5.2A8 8 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>
  ),
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  send: <path d="m5 12 14-7-4 14-3-5-7-2Z" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  "stop-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" />
    </>
  ),
  clip: <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-2.8-2.8l7.3-7.3" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 3.5 3.5L16 13l4 4" />
    </>
  ),
  code: <path d="m9 8-5 4 5 4M15 8l5 4-5 4" />,
  terminal: <path d="m5 7 5 5-5 5M13 17h6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.8 2.8 0 0 1-4-4l9.4-9.4a4 4 0 0 0-1-1Z" />,
  brain: (
    <>
      <path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-1 5.8A3 3 0 0 0 7.5 16 3 3 0 0 0 12 19Zm0 0a3 3 0 0 1 6 0 3 3 0 0 1 1 5.8A3 3 0 0 1 16.5 16 3 3 0 0 1 12 19Z" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v5M14 11v5" />,
  fork: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M6 8.4v2A2.6 2.6 0 0 0 8.6 13h6.8A2.6 2.6 0 0 0 18 10.4v-2M12 13v2.6" />
    </>
  ),
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  alert: (
    <>
      <path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 16.6v.1" />
    </>
  ),
  check: <path d="m4 12.5 5 5L20 6.5" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.6 2.6L16 9.5" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="8" />,
  loader: <path d="M12 3a9 9 0 1 0 9 9" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.1M3.5 12h.1M3.5 18h.1" />,
  external: <path d="M14 4h6v6M20 4l-8 8M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />,
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </>
  ),
  message: <path d="M4 5h16v11H9l-5 4Z" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  insert: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17h16v3H4z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.1M10 10h.1M14 10h.1M18 10h.1M7 14h10" />
    </>
  ),
  diff: <path d="M6 3v12a3 3 0 0 0 3 3h6M6 3 3 6m3-3 3 3M18 21V9a3 3 0 0 0-3-3H9m9 15-3-3m3 3 3-3" />,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />,
  "arrow-up": <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      class={`icon ${className || ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Logo({ size = 30, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <span class={`logo ${glow ? "logo-glow" : ""}`} style={{ width: `${size}px`, height: `${size}px` }}>
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#F0996F" />
            <stop offset="55%" stop-color="#E8734F" />
            <stop offset="100%" stop-color="#C9522F" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9.5" fill="url(#logo-grad)" />
        <path
          d="M9 12.4C9 10.5 10.5 9 12.4 9h7.2C21.5 9 23 10.5 23 12.4v5.2c0 1.9-1.5 3.4-3.4 3.4h-5.3l-3.6 2.6v-2.6h-.3C10.5 21 9 19.5 9 17.6Z"
          fill="#fff"
          opacity="0.96"
        />
        <circle cx="16" cy="15" r="2" fill="#E8734F" />
      </svg>
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  small,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  small?: boolean;
}) {
  return (
    <div class={`segmented ${small ? "segmented-sm" : ""}`} role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          class={`segmented-item ${value === option.value ? "is-active" : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      class={`toggle ${checked ? "is-on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span class="toggle-knob" />
    </button>
  );
}

export function useCopy() {
  const { t, post } = useApp();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  const copy = (text: string) => {
    post({ type: "copyText", text });
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  useEffect(() => () => timer.current && window.clearTimeout(timer.current), []);
  return { copy, copied, label: copied ? t("message.copied") : t("message.copy") };
}

export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
  className?: string;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class={`modal ${className || ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  children,
  className,
  from = "end",
}: {
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
  className?: string;
  from?: "end" | "start";
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div class="modal-backdrop sheet-backdrop" onClick={onClose}>
      <div
        class={`sheet ${from === "start" ? "sheet-start" : ""} ${className || ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg class="spinner" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.18" stroke-width="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  className,
  size = 18,
}: {
  icon: IconName;
  label: string;
  onClick: (event: MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      class={`icon-btn ${active ? "is-active" : ""} ${className || ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
