import { MongoClient } from "mongodb";
import { slotKey, type Slot } from "@visa-slot/shared";
import { collections, ensureIndexes } from "../src/db";
import { processReport } from "../src/report";
import { findMatchingSubscribers } from "../src/slots";
import { createTelegramApi } from "../src/telegram/client";

/**
 * Sends many simultaneous reports of one slot through the real database and
 * Telegram, then deletes what it created. Alerts are labeled as tests.
 *
 *   npm run report:simulate -w api -- mumbai h1b ofc 2027-06-15 25
 */
const [post = "mumbai", visaClass = "h1b", kind = "ofc", date = "2027-06-15", countArg = "25"] =
  process.argv.slice(2);
const count = Number(countArg);
const MAX_RECIPIENTS = 3;

const token = process.env.TELEGRAM_BOT_TOKEN;
const uri = process.env.MONGODB_URI;
if (!token || !uri) {
  console.error("Set TELEGRAM_BOT_TOKEN and MONGODB_URI in .env at the repo root.");
  process.exit(1);
}

const client = await new MongoClient(uri).connect();
const db = client.db(process.env.MONGODB_DB || "visa_slot_notifier");
const tg = createTelegramApi(token);
const slot = { post, visaClass, kind, date } as Slot;
const key = slotKey(slot);

try {
  await ensureIndexes(db);
  const recipients = await findMatchingSubscribers(db, slot);
  if (recipients.length > MAX_RECIPIENTS) {
    console.error(
      `${recipients.length} real subscribers match ${key}. Refusing to message them. Pick a slot only you watch.`,
    );
    process.exit(1);
  }
  if (await collections(db).slotEvents.findOne({ key })) {
    console.error(`${key} already has a real sighting. Pick another date so it is not disturbed.`);
    process.exit(1);
  }

  console.log(`Matching chats: ${recipients.map((r) => r.chatId).join(", ") || "none"}`);
  console.log(`Sending ${count} simultaneous reports for ${key}...`);

  const run = Date.now().toString(36);
  const outcomes = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      processReport(
        db,
        tg,
        { installId: `simulate-${run}-${String(i).padStart(4, "0")}`, slots: [slot] },
        { test: true },
      ),
    ),
  );

  const ok = outcomes.filter((o) => o.status === "ok");
  const starters = ok.filter((o) => o.newSlots > 0);
  const sent = ok.reduce((n, o) => n + o.alerts.sent, 0);
  const event = await collections(db).slotEvents.findOne({ key });

  console.log(`Reports accepted:     ${ok.length} of ${count}`);
  console.log(`Reports that alerted: ${starters.length} (expected 1)`);
  console.log(`Telegram messages:    ${sent} (expected ${recipients.length})`);
  console.log(`Reports stored on the slot: ${event?.waveReports ?? 0}`);

  await collections(db).slotEvents.deleteOne({ key });
  await collections(db).deliveries.deleteMany({ waveId: { $regex: `^${key.replace(/\|/g, "\\|")}@` } });
  await collections(db).rateLimits.deleteMany({ _id: { $regex: `^install:simulate-${run}-` } });
  console.log("Cleaned up the simulated slot.");

  if (starters.length !== 1 || sent !== recipients.length) process.exitCode = 1;
} finally {
  await client.close();
}
