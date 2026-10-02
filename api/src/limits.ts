import type { Db } from "mongodb";
import { collections, isDuplicateKey } from "./db";

/**
 * Counts one hit against `key` in a fixed window. Returns false once the
 * window already has `limit` hits.
 */
export async function hitLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<boolean> {
  const windowNumber = Math.floor(now.getTime() / windowMs);
  const _id = `${key}:${windowNumber}`;
  const expiresAt = new Date((windowNumber + 1) * windowMs);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const bucket = await collections(db).rateLimits.findOneAndUpdate(
        { _id },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, returnDocument: "after" },
      );
      return bucket!.count <= limit;
    } catch (error) {
      // Two first hits in the same window can race on the upsert; the retry increments.
      if (!isDuplicateKey(error)) throw error;
    }
  }
  return false;
}
