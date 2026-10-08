import type { Db } from "mongodb";
import { collections } from "./db";

/**
 * People who will actually receive an alert: alerts on, and a post, visa
 * class, and appointment type chosen. Paused chats and half-finished setups
 * are left out. This is a count only.
 */
export async function publicStats(db: Db): Promise<{ watching: number }> {
  const watching = await collections(db).subscribers.countDocuments({
    paused: false,
    "posts.0": { $exists: true },
    "visaClasses.0": { $exists: true },
    "kinds.0": { $exists: true },
  });
  return { watching };
}
