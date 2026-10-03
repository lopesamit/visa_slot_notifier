/**
 * Donate link. Donations never unlock a feature.
 * PUBLIC_KOFI_URL can override this at build time.
 */
const configured = import.meta.env.PUBLIC_KOFI_URL;

export const kofiUrl =
  typeof configured === "string" && configured.startsWith("https://ko-fi.com/")
    ? configured
    : "https://ko-fi.com/visasolthelper";

export { DONATIONS_ENABLED as showDonate } from "@visa-slot/shared";

export const siteName = "Visa Slot Notifier";

/** Public Cloudflare Web Analytics token. It is meant to appear in the page. */
export const CLOUDFLARE_BEACON_TOKEN = "0c8e266e7ed146d5bac23db1022472b6";
