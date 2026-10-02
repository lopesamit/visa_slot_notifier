import { isAppointmentKind, isPostId } from "@visa-slot/shared";
import { ApiError, sendReport } from "../src/api";
import { getIdentity } from "../src/identity";
import { lastReport, recentReports, reporterSettings, type LastReport } from "../src/reporter-settings";
import { datesToReport, type CalendarDates } from "../src/scheduler";

/** The same calendar seen again within this window is not sent again. */
const RESEND_AFTER_MS = 10 * 60 * 1000;

const schedulerOrigins = new Set(
  ["https://www.usvisascheduling.com", ...(import.meta.env.DEV ? ["http://localhost:8787"] : [])],
);

const isCalendarDates = (message: unknown): message is CalendarDates => {
  const m = message as Partial<CalendarDates> | null;
  return (
    m?.type === "calendar-dates" &&
    typeof m.post === "string" &&
    isPostId(m.post) &&
    typeof m.kind === "string" &&
    isAppointmentKind(m.kind) &&
    Array.isArray(m.dates) &&
    m.dates.every((d) => typeof d === "string")
  );
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || !sender.tab || !sender.url) return;
    if (!schedulerOrigins.has(new URL(sender.url).origin) || !isCalendarDates(message)) return;
    void report(message);
  });
});

async function report({ post, kind, dates: seen }: CalendarDates) {
  const settings = await reporterSettings.getValue();
  if (!settings.enabled || !settings.visaClass) return;
  const dates = datesToReport(seen);
  if (!dates.length) return;

  const visaClass = settings.visaClass;
  const key = [post, visaClass, kind, ...dates].join("|");
  const now = Date.now();
  const recent = Object.fromEntries(
    Object.entries(await recentReports.getValue()).filter(([, at]) => now - at < RESEND_AFTER_MS),
  );
  if (recent[key]) return;
  recent[key] = now;
  await recentReports.setValue(recent);

  let result: LastReport["result"];
  try {
    const { installId } = await getIdentity();
    const { newSlots } = await sendReport({ installId, post, visaClass, kind, dates });
    result = newSlots > 0 ? "shared" : "already-shared";
  } catch (error) {
    result = error instanceof ApiError && error.status === 429 ? "rate-limited" : "failed";
    delete recent[key];
    await recentReports.setValue(recent);
  }
  await lastReport.setValue({ at: now, post, visaClass, kind, dates: dates.length, result });
}
