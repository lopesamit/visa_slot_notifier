import type { Db } from "mongodb";
import type { Slot } from "@visa-slot/shared";
import { collections } from "./db";
import { claimDelivery, findMatchingSubscribers } from "./slots";
import { TelegramError, type TelegramApi } from "./telegram/client";
import { slotAlertText } from "./telegram/messages";

export type FanOutResult = { sent: number; alreadySent: number; failed: number; paused: number };

const SEND_CONCURRENCY = 10;
const MAX_RETRY_WAIT_S = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendWithOneRetry(tg: TelegramApi, chatId: number, text: string) {
  try {
    await tg.sendMessage(chatId, text);
  } catch (error) {
    const wait = error instanceof TelegramError ? error.retryAfter : undefined;
    if (wait === undefined || wait > MAX_RETRY_WAIT_S) throw error;
    await sleep(wait * 1000);
    await tg.sendMessage(chatId, text);
  }
}

/**
 * Sends one alert for `waveId` to every matching subscriber. `claimDelivery`
 * runs before each send, so a chat is never messaged twice for the same wave.
 */
export async function sendSlotAlerts(
  db: Db,
  tg: TelegramApi,
  slot: Slot,
  waveId: string,
  options: { test?: boolean; now?: Date } = {},
): Promise<FanOutResult> {
  const result: FanOutResult = { sent: 0, alreadySent: 0, failed: 0, paused: 0 };
  const queue = await findMatchingSubscribers(db, slot);
  const text = slotAlertText(slot, { test: options.test });

  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      if (!(await claimDelivery(db, waveId, s.chatId, options.now))) {
        result.alreadySent++;
        continue;
      }
      try {
        await sendWithOneRetry(tg, s.chatId, text);
        result.sent++;
      } catch (error) {
        if (error instanceof TelegramError && error.chatGone) {
          await collections(db).subscribers.updateOne(
            { chatId: s.chatId },
            { $set: { paused: true, updatedAt: options.now ?? new Date() } },
          );
          result.paused++;
        } else {
          console.error("alert send failed", s.chatId, error);
          result.failed++;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: SEND_CONCURRENCY }, worker));
  return result;
}
