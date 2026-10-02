import {
  isAppointmentKind,
  isPostId,
  isVisaClassId,
  type AppointmentKind,
  type PostId,
  type VisaClassId,
} from "./catalog";

export type Slot = {
  post: PostId;
  visaClass: VisaClassId;
  kind: AppointmentKind;
  /** Appointment date as shown on the scheduler, YYYY-MM-DD. */
  date: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** Returns a Slot when every field is a known value, otherwise null. */
export function parseSlot(input: {
  post: string;
  visaClass: string;
  kind: string;
  date: string;
}): Slot | null {
  const { post, visaClass, kind, date } = input;
  if (!isPostId(post) || !isVisaClassId(visaClass) || !isAppointmentKind(kind)) {
    return null;
  }
  if (!isIsoDate(date)) return null;
  return { post, visaClass, kind, date };
}

/**
 * Identity of an opening. Every browser that reports the same slot produces
 * the same key, which the database uses to send the alert only once per wave.
 */
export function slotKey(slot: Slot): string {
  return [slot.post, slot.visaClass, slot.kind, slot.date].join("|");
}
