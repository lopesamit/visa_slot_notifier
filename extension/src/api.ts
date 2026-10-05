import type { AppointmentKind, PostId, VisaClassId } from "@visa-slot/shared";

export type Filters = {
  posts: PostId[];
  visaClasses: VisaClassId[];
  kinds: AppointmentKind[];
  dateFrom: string | null;
  dateTo: string | null;
  paused: boolean;
};

export type Subscription = { connected: false } | ({ connected: true } & Filters);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${__API_BASE__}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection.");
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(data.error ?? `Server error (${response.status})`, response.status);
  }
  return data;
}

export type DateShare = {
  post: PostId;
  visaClass: VisaClassId;
  kind: AppointmentKind;
  dates: string[];
};

export const shareDates = (linkKey: string, share: DateShare) =>
  post<{ ok: true; newSlots: number; alerted: number }>("/api/share", { linkKey, ...share });

export const fetchSubscription = (linkKey: string) =>
  post<Subscription>("/api/subscription", { action: "status", linkKey });

export const saveFilters = (linkKey: string, filters: Filters) =>
  post<Subscription>("/api/subscription", {
    action: "update",
    linkKey,
    ...filters,
    dateFrom: filters.dateFrom ?? undefined,
    dateTo: filters.dateTo ?? undefined,
  });

export const disconnectTelegram = (linkKey: string) =>
  post<Subscription>("/api/subscription", { action: "disconnect", linkKey });
