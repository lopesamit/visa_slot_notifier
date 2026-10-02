import type { Db, Filter } from "mongodb";
import { WAVE_MS, slotKey, type Slot } from "@visa-slot/shared";
import { collections, isDuplicateKey, type SlotEvent, type Subscriber } from "./db";

export type SightingResult = {
  /** True for exactly one report per wave: that caller sends the alerts. */
  newWave: boolean;
  waveId: string;
  event: SlotEvent;
};

const waveIdOf = (key: string, waveStartedAt: Date) =>
  `${key}@${waveStartedAt.getTime()}`;

/**
 * Records that `slot` was seen. However many reports for the same slot arrive
 * at once, only one of them gets `newWave: true` per WAVE_MS window.
 */
export async function recordSighting(
  db: Db,
  slot: Slot,
  now: Date = new Date(),
): Promise<SightingResult> {
  const { slotEvents } = collections(db);
  const key = slotKey(slot);
  const cutoff = new Date(now.getTime() - WAVE_MS);

  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await slotEvents.findOneAndUpdate(
      { key, waveStartedAt: { $gt: cutoff } },
      { $set: { lastSeenAt: now }, $inc: { waveReports: 1, totalReports: 1 } },
      { returnDocument: "after" },
    );
    if (current) {
      return { newWave: false, waveId: waveIdOf(key, current.waveStartedAt), event: current };
    }

    const renewed = await slotEvents.findOneAndUpdate(
      { key, waveStartedAt: { $lte: cutoff } },
      {
        $set: { waveStartedAt: now, lastSeenAt: now, waveReports: 1 },
        $inc: { totalReports: 1 },
      },
      { returnDocument: "after" },
    );
    if (renewed) {
      return { newWave: true, waveId: waveIdOf(key, now), event: renewed };
    }

    const event: SlotEvent = {
      key,
      ...slot,
      firstSeenAt: now,
      waveStartedAt: now,
      lastSeenAt: now,
      waveReports: 1,
      totalReports: 1,
    };
    try {
      await slotEvents.insertOne({ ...event });
      return { newWave: true, waveId: waveIdOf(key, now), event };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }

  throw new Error(`Could not record sighting for ${key}`);
}

export async function findMatchingSubscribers(db: Db, slot: Slot): Promise<Subscriber[]> {
  const filter: Filter<Subscriber> = {
    paused: false,
    posts: slot.post,
    visaClasses: slot.visaClass,
    kinds: slot.kind,
    $and: [
      { $or: [{ dateFrom: { $exists: false } }, { dateFrom: { $lte: slot.date } }] },
      { $or: [{ dateTo: { $exists: false } }, { dateTo: { $gte: slot.date } }] },
    ],
  };
  return collections(db).subscribers.find(filter).toArray();
}

/** Returns true the first time a chat is claimed for a wave, false after that. */
export async function claimDelivery(
  db: Db,
  waveId: string,
  chatId: number,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    await collections(db).deliveries.insertOne({ waveId, chatId, sentAt: now });
    return true;
  } catch (error) {
    if (isDuplicateKey(error)) return false;
    throw error;
  }
}
