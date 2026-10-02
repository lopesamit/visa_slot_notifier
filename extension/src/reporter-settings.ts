import type { AppointmentKind, PostId, VisaClassId } from "@visa-slot/shared";
import { storage } from "#imports";

export type ReporterSettings = {
  enabled: boolean;
  /** The calendar page does not show the visa class, so the user picks it. */
  visaClass: VisaClassId | null;
};

export type LastReport = {
  at: number;
  post: PostId;
  visaClass: VisaClassId;
  kind: AppointmentKind;
  dates: number;
  result: "shared" | "already-shared" | "rate-limited" | "failed";
};

export const reporterSettings = storage.defineItem<ReporterSettings>("local:reporter", {
  fallback: { enabled: true, visaClass: null },
});

export const lastReport = storage.defineItem<LastReport | null>("local:lastReport", {
  fallback: null,
});

/** Report keys already sent in this browser session, with the time sent. */
export const recentReports = storage.defineItem<Record<string, number>>("session:recentReports", {
  fallback: {},
});
