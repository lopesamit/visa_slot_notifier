import type { Db } from "mongodb";
import { parseSlot, type Slot } from "@visa-slot/shared";
import { sendSlotAlerts, type FanOutResult } from "./alerts";
import { hitLimit } from "./limits";
import { recordSighting } from "./slots";
import type { TelegramApi } from "./telegram/client";

export const MAX_DATES_PER_REPORT = 10;
/** Dates further out than this are not real scheduler openings. */
const MAX_DAYS_AHEAD = 730;
const DAY_MS = 24 * 60 * 60 * 1000;

export const LIMITS = {
  perInstall: { limit: 20, windowMs: 10 * 60 * 1000 },
  perIp: { limit: 60, windowMs: 10 * 60 * 1000 },
};

export type Report = {
  installId: string;
  slots: Slot[];
};

const INSTALL_ID = /^[A-Za-z0-9_-]{16,64}$/;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Validates an extension report. Returns an error message for bad input. */
export function parseReport(body: unknown, now: Date = new Date()): Report | string {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  const { installId, post, visaClass, kind, dates } = body as Record<string, unknown>;

  if (typeof installId !== "string" || !INSTALL_ID.test(installId)) return "Invalid installId";
  if (typeof post !== "string" || typeof visaClass !== "string" || typeof kind !== "string") {
    return "post, visaClass, and kind are required";
  }
  if (!Array.isArray(dates) || dates.length === 0) return "dates must be a non-empty array";
  if (dates.length > MAX_DATES_PER_REPORT) return `At most ${MAX_DATES_PER_REPORT} dates per report`;

  const earliest = isoDay(new Date(now.getTime() - DAY_MS));
  const latest = isoDay(new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS));
  const slots: Slot[] = [];
  for (const date of new Set(dates)) {
    if (typeof date !== "string") return "Each date must be a YYYY-MM-DD string";
    const slot = parseSlot({ post, visaClass, kind, date });
    if (!slot) return `Unknown post, visa class, kind, or date: ${date}`;
    if (date < earliest || date > latest) return `Date out of range: ${date}`;
    slots.push(slot);
  }
  return { installId, slots };
}

export type ReportOutcome =
  | { status: "rate_limited" }
  | { status: "ok"; newSlots: number; alerts: FanOutResult };

export async function processReport(
  db: Db,
  tg: TelegramApi,
  report: Report,
  options: { ipKey?: string; now?: Date; test?: boolean } = {},
): Promise<ReportOutcome> {
  const now = options.now ?? new Date();
  const { perInstall, perIp } = LIMITS;

  const allowed =
    (await hitLimit(db, `install:${report.installId}`, perInstall.limit, perInstall.windowMs, now)) &&
    (!options.ipKey || (await hitLimit(db, `ip:${options.ipKey}`, perIp.limit, perIp.windowMs, now)));
  if (!allowed) return { status: "rate_limited" };

  const alerts: FanOutResult = { sent: 0, alreadySent: 0, failed: 0, paused: 0 };
  let newSlots = 0;
  for (const slot of report.slots) {
    const sighting = await recordSighting(db, slot, now);
    if (!sighting.newWave) continue;
    newSlots++;
    const sent = await sendSlotAlerts(db, tg, slot, sighting.waveId, { now, test: options.test });
    alerts.sent += sent.sent;
    alerts.alreadySent += sent.alreadySent;
    alerts.failed += sent.failed;
    alerts.paused += sent.paused;
  }
  return { status: "ok", newSlots, alerts };
}
