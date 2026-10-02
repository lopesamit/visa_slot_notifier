import { MongoClient } from "mongodb";
import { handleUpdate } from "../src/bot";
import { ensureIndexes } from "../src/db";
import { BOT_COMMANDS, createTelegramApi } from "../src/telegram/client";
import type { TelegramUpdate } from "../src/telegram/types";

const token = process.env.TELEGRAM_BOT_TOKEN;
const uri = process.env.MONGODB_URI;
if (!token || !uri) {
  console.error("Set TELEGRAM_BOT_TOKEN and MONGODB_URI in .env at the repo root.");
  process.exit(1);
}

const tg = createTelegramApi(token);
const webhook = await tg.call<{ url: string }>("getWebhookInfo");
if (webhook.url && !process.argv.includes("--take-over")) {
  console.error(
    `The bot already has a webhook (${webhook.url}), so Telegram sends updates there.\n` +
      "Run with --take-over to remove it and poll locally. Run bot:webhook afterwards to restore it.",
  );
  process.exit(1);
}
if (webhook.url) await tg.call("deleteWebhook");

const me = await tg.call<{ username: string }>("getMe");
await tg.call("setMyCommands", { commands: BOT_COMMANDS });

const client = await new MongoClient(uri).connect();
const db = client.db(process.env.MONGODB_DB || "visa_slot_notifier");
await ensureIndexes(db);

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
  console.log("\nStopping after the current poll...");
});

console.log(`Polling as @${me.username}. Message https://t.me/${me.username} and press Start.`);

let offset = 0;
while (!stopping) {
  try {
    const updates = await tg.call<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["message", "callback_query"],
    });
    for (const update of updates) {
      offset = update.update_id + 1;
      const what = update.message?.text ?? update.callback_query?.data ?? "update";
      console.log(`← ${what}`);
      await handleUpdate(db, tg, update).catch((error) => console.error("handler failed", error));
    }
  } catch (error) {
    console.error("poll failed, retrying in 3s", error);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

await client.close();
