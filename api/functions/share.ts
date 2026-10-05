import { createHash } from "node:crypto";
import { withCors } from "../src/cors";
import { getDb } from "../src/db";
import { parseShare, processShare } from "../src/share";
import { getTelegram } from "../src/telegram/client";

export const config = { path: "/api/share", method: ["POST", "OPTIONS"] };

const MAX_BODY_BYTES = 4096;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Raw IPs are never stored; only a hash used as a rate-limit key. */
const ipKey = (ip: string | null | undefined) =>
  ip ? createHash("sha256").update(`vsn-rate:${ip}`).digest("hex").slice(0, 32) : undefined;

export default withCors(async (request: Request, context?: { ip?: string }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Body must be JSON" });
  }

  const share = parseShare(body);
  if (typeof share === "string") return json(400, { error: share });

  try {
    const outcome = await processShare(await getDb(), getTelegram(), share, {
      ipKey: ipKey(context?.ip ?? request.headers.get("x-nf-client-connection-ip")),
    });
    if (outcome.status === "not_connected") {
      return json(403, { error: "Connect Telegram before sharing a date" });
    }
    if (outcome.status === "rate_limited") {
      return json(429, { error: "You have shared a lot this hour. Try again later." });
    }
    return json(200, { ok: true, newSlots: outcome.newSlots, alerted: outcome.alerts.sent });
  } catch (error) {
    console.error("share failed", error);
    return json(500, { error: "Could not share this date" });
  }
});
