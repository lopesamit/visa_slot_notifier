import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { collections, ensureIndexes, type Subscriber } from "./db";
import { LIMITS, parseReport, processReport, type Report } from "./report";
import { TelegramError, type TelegramApi } from "./telegram/client";

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let messages: { chatId: number; text: string }[];
let blockedChats: Set<number>;

const tg: TelegramApi = {
  async call() {
    return undefined as never;
  },
  async sendMessage(chatId, text) {
    if (blockedChats.has(chatId)) {
      throw new TelegramError("sendMessage", 403, "Forbidden: bot was blocked by the user");
    }
    messages.push({ chatId, text });
  },
  async editMessageText() {},
  async answerCallbackQuery() {},
};

const NOW = new Date("2026-10-02T10:00:00Z");

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
  installId: "install-aaaaaaaaaaaa",
  post: "mumbai",
  visaClass: "h1b",
  kind: "ofc",
  dates: ["2027-01-05"],
  ...overrides,
});

const report = (overrides: Record<string, unknown> = {}): Report => {
  const parsed = parseReport(body(overrides), NOW);
  if (typeof parsed === "string") throw new Error(parsed);
  return parsed;
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(mongo.getUri()).connect();
  db = client.db("report-test");
  await ensureIndexes(db);
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  messages = [];
  blockedChats = new Set();
  const c = collections(db);
  await Promise.all([
    c.slotEvents.deleteMany({}),
    c.subscribers.deleteMany({}),
    c.deliveries.deleteMany({}),
    c.rateLimits.deleteMany({}),
  ]);
});

describe("parseReport", () => {
  it("accepts a valid report and drops repeated dates", () => {
    const parsed = parseReport(body({ dates: ["2027-01-05", "2027-01-05", "2027-01-06"] }), NOW);
    expect(typeof parsed).toBe("object");
    expect((parsed as Report).slots.map((s) => s.date)).toEqual(["2027-01-05", "2027-01-06"]);
  });

  it.each([
    [{ installId: "short" }, "installId"],
    [{ post: "london" }, "Unknown"],
    [{ dates: [] }, "non-empty"],
    [{ dates: ["05/01/2027"] }, "Unknown"],
    [{ dates: ["2020-01-01"] }, "out of range"],
    [{ dates: ["2031-01-01"] }, "out of range"],
    [{ dates: Array.from({ length: 11 }, (_, i) => `2027-02-${String(i + 1).padStart(2, "0")}`) }, "At most"],
  ])("rejects %j", (overrides, message) => {
    expect(parseReport(body(overrides), NOW)).toContain(message);
  });
});

describe("processReport", () => {
  it("sends one alert per matching user when 25 browsers report the same slot at once", async () => {
    await collections(db).subscribers.insertMany([
      subscriber(1),
      subscriber(2),
      subscriber(3, { posts: ["chennai"] }),
      subscriber(4, { paused: true }),
    ]);

    const outcomes = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        processReport(db, tg, report({ installId: `install-${String(i).padStart(12, "0")}` }), {
          now: NOW,
        }),
      ),
    );

    expect(outcomes.filter((o) => o.status === "ok" && o.newSlots === 1)).toHaveLength(1);
    expect(messages.map((m) => m.chatId).sort()).toEqual([1, 2]);
    expect(messages[0].text).toContain("H-1B · Mumbai · OFC");
  });

  it("does not alert again for a report later in the same wave", async () => {
    await collections(db).subscribers.insertOne(subscriber(1));
    await processReport(db, tg, report(), { now: NOW });
    await processReport(db, tg, report({ installId: "install-bbbbbbbbbbbb" }), {
      now: new Date(NOW.getTime() + 60 * 60 * 1000),
    });
    expect(messages).toHaveLength(1);
  });

  it("alerts separately for each new date in one report", async () => {
    await collections(db).subscribers.insertOne(subscriber(1));
    const outcome = await processReport(db, tg, report({ dates: ["2027-01-05", "2027-01-06"] }), {
      now: NOW,
    });
    expect(outcome).toMatchObject({ status: "ok", newSlots: 2 });
    expect(messages).toHaveLength(2);
  });

  it("pauses a subscriber who blocked the bot", async () => {
    await collections(db).subscribers.insertMany([subscriber(1), subscriber(2)]);
    blockedChats.add(2);
    const outcome = await processReport(db, tg, report(), { now: NOW });

    expect(outcome).toMatchObject({ alerts: { sent: 1, paused: 1 } });
    expect((await collections(db).subscribers.findOne({ chatId: 2 }))!.paused).toBe(true);
  });

  it("rate-limits one browser after its limit, without recording the extra report", async () => {
    const r = report();
    for (let i = 0; i < LIMITS.perInstall.limit; i++) {
      expect((await processReport(db, tg, r, { now: NOW })).status).toBe("ok");
    }
    expect((await processReport(db, tg, r, { now: NOW })).status).toBe("rate_limited");

    const event = await collections(db).slotEvents.findOne({});
    expect(event!.totalReports).toBe(LIMITS.perInstall.limit);
  });

  it("rate-limits by IP across different install ids", async () => {
    for (let i = 0; i < LIMITS.perIp.limit; i++) {
      const r = report({ installId: `install-${String(i).padStart(12, "0")}` });
      expect((await processReport(db, tg, r, { now: NOW, ipKey: "ip-1" })).status).toBe("ok");
    }
    const extra = report({ installId: "install-zzzzzzzzzzzz" });
    expect((await processReport(db, tg, extra, { now: NOW, ipKey: "ip-1" })).status).toBe(
      "rate_limited",
    );
    expect((await processReport(db, tg, extra, { now: NOW, ipKey: "ip-2" })).status).toBe("ok");
  });
});
