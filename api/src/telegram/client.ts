export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export type SendOptions = { replyMarkup?: InlineKeyboard };

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    readonly description: string,
    /** Seconds Telegram asks us to wait, on 429 responses. */
    readonly retryAfter?: number,
  ) {
    super(`Telegram ${method} failed (${status}): ${description}`);
  }

  /** The user blocked the bot or deleted the chat; stop messaging them. */
  get chatGone(): boolean {
    return this.status === 403 || /chat not found/i.test(this.description);
  }
}

export interface TelegramApi {
  call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  sendMessage(chatId: number, text: string, options?: SendOptions): Promise<void>;
  editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: SendOptions,
  ): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
}

export function createTelegramApi(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  const call = async <T>(method: string, params: Record<string, unknown> = {}): Promise<T> => {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      error_code?: number;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (!body.ok) {
      throw new TelegramError(
        method,
        body.error_code ?? response.status,
        body.description ?? response.statusText,
        body.parameters?.retry_after,
      );
    }
    return body.result as T;
  };

  return {
    call,
    async sendMessage(chatId, text, options = {}) {
      await call("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: options.replyMarkup,
      });
    },
    async editMessageText(chatId, messageId, text, options = {}) {
      try {
        await call("editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: options.replyMarkup,
        });
      } catch (error) {
        if (error instanceof TelegramError && /message is not modified/i.test(error.description)) {
          return;
        }
        throw error;
      }
    },
    async answerCallbackQuery(callbackQueryId, text) {
      await call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
    },
  };
}

let shared: TelegramApi | undefined;

export function getTelegram(): TelegramApi {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  shared ??= createTelegramApi(token);
  return shared;
}

export const BOT_COMMANDS = [
  { command: "filters", description: "Choose posts, visa classes, and OFC or consular" },
  { command: "dates", description: "Limit alerts to a date range" },
  { command: "status", description: "Show what you are watching" },
  { command: "test", description: "Send a sample alert" },
  { command: "pause", description: "Stop alerts for now" },
  { command: "resume", description: "Turn alerts back on" },
  { command: "stop", description: "Delete your filters and stop alerts" },
  { command: "help", description: "How this bot works" },
];
