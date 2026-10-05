import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { collections, ensureIndexes, type Subscriber } from "./db";
import { linkChat } from "./links";
import { SHARE_LIMITS, parseShare, processShare, type Share } from "./share";
import type { TelegramApi } from "./telegram/client";

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let messages: { chatId: number; text: string }[];

const tg: TelegramApi = {
  async call() {
    return undefined as never;
  },
  async sendMessage(chatId, text) {
    messages.push({ chatId, text });
  },
  async editMessageText() {},
  async answerCallbackQuery() {},
};

const NOW = new Date("2026-10-02T10:00:00Z");
const SHARER_KEY = "k".repeat(43);
const OTHER_KEY = "o".repeat(43);

const subscriber = (chatId: number, overrides: Partial<Subscriber> = {}): Subscriber => ({
  chatId,
  posts: ["mumbai"],
  visaClasses: ["h1b"],
  kinds: ["ofc"],
  paused: false,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) => ({
  linkKey: SHARER_KEY,
  post: "mumbai",
  visaClass: "h1b",
  kind: "ofc",
  dates: ["2027-01-05"],
  ...overrides,
});

const share = (overrides: Record<string, unknown> = {}): Share => {
  const parsed = parseShare(body(overrides), NOW);
  if (typeof parsed === "string") throw new Error(parsed);
  return parsed;
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(mongo.getUri()).connect();
  db = client.db("share-test");
  await ensureIndexes(db);
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  messages = [];
  const c = collections(db);
  await Promise.all([
    c.slotEvents.deleteMany({}),
    c.subscribers.deleteMany({}),
    c.deliveries.deleteMany({}),
    c.rateLimits.deleteMany({}),
  ]);
  await c.subscribers.insertMany([subscriber(1), subscriber(2), subscriber(3, { posts: ["chennai"] })]);
  await linkChat(db, 1, SHARER_KEY, NOW);
});

describe("parseShare", () => {
  it.each([
    [{ linkKey: "short" }, "linkKey"],
    [{ post: "london" }, "Unknown"],
    [{ dates: ["2020-01-01"] }, "out of range"],
    [{ dates: Array.from({ length: 11 }, (_, i) => `2027-02-${String(i + 1).padStart(2, "0")}`) }, "At most 10"],
  ])("rejects %j", (overrides, message) => {
    expect(parseShare(body(overrides), NOW)).toContain(message);
  });
});

describe("processShare", () => {
  it("alerts matching users right away, but not the person who shared", async () => {
    const outcome = await processShare(db, tg, share(), { now: NOW });
    expect(outcome).toMatchObject({ status: "ok", newSlots: 1, alerts: { sent: 1 } });
    expect(messages.map((m) => m.chatId)).toEqual([2]);
  });

  it("does not alert twice when a second person shares the same date", async () => {
    await linkChat(db, 2, OTHER_KEY, NOW);
    await processShare(db, tg, share(), { now: NOW });
    const second = await processShare(db, tg, share({ linkKey: OTHER_KEY }), { now: NOW });
    expect(second).toMatchObject({ status: "ok", newSlots: 0 });
    expect(messages).toHaveLength(1);
  });

  it("refuses browsers that are not connected to Telegram", async () => {
    const outcome = await processShare(db, tg, share({ linkKey: OTHER_KEY }), { now: NOW });
    expect(outcome.status).toBe("not_connected");
    expect(await collections(db).slotEvents.countDocuments()).toBe(0);
  });

  it("limits shares per Telegram chat", async () => {
    for (let i = 0; i < SHARE_LIMITS.perChat.limit; i++) {
      expect((await processShare(db, tg, share(), { now: NOW })).status).toBe("ok");
    }
    expect((await processShare(db, tg, share(), { now: NOW })).status).toBe("rate_limited");
  });
});
