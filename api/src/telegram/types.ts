/** The subset of Telegram's Update object this bot reads. */
export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number };
    message?: TelegramMessage;
    data?: string;
  };
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
};
