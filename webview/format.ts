import type { Language } from "../src/shared/types";
import type { Translate } from "./i18n";

export function relativeTime(timestamp: number | undefined, t: Translate, _language: Language): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 45_000) return t("time.now");
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return minutes === 1 ? t("time.minute") : t("time.minutes", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? t("time.hour") : t("time.hours", { n: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? t("time.day") : t("time.days", { n: days });
  return new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function shortTime(timestamp: number | undefined): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function sessionGroup(timestamp: number | undefined): "today" | "yesterday" | "week" | "older" {
  if (!timestamp) return "older";
  const now = new Date();
  const date = new Date(timestamp);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= startOfToday) return "today";
  if (timestamp >= startOfToday - 86_400_000) return "yesterday";
  if (timestamp >= startOfToday - 7 * 86_400_000) return "week";
  return "older";
}

export function duration(start?: number, end?: number): string {
  if (!start) return "";
  const value = (end || Date.now()) - start;
  if (value < 1000) return `${Math.max(1, Math.round(value))}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(value / 60_000)}m ${Math.round((value % 60_000) / 1000)}s`;
}

export function basename(filePath: string): string {
  const parts = (filePath || "").split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

export function dirname(filePath: string): string {
  const parts = (filePath || "").split(/[\\/]/);
  parts.pop();
  return parts.join("/");
}

export function greetingKey(hour = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return "empty.morning";
  if (hour >= 12 && hour < 17) return "empty.afternoon";
  if (hour >= 17 && hour < 22) return "empty.evening";
  return "empty.night";
}

export function initials(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "?";
}
