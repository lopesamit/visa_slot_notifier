import { createHash, timingSafeEqual } from "node:crypto";
import type { Db } from "mongodb";
import { collections, type ShareLog } from "./db";
import type { TelegramApi } from "./telegram/client";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Shares are kept 90 days, so this covers all of them at the current scale. */
const MAX_SHARES = 3000;
const MAX_OPENINGS = 1000;
/** getChat calls per page load; the rest show the chat id only. */
const MAX_NAME_LOOKUPS = 150;
const MIN_TOKEN_LENGTH = 32;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares in constant time; a missing or short ADMIN_TOKEN never matches. */
export function isAdminToken(given: string | null | undefined, expected = process.env.ADMIN_TOKEN): boolean {
  if (!given || !expected || expected.length < MIN_TOKEN_LENGTH) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

type TelegramChat = { first_name?: string; last_name?: string; username?: string; title?: string };

export type Sharer = { chatId: number; name: string | null; username: string | null };

/** Names come live from Telegram and are not stored. */
async function lookupSharers(tg: TelegramApi, chatIds: number[]): Promise<Sharer[]> {
  const lookedUp = chatIds.slice(0, MAX_NAME_LOOKUPS);
  const results = await Promise.allSettled(
    lookedUp.map((chatId) => tg.call<TelegramChat>("getChat", { chat_id: chatId })),
  );
  return chatIds.map((chatId, i) => {
    const result = results[i];
    const chat: TelegramChat = (result?.status === "fulfilled" && result.value) || {};
    const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.title || null;
    return { chatId, name, username: chat.username ?? null };
  });
}

export type DashboardShare = Omit<ShareLog, "at"> & { at: string };

export type DashboardOpening = {
  post: string;
  visaClass: string;
  kind: string;
  date: string;
  firstSeenAt: string;
  waveStartedAt: string;
  lastSeenAt: string;
  waveReports: number;
  totalReports: number;
};

export type DashboardSubscriber = {
  posts: string[];
  visaClasses: string[];
  kinds: string[];
  dateFrom: string | null;
  dateTo: string | null;
  paused: boolean;
  linked: boolean;
  createdAt: string;
};

export type Dashboard = {
  generatedAt: string;
  sharers: Sharer[];
  shares: DashboardShare[];
  openings: DashboardOpening[];
  /** Filters only; chat ids are left out. */
  subscribers: DashboardSubscriber[];
};

export async function dashboardData(db: Db, tg: TelegramApi, now: Date = new Date()): Promise<Dashboard> {
  const { subscribers, shares, slotEvents } = collections(db);
  const since = new Date(now.getTime() - 90 * DAY_MS);

  const [shareDocs, openingDocs, subscriberDocs] = await Promise.all([
    shares.find({ at: { $gt: since } }, { projection: { _id: 0 } }).sort({ at: -1, _id: -1 }).limit(MAX_SHARES).toArray(),
    slotEvents.find({}, { projection: { _id: 0, key: 0 } }).sort({ waveStartedAt: -1 }).limit(MAX_OPENINGS).toArray(),
    subscribers.find({}, { projection: { _id: 0, chatId: 0 } }).toArray(),
  ]);

  const counts = new Map<number, number>();
  for (const s of shareDocs) counts.set(s.chatId, (counts.get(s.chatId) ?? 0) + 1);
  const chatIds = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);

  return {
    generatedAt: now.toISOString(),
    sharers: await lookupSharers(tg, chatIds),
    shares: shareDocs.map((s) => ({ ...s, at: s.at.toISOString() })),
    openings: openingDocs.map((o) => ({
      post: o.post,
      visaClass: o.visaClass,
      kind: o.kind,
      date: o.date,
      firstSeenAt: o.firstSeenAt.toISOString(),
      waveStartedAt: o.waveStartedAt.toISOString(),
      lastSeenAt: o.lastSeenAt.toISOString(),
      waveReports: o.waveReports,
      totalReports: o.totalReports,
    })),
    subscribers: subscriberDocs.map((s) => ({
      posts: s.posts,
      visaClasses: s.visaClasses,
      kinds: s.kinds,
      dateFrom: s.dateFrom ?? null,
      dateTo: s.dateTo ?? null,
      paused: s.paused,
      linked: typeof s.linkKeyHash === "string",
      createdAt: s.createdAt.toISOString(),
    })),
  };
}
