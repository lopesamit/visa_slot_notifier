import {
  isIsoDate,
  MAX_DATES_PER_REPORT,
  MAX_DAYS_AHEAD,
  POSTS,
  type AppointmentKind,
  type PostId,
} from "@visa-slot/shared";

/** The official U.S. visa scheduling site for India. */
export const SCHEDULER_MATCHES = ["https://www.usvisascheduling.com/*"];
/** The mock scheduler served by `npm run serve -w api` for local testing. */
export const DEV_SCHEDULER_MATCHES = ["http://localhost:8787/dev/*"];

/** Tags messages from the page-world calendar reader to the reporter. */
export const CALENDAR_MESSAGE = "vsn-calendar";

export type CalendarMessage = {
  source: typeof CALENDAR_MESSAGE;
  url: string;
  requestBody: string;
  responseBody: string;
};

/** Sent from the reporter content script to the background. */
export type CalendarDates = {
  type: "calendar-dates";
  post: PostId;
  kind: AppointmentKind;
  dates: string[];
};

/** The site fills its calendars from routes like `get-family-ofc-schedule-days`. */
export const isCalendarRequest = (url: string) => /schedule-days/i.test(url);

export function kindFromRequest(url: string, pagePath: string): AppointmentKind | null {
  if (/ofc/i.test(url)) return "ofc";
  if (/consular/i.test(url)) return "consular";
  if (/\/ofc-schedule/i.test(pagePath)) return "ofc";
  if (/\/schedule(\/|$)/i.test(pagePath)) return "consular";
  return null;
}

/** Calendar requests carry the chosen post as `"postId":"<id>"`, often URL-encoded. */
export function postIdFromRequestBody(body: string): string | null {
  let text = body;
  try {
    text = decodeURIComponent(body.replace(/\+/g, " "));
  } catch {
    // Not URL-encoded; search the raw body.
  }
  return /"postId"\s*:\s*"([^"]+)"/i.exec(text)?.[1] ?? null;
}

/** Maps a location label such as "MUMBAI VAC" or "New Delhi" to a post. */
export function postFromLabel(label: string | null | undefined): PostId | null {
  const text = (label ?? "").toUpperCase().replace(/\s+/g, " ");
  if (/\bDELHI\b/.test(text)) return "new-delhi";
  const post = POSTS.find((p) => p.id !== "new-delhi" && text.includes(p.label.toUpperCase()));
  return post?.id ?? null;
}

/** Collects every `Date` field in a calendar response as YYYY-MM-DD, sorted. */
export function extractDates(data: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown, depth: number) => {
    if (depth > 5 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    for (const [key, field] of Object.entries(value)) {
      if (typeof field === "string" && key.toLowerCase() === "date") {
        const day = field.slice(0, 10);
        if (isIsoDate(day)) found.add(day);
      } else {
        visit(field, depth + 1);
      }
    }
  };
  visit(data, 0);
  return [...found].sort();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Keeps the dates the API accepts: the earliest ones, from yesterday to two years ahead. */
export function datesToReport(dates: string[], now: Date = new Date()): string[] {
  const earliest = isoDay(new Date(now.getTime() - DAY_MS));
  const latest = isoDay(new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS));
  return [...new Set(dates)]
    .filter((d) => isIsoDate(d) && d >= earliest && d <= latest)
    .sort()
    .slice(0, MAX_DATES_PER_REPORT);
}
