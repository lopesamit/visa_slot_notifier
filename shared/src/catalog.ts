export const POSTS = [
  { id: "chennai", label: "Chennai" },
  { id: "hyderabad", label: "Hyderabad" },
  { id: "kolkata", label: "Kolkata" },
  { id: "mumbai", label: "Mumbai" },
  { id: "new-delhi", label: "New Delhi" },
] as const;

export const VISA_CLASSES = [
  { id: "h1b", label: "H-1B" },
  { id: "h4", label: "H-4" },
  { id: "b1b2", label: "B-1/B-2" },
  { id: "f1f2", label: "F-1/F-2" },
  { id: "l1l2", label: "L-1/L-2" },
] as const;

export const APPOINTMENT_KINDS = [
  { id: "ofc", label: "OFC" },
  { id: "consular", label: "Consular" },
] as const;

export type PostId = (typeof POSTS)[number]["id"];
export type VisaClassId = (typeof VISA_CLASSES)[number]["id"];
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number]["id"];

/** A slot seen again within this window is the same wave: no second alert. */
export const WAVE_MS = 12 * 60 * 60 * 1000;

const postIds = new Set<string>(POSTS.map((p) => p.id));
const visaIds = new Set<string>(VISA_CLASSES.map((v) => v.id));
const kindIds = new Set<string>(APPOINTMENT_KINDS.map((k) => k.id));

export const isPostId = (value: string): value is PostId => postIds.has(value);
export const isVisaClassId = (value: string): value is VisaClassId =>
  visaIds.has(value);
export const isAppointmentKind = (value: string): value is AppointmentKind =>
  kindIds.has(value);
