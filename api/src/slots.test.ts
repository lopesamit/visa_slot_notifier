import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WAVE_MS, type Slot } from "@visa-slot/shared";
import { collections, ensureIndexes } from "./db";
import { claimDelivery, findMatchingSubscribers, recordSighting } from "./slots";

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;

const slot: Slot = { post: "hyderabad", visaClass: "h1b", kind: "consular", date: "2027-01-05" };

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(mongo.getUri()).connect();
  db = client.db("test");
  await ensureIndexes(db);
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  const { slotEvents, subscribers, deliveries } = collections(db);
  await Promise.all([
    slotEvents.deleteMany({}),
    subscribers.deleteMany({}),
    deliveries.deleteMany({}),
  ]);
});

describe("recordSighting", () => {
  it("lets exactly one of many simultaneous reports start the wave", async () => {
    const now = new Date("2026-10-02T10:00:00Z");
    const results = await Promise.all(
      Array.from({ length: 25 }, () => recordSighting(db, slot, now)),
    );

    expect(results.filter((r) => r.newWave)).toHaveLength(1);
    expect(new Set(results.map((r) => r.waveId)).size).toBe(1);

    const stored = await collections(db).slotEvents.find({}).toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].waveReports).toBe(25);
  });

  it("does not start a new wave while the current one is open", async () => {
    const start = new Date("2026-10-02T10:00:00Z");
    const first = await recordSighting(db, slot, start);
    const later = await recordSighting(db, slot, new Date(start.getTime() + WAVE_MS - 1));

    expect(first.newWave).toBe(true);
    expect(later.newWave).toBe(false);
    expect(later.waveId).toBe(first.waveId);
  });

  it("starts one new wave after the window, even with concurrent reports", async () => {
    const start = new Date("2026-10-02T10:00:00Z");
    const first = await recordSighting(db, slot, start);
    const reopened = new Date(start.getTime() + WAVE_MS + 1);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => recordSighting(db, slot, reopened)),
    );

    expect(results.filter((r) => r.newWave)).toHaveLength(1);
    expect(results[0].waveId).not.toBe(first.waveId);
    expect(await collections(db).slotEvents.countDocuments()).toBe(1);
  });

  it("treats a different date as a different slot", async () => {
    const now = new Date("2026-10-02T10:00:00Z");
    const a = await recordSighting(db, slot, now);
    const b = await recordSighting(db, { ...slot, date: "2027-01-06" }, now);
    expect(a.newWave && b.newWave).toBe(true);
  });
});

describe("claimDelivery", () => {
  it("allows one message per chat per wave", async () => {
    const claims = await Promise.all([
      claimDelivery(db, "wave-1", 42),
      claimDelivery(db, "wave-1", 42),
      claimDelivery(db, "wave-1", 42),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await claimDelivery(db, "wave-1", 43)).toBe(true);
    expect(await claimDelivery(db, "wave-2", 42)).toBe(true);
  });
});

describe("findMatchingSubscribers", () => {
  it("matches on post, visa class, kind, and date range", async () => {
    const base = {
      posts: ["hyderabad" as const],
      visaClasses: ["h1b" as const],
      kinds: ["consular" as const],
      paused: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await collections(db).subscribers.insertMany([
      { ...base, chatId: 1 },
      { ...base, chatId: 2, dateFrom: "2027-01-01", dateTo: "2027-01-31" },
      { ...base, chatId: 3, dateTo: "2026-12-31" },
      { ...base, chatId: 4, kinds: ["ofc"] },
      { ...base, chatId: 5, paused: true },
      { ...base, chatId: 6, posts: ["mumbai"] },
    ]);

    const matches = await findMatchingSubscribers(db, slot);
    expect(matches.map((s) => s.chatId).sort()).toEqual([1, 2]);
  });
});
