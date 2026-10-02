import { MongoClient } from "mongodb";
import { collections } from "../src/db";
import { MOCK_DATES } from "./mock-scheduler";

/** Deletes the slots and deliveries created by reports from the mock scheduler. */
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Set MONGODB_URI in .env at the repo root.");
  process.exit(1);
}

const client = await new MongoClient(uri).connect();
try {
  const { slotEvents, deliveries } = collections(client.db(process.env.MONGODB_DB || "visa_slot_notifier"));
  const dates = [...MOCK_DATES.ofc, ...MOCK_DATES.consular];
  const datePattern = dates.map((d) => d.replace(/-/g, "\\-")).join("|");
  const slots = await slotEvents.deleteMany({ date: { $in: dates } });
  const sent = await deliveries.deleteMany({ waveId: { $regex: `\\|(${datePattern})@` } });
  console.log(`Deleted ${slots.deletedCount} mock slots and ${sent.deletedCount} deliveries.`);
} finally {
  await client.close();
}
