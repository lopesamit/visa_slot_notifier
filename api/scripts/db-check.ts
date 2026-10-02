import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Add it to .env at the repo root.");
  process.exit(1);
}

const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 }).connect();
try {
  const dbName = process.env.MONGODB_DB || "visa_slot_notifier";
  await client.db(dbName).command({ ping: 1 });
  console.log(`Connected to MongoDB, database "${dbName}".`);
} finally {
  await client.close();
}
