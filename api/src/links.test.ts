import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handleUpdate } from "./bot";
import { collections, ensureIndexes } from "./db";
import {
  findByLinkKey,
  parseFilterUpdate,
  subscriptionView,
  unlinkByLinkKey,
  updateByLinkKey,
} from "./links";
import type { TelegramApi } from "./telegram/client";

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let texts: string[];

const tg: TelegramApi = {
  async call() {
    return undefined as never;
  },
  async sendMessage(_chatId, text) {
    texts.push(text);
  },
  async editMessageText() {},
  async answerCallbackQuery() {},
};

const KEY_A = "a".repeat(43);
const KEY_B = "b".repeat(43);

const start = (chatId: number, payload?: string) =>
  handleUpdate(db, tg, {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: 1,
      chat: { id: chatId, type: "private" },
      text: payload ? `/start ${payload}` : "/start",
    },
  });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(mongo.getUri()).connect();
  db = client.db("links-test");
  await ensureIndexes(db);
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  texts = [];
  await collections(db).subscribers.deleteMany({});
});

describe("linking a chat to the extension", () => {
  it("/start with a link key connects that chat", async () => {
    expect(subscriptionView(await findByLinkKey(db, KEY_A))).toEqual({ connected: false });
    await start(10, KEY_A);

    expect(texts[0]).toContain("Connected to your Chrome extension");
    expect(subscriptionView(await findByLinkKey(db, KEY_A))).toMatchObject({
      connected: true,
      posts: [],
      paused: false,
    });
  });

  it("plain /start does not link anything", async () => {
    await start(10);
    expect(await findByLinkKey(db, KEY_A)).toBeNull();
    expect(texts[0]).toContain("Free alerts");
  });

  it("moves a link key to the newest chat that used it", async () => {
    await start(10, KEY_A);
    await start(20, KEY_A);
    expect((await findByLinkKey(db, KEY_A))!.chatId).toBe(20);
    expect((await collections(db).subscribers.findOne({ chatId: 10 }))!.linkKeyHash).toBeUndefined();
  });

  it("keeps a different extension's key separate", async () => {
    await start(10, KEY_A);
    await start(20, KEY_B);
    expect((await findByLinkKey(db, KEY_A))!.chatId).toBe(10);
    expect((await findByLinkKey(db, KEY_B))!.chatId).toBe(20);
  });

  it("does not store the raw link key", async () => {
    await start(10, KEY_A);
    const stored = JSON.stringify(await collections(db).subscribers.findOne({ chatId: 10 }));
    expect(stored).not.toContain(KEY_A);
  });
});

describe("updating filters from the extension", () => {
  it("saves filters and clears an omitted date bound", async () => {
    await start(10, KEY_A);
    const first = parseFilterUpdate({
      posts: ["mumbai", "mumbai"],
      visaClasses: ["h1b"],
      kinds: ["ofc", "consular"],
      dateFrom: "2027-01-01",
      dateTo: "2027-03-31",
      paused: false,
    });
    expect(typeof first).toBe("object");
    await updateByLinkKey(db, KEY_A, first as Exclude<typeof first, string>);

    const second = parseFilterUpdate({
      posts: ["mumbai"],
      visaClasses: ["h1b"],
      kinds: ["ofc"],
      dateTo: "2027-03-31",
      paused: true,
    });
    const view = subscriptionView(
      await updateByLinkKey(db, KEY_A, second as Exclude<typeof second, string>),
    );
    expect(view).toEqual({
      connected: true,
      posts: ["mumbai"],
      visaClasses: ["h1b"],
      kinds: ["ofc"],
      dateFrom: null,
      dateTo: "2027-03-31",
      paused: true,
    });
  });

  it("returns not connected for an unknown key", async () => {
    const update = parseFilterUpdate({ posts: [], visaClasses: [], kinds: [], paused: false });
    expect(await updateByLinkKey(db, KEY_B, update as Exclude<typeof update, string>)).toBeNull();
  });

  it.each([
    [{ posts: ["london"] }, "known values"],
    [{ dateFrom: "2027-02-30" }, "YYYY-MM-DD"],
    [{ dateFrom: "2027-03-01", dateTo: "2027-02-01" }, "after"],
    [{ paused: "no" }, "paused"],
  ])("rejects %j", (overrides, message) => {
    const body = { posts: ["mumbai"], visaClasses: ["h1b"], kinds: ["ofc"], paused: false, ...overrides };
    expect(parseFilterUpdate(body)).toContain(message);
  });

  it("disconnect removes the link but keeps the chat's filters", async () => {
    await start(10, KEY_A);
    await unlinkByLinkKey(db, KEY_A);
    expect(await findByLinkKey(db, KEY_A)).toBeNull();
    expect(await collections(db).subscribers.findOne({ chatId: 10 })).not.toBeNull();
  });
});
