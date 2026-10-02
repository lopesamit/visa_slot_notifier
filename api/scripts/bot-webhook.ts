import { SITE_URL } from "@visa-slot/shared";
import { BOT_COMMANDS, createTelegramApi } from "../src/telegram/client";

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
// Telegram does not follow redirects, and Netlify redirects *.netlify.app to the primary domain.
const siteUrl = process.env.WEBHOOK_BASE_URL || SITE_URL;
if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in .env at the repo root.");
  process.exit(1);
}

const tg = createTelegramApi(token);
const url = `${siteUrl}/api/telegram`;

await tg.call("setWebhook", {
  url,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
await tg.call("setMyCommands", { commands: BOT_COMMANDS });

const info = await tg.call<{ url: string; pending_update_count: number; last_error_message?: string }>(
  "getWebhookInfo",
);
console.log(`Webhook set to ${info.url}`);
if (info.last_error_message) console.log(`Last delivery error: ${info.last_error_message}`);
