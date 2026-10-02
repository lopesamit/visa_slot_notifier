import { MongoClient, type Db } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handleUpdate } from "./bot";
import { collections, ensureIndexes } from "./db";
import type { InlineKeyboard, TelegramApi } from "./telegram/client";
import type { TelegramUpdate } from "./telegram/types";

type Sent = { method: string; chatId?: number; text?: string; keyboard?: InlineKeyboard };

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let db: Db;
let sent: Sent[];

const tg: TelegramApi = {
  async call() {
    return undefined as never;
  },
  async sendMessage(chatId, text, options) {
    sent.push({ method: "sendMessage", chatId, text, keyboard: options?.replyMarkup });
  },
  async editMessageText(chatId, _messageId, text, options) {
    sent.push({ method: "editMessageText", chatId, text, keyboard: options?.replyMarkup });
  },
  async answerCallbackQuery() {
    sent.push({ method: "answerCallbackQuery" });
  },
};

const CHAT = 1001;
let updateId = 0;

const text = (body: string): TelegramUpdate => ({
  update_id: ++updateId,
  message: { message_id: updateId, chat: { id: CHAT, type: "private" }, text: body },
});

const tap = (data: string): TelegramUpdate => ({
  update_id: ++updateId,
  callback_query: {
    id: `cb${updateId}`,
    from: { id: CHAT },
    message: { message_id: 1, chat: { id: CHAT, type: "private" } },
    data,
  },
});

const subscriber = () => collections(db).subscribers.findOne({ chatId: CHAT });
const lastText = () => sent.filter((s) => s.text).at(-1)?.text ?? "";

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(mongo.getUri()).connect();
  db = client.db("bot-test");
  await ensureIndexes(db);
}, 120_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  sent = [];
  await collections(db).subscribers.deleteMany({});
});

describe("handleUpdate", () => {
  it("/start saves the chat and shows the filter buttons", async () => {
    await handleUpdate(db, tg, text("/start"));

    expect(await subscriber()).toMatchObject({ chatId: CHAT, posts: [], paused: false });
    const menu = sent.find((s) => s.keyboard);
    const labels = menu!.keyboard!.inline_keyboard.flat().map((b) => b.text);
    expect(labels).toEqual(expect.arrayContaining(["Hyderabad", "H-1B", "Consular", "Done"]));
  });

  it("toggles a filter on and off and redraws the menu", async () => {
    await handleUpdate(db, tg, text("/start"));
    await handleUpdate(db, tg, tap("t:posts:hyderabad"));
    expect((await subscriber())!.posts).toEqual(["hyderabad"]);

    const edit = sent.filter((s) => s.method === "editMessageText").at(-1)!;
    expect(edit.keyboard!.inline_keyboard.flat().map((b) => b.text)).toContain("✓ Hyderabad");

    await handleUpdate(db, tg, tap("t:posts:hyderabad"));
    expect((await subscriber())!.posts).toEqual([]);
  });

  it("ignores button data that is not in the catalog", async () => {
    await handleUpdate(db, tg, text("/start"));
    await handleUpdate(db, tg, tap("t:posts:london"));
    await handleUpdate(db, tg, tap("t:paused:true"));
    expect(await subscriber()).toMatchObject({ posts: [], paused: false });
  });

  it("says alerts are on only once every filter group has a choice", async () => {
    await handleUpdate(db, tg, text("/start"));
    await handleUpdate(db, tg, tap("t:posts:mumbai"));
    await handleUpdate(db, tg, tap("t:visaClasses:b1b2"));
    expect(lastText()).toContain("Pick at least one");

    await handleUpdate(db, tg, tap("t:kinds:ofc"));
    expect(lastText()).toContain("Alerts are on.");
  });

  it("sets and clears a date range, rejecting bad input", async () => {
    await handleUpdate(db, tg, text("/start"));

    await handleUpdate(db, tg, text("/dates 2027-03-31 2027-01-01"));
    expect(lastText()).toContain("YYYY-MM-DD");

    await handleUpdate(db, tg, text("/dates 2027-01-01 2027-03-31"));
    expect(await subscriber()).toMatchObject({ dateFrom: "2027-01-01", dateTo: "2027-03-31" });

    await handleUpdate(db, tg, text("/dates - 2027-02-15"));
    const onlyEnd = await subscriber();
    expect(onlyEnd!.dateFrom).toBeUndefined();
    expect(onlyEnd!.dateTo).toBe("2027-02-15");

    await handleUpdate(db, tg, text("/dates any"));
    const cleared = await subscriber();
    expect(cleared!.dateFrom).toBeUndefined();
    expect(cleared!.dateTo).toBeUndefined();
  });

  it("pauses, resumes, and deletes on /stop", async () => {
    await handleUpdate(db, tg, text("/start"));
    await handleUpdate(db, tg, text("/pause"));
    expect((await subscriber())!.paused).toBe(true);
    await handleUpdate(db, tg, text("/resume"));
    expect((await subscriber())!.paused).toBe(false);
    await handleUpdate(db, tg, text("/stop"));
    expect(await subscriber()).toBeNull();
  });

  it("/test sends a clearly labeled sample alert", async () => {
    await handleUpdate(db, tg, text("/test"));
    expect(lastText()).toContain("Test alert");
    expect(lastText()).toContain("H-1B · Hyderabad · Consular");
  });

  it("ignores messages from groups", async () => {
    await handleUpdate(db, tg, {
      update_id: ++updateId,
      message: { message_id: 9, chat: { id: -5, type: "group" }, text: "/start" },
    });
    expect(sent).toHaveLength(0);
  });
});
