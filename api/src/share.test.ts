import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { collections, ensureIndexes, type Subscriber } from "./db";
import { dashboardData, isAdminToken } from "./admin";
import { publicStats } from "./stats";
import { linkChat } from "./links";
import { SHARE_LIMITS, parseShare, processShare, type Share } from "./share";
import type { TelegramApi } from "./telegram/client";

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let messages: { chatId: number; text: string }[];

const tg: TelegramApi = {
  async call(method) {
    return (method === "getChat" ? { first_name: "Test", last_name: "User", username: "tester" } : undefined) as never;
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
    c.shares.deleteMany({}),
  ]);
  await c.subscribers.insertMany([subscriber(1), subscriber(2), subscriber(3, { posts: ["chennai"] })]);
  await linkChat(db, 1, SHARER_KEY, NOW);
});

describe("isAdminToken", () => {
  const key = "a".repeat(40);
  it("accepts only the configured key", () => {
    expect(isAdminToken(key, key)).toBe(true);
    expect(isAdminToken(`${key}b`, key)).toBe(false);
    expect(isAdminToken(null, key)).toBe(false);
  });

  it("refuses everything when the key is missing or too short", () => {
    expect(isAdminToken("", "")).toBe(false);
    expect(isAdminToken("short", "short")).toBe(false);
    expect(isAdminToken(key, undefined)).toBe(false);
  });
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
  it("counts only people with alerts on and filters chosen", async () => {
    await collections(db).subscribers.insertMany([
      subscriber(8, { posts: [] }),
      subscriber(9, { paused: true }),
    ]);
    expect(await publicStats(db)).toEqual({ watching: 3 });
  });

  it("alerts matching users right away, but not the person who shared", async () => {
    const outcome = await processShare(db, tg, share(), { now: NOW });
    expect(outcome).toMatchObject({ status: "ok", newSlots: 1, alerts: { sent: 1 } });
    expect(messages.map((m) => m.chatId)).toEqual([2]);
  });

  it("logs who shared which dates, for the admin dashboard", async () => {
    await processShare(db, tg, share({ dates: ["2027-01-05", "2027-01-06"] }), { now: NOW });
    await processShare(db, tg, share({ dates: ["2027-01-06"] }), { now: NOW });
    const logs = await collections(db).shares.find({}, { projection: { _id: 0 } }).sort({ _id: 1 }).toArray();
    expect(logs).toEqual([
      { chatId: 1, post: "mumbai", visaClass: "h1b", kind: "ofc", dates: ["2027-01-05", "2027-01-06"], newDates: ["2027-01-05", "2027-01-06"], alerted: 2, at: NOW },
      { chatId: 1, post: "mumbai", visaClass: "h1b", kind: "ofc", dates: ["2027-01-06"], newDates: [], alerted: 0, at: NOW },
    ]);

    const data = await dashboardData(db, tg, NOW);
    expect(data.shares).toHaveLength(2);
    expect(data.shares[0]).toMatchObject({ chatId: 1, dates: ["2027-01-06"], newDates: [], at: NOW.toISOString() });
    expect(data.sharers).toEqual([{ chatId: 1, name: "Test User", username: "tester" }]);
    expect(data.openings.map((o) => o.date).sort()).toEqual(["2027-01-05", "2027-01-06"]);
    expect(data.subscribers).toHaveLength(3);
    expect(data.subscribers.filter((s) => s.linked)).toHaveLength(1);
    expect(data.subscribers[0]).not.toHaveProperty("chatId");
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
