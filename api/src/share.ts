import type { Db } from "mongodb";
import type { Slot } from "@visa-slot/shared";
import { hitLimit } from "./limits";
import { findByLinkKey, isLinkKey } from "./links";
import { alertNewSlots, parseSlots, type AlertRun } from "./report";
import type { TelegramApi } from "./telegram/client";

/** Openings come in clusters, so one share can carry several tapped days. */
export const MAX_DATES_PER_SHARE = 10;

export const SHARE_LIMITS = {
  perChat: { limit: 10, windowMs: 60 * 60 * 1000 },
  perIp: { limit: 30, windowMs: 60 * 60 * 1000 },
};

export type Share = { linkKey: string; slots: Slot[] };

/** Validates a "Share a date I see" request. Returns an error message for bad input. */
export function parseShare(body: unknown, now: Date = new Date()): Share | string {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  const fields = body as Record<string, unknown>;
  if (!isLinkKey(fields.linkKey)) return "Invalid linkKey";
  const slots = parseSlots(fields, MAX_DATES_PER_SHARE, now);
  return typeof slots === "string" ? slots : { linkKey: fields.linkKey, slots };
}

export type ShareOutcome =
  | { status: "not_connected" }
  | { status: "rate_limited" }
  | ({ status: "ok" } & AlertRun);

/**
 * Only browsers connected to a Telegram chat can share, so every share is tied
 * to a real chat and limited per chat.
 */
export async function processShare(
  db: Db,
  tg: TelegramApi,
  share: Share,
  options: { ipKey?: string; now?: Date } = {},
): Promise<ShareOutcome> {
  const now = options.now ?? new Date();
  const sharer = await findByLinkKey(db, share.linkKey);
  if (!sharer) return { status: "not_connected" };

  const { perChat, perIp } = SHARE_LIMITS;
  const allowed =
    (await hitLimit(db, `share-chat:${sharer.chatId}`, perChat.limit, perChat.windowMs, now)) &&
    (!options.ipKey ||
      (await hitLimit(db, `share-ip:${options.ipKey}`, perIp.limit, perIp.windowMs, now)));
  if (!allowed) return { status: "rate_limited" };

  return {
    status: "ok",
    ...(await alertNewSlots(db, tg, share.slots, { now, skipChatId: sharer.chatId })),
  };
}
