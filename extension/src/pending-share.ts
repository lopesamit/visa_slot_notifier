import { storage } from "#imports";

/** Dates picked up from a right-click, waiting for the popup to show them. */
export type PendingShare = { dates: string[]; at: number };

export const PENDING_SHARE_MS = 5 * 60 * 1000;

export const pendingShare = storage.defineItem<PendingShare | null>("session:pendingShare", {
  fallback: null,
});
