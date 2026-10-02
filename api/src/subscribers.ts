import type { Db } from "mongodb";
import { collections, type Subscriber } from "./db";

export type FilterField = "posts" | "visaClasses" | "kinds";

export async function getOrCreateSubscriber(
  db: Db,
  chatId: number,
  now: Date = new Date(),
): Promise<Subscriber> {
  const subscriber = await collections(db).subscribers.findOneAndUpdate(
    { chatId },
    {
      $setOnInsert: {
        chatId,
        posts: [],
        visaClasses: [],
        kinds: [],
        paused: false,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return subscriber!;
}

export function getSubscriber(db: Db, chatId: number): Promise<Subscriber | null> {
  return collections(db).subscribers.findOne({ chatId });
}

/** Adds `value` to the filter list if missing, removes it if present. */
export async function toggleFilter(
  db: Db,
  chatId: number,
  field: FilterField,
  value: string,
  now: Date = new Date(),
): Promise<Subscriber | null> {
  const path = `$${field}`;
  return collections(db).subscribers.findOneAndUpdate(
    { chatId },
    [
      {
        $set: {
          [field]: {
            $cond: [
              { $in: [value, path] },
              { $setDifference: [path, [value]] },
              { $concatArrays: [path, [value]] },
            ],
          },
          updatedAt: now,
        },
      },
    ],
    { returnDocument: "after" },
  );
}

export async function setPaused(
  db: Db,
  chatId: number,
  paused: boolean,
  now: Date = new Date(),
): Promise<Subscriber | null> {
  return collections(db).subscribers.findOneAndUpdate(
    { chatId },
    { $set: { paused, updatedAt: now } },
    { returnDocument: "after" },
  );
}

export async function setDateRange(
  db: Db,
  chatId: number,
  range: { from?: string; to?: string },
  now: Date = new Date(),
): Promise<Subscriber | null> {
  const set: Partial<Subscriber> = { updatedAt: now };
  const unset: Record<string, ""> = {};
  if (range.from) set.dateFrom = range.from;
  else unset.dateFrom = "";
  if (range.to) set.dateTo = range.to;
  else unset.dateTo = "";
  return collections(db).subscribers.findOneAndUpdate(
    { chatId },
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after" },
  );
}

export async function deleteSubscriber(db: Db, chatId: number): Promise<void> {
  await collections(db).subscribers.deleteOne({ chatId });
}

export const hasCompleteFilters = (s: Subscriber) =>
  s.posts.length > 0 && s.visaClasses.length > 0 && s.kinds.length > 0;
