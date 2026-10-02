import type { Db } from "mongodb";
import {
  isAppointmentKind,
  isIsoDate,
  isPostId,
  isVisaClassId,
  type Slot,
} from "@visa-slot/shared";
import type { Subscriber } from "./db";
import { isLinkKey, linkChat } from "./links";
import {
  deleteSubscriber,
  getOrCreateSubscriber,
  getSubscriber,
  setDateRange,
  setPaused,
  toggleFilter,
  type FilterField,
} from "./subscribers";
import type { TelegramApi } from "./telegram/client";
import {
  datesUsageText,
  filtersKeyboard,
  filtersMenuText,
  helpText,
  linkedText,
  slotAlertText,
  statusText,
  welcomeText,
} from "./telegram/messages";
import type { TelegramMessage, TelegramUpdate } from "./telegram/types";

const FILTER_VALUE_CHECKS: Record<FilterField, (value: string) => boolean> = {
  posts: isPostId,
  visaClasses: isVisaClassId,
  kinds: isAppointmentKind,
};

const isFilterToggle = (field: string, value: string): field is FilterField =>
  Object.hasOwn(FILTER_VALUE_CHECKS, field) &&
  FILTER_VALUE_CHECKS[field as FilterField](value);

export async function handleUpdate(
  db: Db,
  tg: TelegramApi,
  update: TelegramUpdate,
  now: Date = new Date(),
): Promise<void> {
  if (update.callback_query) {
    await handleCallback(db, tg, update.callback_query, now);
    return;
  }
  const message = update.message;
  if (message?.text && message.chat.type === "private") {
    await handleCommand(db, tg, message, now);
  }
}

function parseCommand(text: string): { command: string; args: string[] } | null {
  const [first, ...args] = text.trim().split(/\s+/);
  if (!first?.startsWith("/")) return null;
  return { command: first.slice(1).split("@")[0].toLowerCase(), args };
}

async function sendFilters(tg: TelegramApi, s: Subscriber) {
  await tg.sendMessage(s.chatId, filtersMenuText(s), { replyMarkup: filtersKeyboard(s) });
}

async function handleCommand(db: Db, tg: TelegramApi, message: TelegramMessage, now: Date) {
  const chatId = message.chat.id;
  const parsed = parseCommand(message.text!);

  if (!parsed) {
    await tg.sendMessage(chatId, "Send /filters to choose what to watch, or /help.");
    return;
  }

  switch (parsed.command) {
    case "start": {
      const linkKey = parsed.args[0];
      if (isLinkKey(linkKey)) {
        const s = await linkChat(db, chatId, linkKey, now);
        await tg.sendMessage(chatId, linkedText());
        await sendFilters(tg, s!);
        return;
      }
      const s = await getOrCreateSubscriber(db, chatId, now);
      await tg.sendMessage(chatId, welcomeText());
      await sendFilters(tg, s);
      return;
    }
    case "filters":
      await sendFilters(tg, await getOrCreateSubscriber(db, chatId, now));
      return;
    case "status": {
      const s = await getSubscriber(db, chatId);
      await tg.sendMessage(chatId, s ? statusText(s) : "You are not watching anything yet. Send /start.");
      return;
    }
    case "pause":
    case "resume": {
      const s = await setPaused(db, chatId, parsed.command === "pause", now);
      await tg.sendMessage(
        chatId,
        !s
          ? "You are not watching anything yet. Send /start."
          : s.paused
            ? "Alerts paused. Send /resume to turn them back on."
            : "Alerts are back on.",
      );
      return;
    }
    case "dates":
      await handleDates(db, tg, chatId, parsed.args, now);
      return;
    case "test": {
      const s = await getSubscriber(db, chatId);
      const slot: Slot = {
        post: s?.posts[0] ?? "hyderabad",
        visaClass: s?.visaClasses[0] ?? "h1b",
        kind: s?.kinds[0] ?? "consular",
        date: s?.dateFrom ?? "2027-01-05",
      };
      await tg.sendMessage(chatId, slotAlertText(slot, { test: true }));
      return;
    }
    case "stop":
      await deleteSubscriber(db, chatId);
      await tg.sendMessage(
        chatId,
        "Your filters are deleted and alerts are off. Send /start any time to set them up again.",
      );
      return;
    case "help":
      await tg.sendMessage(chatId, helpText());
      return;
    default:
      await tg.sendMessage(chatId, "I don't know that command. Send /help.");
  }
}

async function handleDates(db: Db, tg: TelegramApi, chatId: number, args: string[], now: Date) {
  if (!(await getSubscriber(db, chatId))) {
    await tg.sendMessage(chatId, "Send /start first, then set a date range.");
    return;
  }
  if (args.length === 1 && args[0].toLowerCase() === "any") {
    const s = await setDateRange(db, chatId, {}, now);
    await tg.sendMessage(chatId, statusText(s!));
    return;
  }
  if (args.length !== 2) {
    await tg.sendMessage(chatId, datesUsageText());
    return;
  }
  const [from, to] = args.map((a) => (a === "-" ? undefined : a));
  const valid = [from, to].every((d) => d === undefined || isIsoDate(d));
  if (!valid || (!from && !to) || (from && to && from > to)) {
    await tg.sendMessage(chatId, datesUsageText());
    return;
  }
  const s = await setDateRange(db, chatId, { from, to }, now);
  await tg.sendMessage(chatId, statusText(s!));
}

async function handleCallback(
  db: Db,
  tg: TelegramApi,
  query: NonNullable<TelegramUpdate["callback_query"]>,
  now: Date,
) {
  const message = query.message;
  const chatId = message?.chat.id ?? query.from.id;
  const data = query.data ?? "";

  if (data === "done") {
    const s = await getSubscriber(db, chatId);
    await tg.answerCallbackQuery(query.id);
    if (message && s) await tg.editMessageText(chatId, message.message_id, statusText(s));
    return;
  }

  const [kind, field = "", value = ""] = data.split(":");
  if (kind !== "t" || !isFilterToggle(field, value)) {
    await tg.answerCallbackQuery(query.id);
    return;
  }

  await getOrCreateSubscriber(db, chatId, now);
  const s = await toggleFilter(db, chatId, field, value, now);
  await tg.answerCallbackQuery(query.id);
  if (message && s) {
    await tg.editMessageText(chatId, message.message_id, filtersMenuText(s), {
      replyMarkup: filtersKeyboard(s),
    });
  }
}
