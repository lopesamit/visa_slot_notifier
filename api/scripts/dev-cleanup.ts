import { MongoClient } from "mongodb";
import { collections } from "../src/db";

/**
 * Deletes test shares: slots dated in August 2028 and their deliveries. The
 * local API accepts only that month, so test shares never look like real openings.
 */
const TEST_MONTH = "2028-08";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Set MONGODB_URI in .env at the repo root.");
  process.exit(1);
}

const client = await new MongoClient(uri).connect();
try {
  const { slotEvents, deliveries } = collections(client.db(process.env.MONGODB_DB || "visa_slot_notifier"));
  const slots = await slotEvents.deleteMany({ date: { $regex: `^${TEST_MONTH}-` } });
  const sent = await deliveries.deleteMany({ waveId: { $regex: `\\|${TEST_MONTH}-\\d\\d@` } });
  console.log(`Deleted ${slots.deletedCount} test slots and ${sent.deletedCount} deliveries.`);
} finally {
  await client.close();
}
