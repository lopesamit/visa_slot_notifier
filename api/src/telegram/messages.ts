import {
  APPOINTMENT_KINDS,
  POSTS,
  SITE_URL,
  VISA_CLASSES,
  type Slot,
} from "@visa-slot/shared";
import type { Subscriber } from "../db";
import { hasCompleteFilters } from "../subscribers";
import type { InlineButton, InlineKeyboard } from "./client";

const labelOf = <T extends { id: string; label: string }>(list: readonly T[], id: string) =>
  list.find((item) => item.id === id)?.label ?? id;

const listLabels = <T extends { id: string; label: string }>(list: readonly T[], ids: string[]) =>
  ids.length ? list.filter((item) => ids.includes(item.id)).map((i) => i.label).join(", ") : "none";

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

const dateRangeText = (s: Subscriber) => {
  if (!s.dateFrom && !s.dateTo) return "any";
  if (s.dateFrom && s.dateTo) return `${formatDate(s.dateFrom)} to ${formatDate(s.dateTo)}`;
  return s.dateFrom ? `from ${formatDate(s.dateFrom)}` : `until ${formatDate(s.dateTo!)}`;
};

export function filtersSummary(s: Subscriber): string {
  return [
    `Posts: ${listLabels(POSTS, s.posts)}`,
    `Visa: ${listLabels(VISA_CLASSES, s.visaClasses)}`,
    `Type: ${listLabels(APPOINTMENT_KINDS, s.kinds)}`,
    `Dates: ${dateRangeText(s)}`,
  ].join("\n");
}

function statusLine(s: Subscriber): string {
  if (!hasCompleteFilters(s)) {
    return "Pick at least one post, one visa class, and one type to start getting alerts.";
  }
  return s.paused ? "Alerts are paused. Send /resume to turn them back on." : "Alerts are on.";
}

export function filtersMenuText(s: Subscriber): string {
  return `<b>Choose what to watch</b>\nTap a button to turn it on or off.\n\n${filtersSummary(s)}\n\n${statusLine(s)}`;
}

export function statusText(s: Subscriber): string {
  return `<b>What you are watching</b>\n\n${filtersSummary(s)}\n\n${statusLine(s)}`;
}

const button = (selected: boolean, label: string, data: string): InlineButton => ({
  text: selected ? `✓ ${label}` : label,
  callback_data: data,
});

const rows = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

export function filtersKeyboard(s: Subscriber): InlineKeyboard {
  return {
    inline_keyboard: [
      ...rows(POSTS.map((p) => button(s.posts.includes(p.id), p.label, `t:posts:${p.id}`)), 3),
      ...rows(
        VISA_CLASSES.map((v) => button(s.visaClasses.includes(v.id), v.label, `t:visaClasses:${v.id}`)),
        3,
      ),
      APPOINTMENT_KINDS.map((k) => button(s.kinds.includes(k.id), k.label, `t:kinds:${k.id}`)),
      [{ text: "Done", callback_data: "done" }],
    ],
  };
}

export const welcomeText = () =>
  [
    "<b>Visa Slot Notifier</b>",
    "Free alerts when someone on the official U.S. scheduling site sees an appointment date that matches what you are watching.",
    "",
    "We never ask for your visa-site login, and we never book for you. You book on the official site yourself.",
    "",
    "Start by choosing your filters below.",
  ].join("\n");

export const helpText = () =>
  [
    "<b>How this works</b>",
    "People using our Chrome extension on the official scheduling site report the dates they can see. When a date matches your filters, you get one message, however many people saw it.",
    "",
    "/filters choose posts, visa classes, and OFC or consular",
    "/dates 2027-01-01 2027-03-31 limit to a date range (/dates any to clear)",
    "/status show what you are watching",
    "/test send a sample alert",
    "/pause and /resume turn alerts off and on",
    "/stop delete your filters",
    "",
    `Alerts are free. Donations never unlock anything: ${SITE_URL}`,
  ].join("\n");

export const datesUsageText = () =>
  [
    "Send a start and end date as YYYY-MM-DD:",
    "/dates 2027-01-01 2027-03-31",
    "",
    "Only a start: /dates 2027-01-01 -",
    "Only an end: /dates - 2027-03-31",
    "Clear the range: /dates any",
  ].join("\n");

export function slotAlertText(slot: Slot, options: { test?: boolean } = {}): string {
  const heading = [
    labelOf(VISA_CLASSES, slot.visaClass),
    labelOf(POSTS, slot.post),
    labelOf(APPOINTMENT_KINDS, slot.kind),
  ].join(" · ");
  return [
    options.test ? "<i>Test alert. This date was not really seen.</i>\n" : "",
    `<b>${heading}</b>`,
    `Date seen: ${formatDate(slot.date)}`,
    "",
    "Someone on the official scheduling site just saw this date. Check there and book it yourself. It may already be gone.",
    "",
    "/pause to stop alerts",
  ]
    .filter((line, i) => i !== 0 || line)
    .join("\n");
}
