import { MongoClient } from "mongodb";
import { ensureIndexes } from "../src/db";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Add it to .env at the repo root.");
  process.exit(1);
}

const client = await new MongoClient(uri).connect();
try {
  const db = client.db(process.env.MONGODB_DB || "visa_slot_notifier");
  await ensureIndexes(db);
  for (const name of ["slot_events", "subscribers", "deliveries", "shares"]) {
    const indexes = await db.collection(name).indexes();
    console.log(`${name}: ${indexes.map((i) => i.name).join(", ")}`);
  }
} finally {
  await client.close();
}
