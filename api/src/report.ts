import type { Db } from "mongodb";
import { MAX_DATES_PER_REPORT, MAX_DAYS_AHEAD, parseSlot, type Slot } from "@visa-slot/shared";
import { sendSlotAlerts, type FanOutResult } from "./alerts";
import { hitLimit } from "./limits";
import { claimDelivery, recordSighting } from "./slots";
import type { TelegramApi } from "./telegram/client";

export { MAX_DATES_PER_REPORT };
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

/** Validates post, visa class, kind, and dates. Returns an error message for bad input. */
export function parseSlots(
  fields: Record<string, unknown>,
  maxDates: number,
  now: Date = new Date(),
): Slot[] | string {
  const { post, visaClass, kind, dates } = fields;
  if (typeof post !== "string" || typeof visaClass !== "string" || typeof kind !== "string") {
    return "post, visaClass, and kind are required";
  }
  if (!Array.isArray(dates) || dates.length === 0) return "dates must be a non-empty array";
  if (dates.length > maxDates) return `At most ${maxDates} dates per report`;

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
  return slots;
}

/** Validates an extension report. Returns an error message for bad input. */
export function parseReport(body: unknown, now: Date = new Date()): Report | string {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  const fields = body as Record<string, unknown>;
  const { installId } = fields;
  if (typeof installId !== "string" || !INSTALL_ID.test(installId)) return "Invalid installId";
  const slots = parseSlots(fields, MAX_DATES_PER_REPORT, now);
  return typeof slots === "string" ? slots : { installId, slots };
}

export type AlertRun = { newSlots: number; alerts: FanOutResult };

/**
 * Records each slot and alerts subscribers for the ones that start a new wave.
 * `skipChatId` is marked as already delivered, so a sharer is not alerted about
 * their own date.
 */
export async function alertNewSlots(
  db: Db,
  tg: TelegramApi,
  slots: Slot[],
  options: { now?: Date; test?: boolean; skipChatId?: number } = {},
): Promise<AlertRun> {
  const now = options.now ?? new Date();
  const alerts: FanOutResult = { sent: 0, alreadySent: 0, failed: 0, paused: 0 };
  let newSlots = 0;
  for (const slot of slots) {
    const sighting = await recordSighting(db, slot, now);
    if (!sighting.newWave) continue;
    newSlots++;
    if (options.skipChatId !== undefined) {
      await claimDelivery(db, sighting.waveId, options.skipChatId, now);
    }
    const sent = await sendSlotAlerts(db, tg, slot, sighting.waveId, { now, test: options.test });
    alerts.sent += sent.sent;
    alerts.alreadySent += sent.alreadySent;
    alerts.failed += sent.failed;
    alerts.paused += sent.paused;
  }
  return { newSlots, alerts };
}

export type ReportOutcome = { status: "rate_limited" } | ({ status: "ok" } & AlertRun);

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

  return { status: "ok", ...(await alertNewSlots(db, tg, report.slots, { now, test: options.test })) };
}
