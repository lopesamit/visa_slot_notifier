export const SITE_URL = "https://freevisaslotnotifier.com";
export const BOT_USERNAME = "VisaSlotNotifierForAllFreeBot";
export const KOFI_URL = "https://ko-fi.com/visasolthelper";
/** Shows the Ko-fi link on the site, popup, and bot. Off until the service has earned trust. */
export const DONATIONS_ENABLED = false;

/**
 * Secret the extension uses to manage its linked Telegram chat. It travels
 * as the bot's /start payload, which Telegram limits to 64 URL-safe characters.
 */
export const LINK_KEY_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
