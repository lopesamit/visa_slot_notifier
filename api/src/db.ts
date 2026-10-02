import { MongoClient, MongoServerError, type Db } from "mongodb";
import type { AppointmentKind, PostId, VisaClassId } from "@visa-slot/shared";

export type SlotEvent = {
  key: string;
  post: PostId;
  visaClass: VisaClassId;
  kind: AppointmentKind;
  date: string;
  firstSeenAt: Date;
  waveStartedAt: Date;
  lastSeenAt: Date;
  /** Reports received in the current wave. */
  waveReports: number;
  totalReports: number;
};

export type Subscriber = {
  chatId: number;
  posts: PostId[];
  visaClasses: VisaClassId[];
  kinds: AppointmentKind[];
  /** Inclusive YYYY-MM-DD bounds. Omitted means no bound. */
  dateFrom?: string;
  dateTo?: string;
  paused: boolean;
  /** sha256 of the Chrome extension's link key, once the chat is connected. */
  linkKeyHash?: string;
  linkedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type Delivery = {
  waveId: string;
  chatId: number;
  sentAt: Date;
};

export type RateLimitBucket = {
  /** `<scope>:<id>:<window number>` */
  _id: string;
  count: number;
  expiresAt: Date;
};

export const collections = (db: Db) => ({
  slotEvents: db.collection<SlotEvent>("slot_events"),
  subscribers: db.collection<Subscriber>("subscribers"),
  deliveries: db.collection<Delivery>("deliveries"),
  rateLimits: db.collection<RateLimitBucket>("rate_limits"),
});

export const isDuplicateKey = (error: unknown) =>
  error instanceof MongoServerError && error.code === 11000;

let clientPromise: Promise<MongoClient> | undefined;

/**
 * One client per function instance. Warm invocations reuse it so the shared
 * Atlas cluster is not opened once per request.
 */
export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  // Netlify cuts synchronous functions off at 10s; fail before that so the error is logged.
  clientPromise ??= new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  }).connect();
  try {
    const client = await clientPromise;
    return client.db(process.env.MONGODB_DB || "visa_slot_notifier");
  } catch (error) {
    clientPromise = undefined;
    throw error;
  }
}

export async function ensureIndexes(db: Db): Promise<void> {
  const { slotEvents, subscribers, deliveries, rateLimits } = collections(db);
  await Promise.all([
    rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "rate_limits_ttl" }),
    slotEvents.createIndex({ key: 1 }, { unique: true, name: "slot_key_unique" }),
    slotEvents.createIndex(
      { lastSeenAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 30, name: "slot_events_ttl_30d" },
    ),
    slotEvents.createIndex({ post: 1, visaClass: 1, kind: 1, date: 1 }, { name: "board" }),
    subscribers.createIndex({ chatId: 1 }, { unique: true, name: "chat_id_unique" }),
    subscribers.createIndex({ paused: 1, posts: 1 }, { name: "match_by_post" }),
    subscribers.createIndex(
      { linkKeyHash: 1 },
      { unique: true, partialFilterExpression: { linkKeyHash: { $type: "string" } }, name: "link_key_unique" },
    ),
    deliveries.createIndex(
      { waveId: 1, chatId: 1 },
      { unique: true, name: "one_delivery_per_wave" },
    ),
    deliveries.createIndex(
      { sentAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 7, name: "deliveries_ttl_7d" },
    ),
  ]);
}
