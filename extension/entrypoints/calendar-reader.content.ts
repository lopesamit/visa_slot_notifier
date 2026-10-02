import {
  CALENDAR_MESSAGE,
  isCalendarRequest,
  SCHEDULER_MATCHES,
  type CalendarMessage,
} from "../src/scheduler";

/** Calendar responses are small; anything larger is not one. */
const MAX_RESPONSE_CHARS = 200_000;

/**
 * Runs in the page so it can see the calendar data the site fetches for
 * itself. It only reads copies of those responses; it never sends requests,
 * clicks, or types.
 */
export default defineContentScript({
  matches: SCHEDULER_MATCHES,
  world: "MAIN",
  runAt: "document_start",
  main() {
    const forward = (url: string, requestBody: unknown, responseBody: string) => {
      if (responseBody.length > MAX_RESPONSE_CHARS) return;
      const message: CalendarMessage = {
        source: CALENDAR_MESSAGE,
        url,
        requestBody: bodyText(requestBody),
        responseBody,
      };
      window.postMessage(message, window.location.origin);
    };

    const pageFetch = window.fetch;
    window.fetch = async function (input, init) {
      const response = await pageFetch.call(this, input, init);
      const url = input instanceof Request ? input.url : String(input);
      if (isCalendarRequest(url)) {
        response
          .clone()
          .text()
          .then((text) => forward(url, init?.body, text))
          .catch(() => {});
      }
      return response;
    };

    const requestUrls = new WeakMap<XMLHttpRequest, string>();
    const pageOpen = XMLHttpRequest.prototype.open;
    const pageSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: unknown[]) {
      requestUrls.set(this, String(args[1]));
      return (pageOpen as (...a: unknown[]) => void).apply(this, args);
    };
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body) {
      const url = requestUrls.get(this);
      if (url && isCalendarRequest(url)) {
        this.addEventListener("load", () => {
          const text = responseText(this);
          if (text !== null) forward(url, body, text);
        });
      }
      return pageSend.call(this, body);
    };
  },
});

function bodyText(body: unknown): string {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    return new URLSearchParams(
      [...body.entries()].flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
    ).toString();
  }
  return "";
}

function responseText(xhr: XMLHttpRequest): string | null {
  if (xhr.responseType === "" || xhr.responseType === "text") return xhr.responseText;
  if (xhr.responseType === "json") return JSON.stringify(xhr.response);
  return null;
}
