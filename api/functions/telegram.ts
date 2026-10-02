import { timingSafeEqual } from "node:crypto";
import { handleUpdate } from "../src/bot";
import { getDb } from "../src/db";
import { getTelegram } from "../src/telegram/client";
import type { TelegramUpdate } from "../src/telegram/types";

export const config = { path: "/api/telegram", method: "POST" };

function secretMatches(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (request: Request): Promise<Response> => {
  if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update || typeof update.update_id !== "number") {
    return new Response("Bad request", { status: 400 });
  }

  try {
    await handleUpdate(await getDb(), getTelegram(), update);
  } catch (error) {
    // Returning 200 keeps Telegram from retrying the same update forever.
    console.error("telegram update failed", update.update_id, error);
  }
  return new Response("ok");
};
