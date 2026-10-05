import { createHash } from "node:crypto";
import { withCors } from "../src/cors";
import { getDb } from "../src/db";
import { hitLimit } from "../src/limits";
import {
  findByLinkKey,
  isLinkKey,
  parseFilterUpdate,
  subscriptionView,
  unlinkByLinkKey,
  updateByLinkKey,
} from "../src/links";

export const config = { path: "/api/subscription", method: ["POST", "OPTIONS"] };

const MAX_BODY_BYTES = 4096;
const IP_LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const ipKey = (ip: string | null | undefined) =>
  ip ? createHash("sha256").update(`vsn-rate:${ip}`).digest("hex").slice(0, 32) : undefined;

export default withCors(async (request: Request, context?: { ip?: string }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" });

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error();
    body = parsed;
  } catch {
    return json(400, { error: "Body must be a JSON object" });
  }

  const { action, linkKey } = body;
  if (!isLinkKey(linkKey)) return json(400, { error: "Invalid linkKey" });

  try {
    const db = await getDb();
    const ip = ipKey(context?.ip ?? request.headers.get("x-nf-client-connection-ip"));
    if (ip && !(await hitLimit(db, `sub-ip:${ip}`, IP_LIMIT.limit, IP_LIMIT.windowMs))) {
      return json(429, { error: "Too many requests" });
    }

    switch (action) {
      case "status":
        return json(200, subscriptionView(await findByLinkKey(db, linkKey)));
      case "update": {
        const update = parseFilterUpdate(body);
        if (typeof update === "string") return json(400, { error: update });
        return json(200, subscriptionView(await updateByLinkKey(db, linkKey, update)));
      }
      case "disconnect":
        await unlinkByLinkKey(db, linkKey);
        return json(200, subscriptionView(null));
      default:
        return json(400, { error: "action must be status, update, or disconnect" });
    }
  } catch (error) {
    console.error("subscription failed", error);
    return json(500, { error: "Could not load settings" });
  }
});
