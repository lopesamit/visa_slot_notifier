import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import {
  LINK_KEY_PATTERN,
  isAppointmentKind,
  isIsoDate,
  isPostId,
  isVisaClassId,
  type AppointmentKind,
  type PostId,
  type VisaClassId,
} from "@visa-slot/shared";
import { collections, type Subscriber } from "./db";
import { getOrCreateSubscriber } from "./subscribers";

export const isLinkKey = (value: unknown): value is string =>
  typeof value === "string" && LINK_KEY_PATTERN.test(value);

const hashLinkKey = (linkKey: string) => createHash("sha256").update(linkKey).digest("hex");

/** Connects a Telegram chat to the extension holding `linkKey`. One chat per key. */
export async function linkChat(db: Db, chatId: number, linkKey: string, now: Date = new Date()) {
  const linkKeyHash = hashLinkKey(linkKey);
  const { subscribers } = collections(db);
  await subscribers.updateMany(
    { linkKeyHash, chatId: { $ne: chatId } },
    { $unset: { linkKeyHash: "", linkedAt: "" }, $set: { updatedAt: now } },
  );
  await getOrCreateSubscriber(db, chatId, now);
  return subscribers.findOneAndUpdate(
    { chatId },
    { $set: { linkKeyHash, linkedAt: now, updatedAt: now } },
    { returnDocument: "after" },
  );
}

export function findByLinkKey(db: Db, linkKey: string): Promise<Subscriber | null> {
  return collections(db).subscribers.findOne({ linkKeyHash: hashLinkKey(linkKey) });
}

export type FilterUpdate = {
  posts: PostId[];
  visaClasses: VisaClassId[];
  kinds: AppointmentKind[];
  dateFrom?: string;
  dateTo?: string;
  paused: boolean;
};

function pickList<T extends string>(value: unknown, isValid: (v: string) => v is T): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = [...new Set(value)];
  return items.every((v): v is T => typeof v === "string" && isValid(v)) ? items : null;
}

const optionalDate = (value: unknown): string | undefined | null => {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" && isIsoDate(value) ? value : null;
};

export function parseFilterUpdate(body: Record<string, unknown>): FilterUpdate | string {
  const posts = pickList(body.posts, isPostId);
  const visaClasses = pickList(body.visaClasses, isVisaClassId);
  const kinds = pickList(body.kinds, isAppointmentKind);
  if (!posts || !visaClasses || !kinds) return "posts, visaClasses, and kinds must list known values";

  const dateFrom = optionalDate(body.dateFrom);
  const dateTo = optionalDate(body.dateTo);
  if (dateFrom === null || dateTo === null) return "Dates must be YYYY-MM-DD";
  if (dateFrom && dateTo && dateFrom > dateTo) return "dateFrom must not be after dateTo";
  if (typeof body.paused !== "boolean") return "paused must be true or false";

  return { posts, visaClasses, kinds, dateFrom, dateTo, paused: body.paused };
}

export async function updateByLinkKey(
  db: Db,
  linkKey: string,
  update: FilterUpdate,
  now: Date = new Date(),
): Promise<Subscriber | null> {
  const { dateFrom, dateTo, ...rest } = update;
  const unset: Record<string, ""> = {};
  if (!dateFrom) unset.dateFrom = "";
  if (!dateTo) unset.dateTo = "";
  return collections(db).subscribers.findOneAndUpdate(
    { linkKeyHash: hashLinkKey(linkKey) },
    {
      $set: {
        ...rest,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        updatedAt: now,
      },
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
    { returnDocument: "after" },
  );
}

export async function unlinkByLinkKey(db: Db, linkKey: string, now: Date = new Date()) {
  await collections(db).subscribers.updateOne(
    { linkKeyHash: hashLinkKey(linkKey) },
    { $unset: { linkKeyHash: "", linkedAt: "" }, $set: { updatedAt: now } },
  );
}

/** What the extension is allowed to see about its linked chat. */
export function subscriptionView(s: Subscriber | null) {
  if (!s) return { connected: false as const };
  return {
    connected: true as const,
    posts: s.posts,
    visaClasses: s.visaClasses,
    kinds: s.kinds,
    dateFrom: s.dateFrom ?? null,
    dateTo: s.dateTo ?? null,
    paused: s.paused,
  };
}
