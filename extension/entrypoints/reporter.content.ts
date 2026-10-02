import type { PostId } from "@visa-slot/shared";
import {
  CALENDAR_MESSAGE,
  extractDates,
  isCalendarRequest,
  kindFromRequest,
  postFromLabel,
  postIdFromRequestBody,
  SCHEDULER_MATCHES,
  type CalendarDates,
  type CalendarMessage,
} from "../src/scheduler";

/** Turns calendar responses into post, kind, and dates for the background. */
export default defineContentScript({
  matches: SCHEDULER_MATCHES,
  runAt: "document_start",
  main() {
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as Partial<CalendarMessage> | null;
      if (data?.source !== CALENDAR_MESSAGE) return;
      const { url, requestBody, responseBody } = data;
      if (typeof url !== "string" || typeof responseBody !== "string" || !isCalendarRequest(url)) {
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(responseBody);
      } catch {
        return;
      }
      const dates = extractDates(parsed);
      const kind = kindFromRequest(url, window.location.pathname);
      const post = findPost(typeof requestBody === "string" ? requestBody : "");
      if (!dates.length || !kind || !post) return;

      const message: CalendarDates = { type: "calendar-dates", post, kind, dates };
      browser.runtime.sendMessage(message).catch(() => {});
    });
  },
});

/**
 * The request names the post by the site's own id; the location dropdown
 * shows its name. Only dropdowns that look like the location picker are used,
 * because other dropdowns (such as document delivery) also list cities.
 */
function findPost(requestBody: string): PostId | null {
  const postId = postIdFromRequestBody(requestBody);
  if (postId) {
    for (const option of document.querySelectorAll("option")) {
      if (option.value === postId) return postFromLabel(option.textContent);
    }
  }
  for (const select of document.querySelectorAll("select")) {
    if (!/post|location|consul|vac/i.test(`${select.id} ${select.name}`)) continue;
    const post = postFromLabel(select.selectedOptions[0]?.textContent);
    if (post) return post;
  }
  return null;
}
