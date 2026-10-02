import { createHash } from "node:crypto";
import { getDb } from "../src/db";
import { parseReport, processReport } from "../src/report";
import { getTelegram } from "../src/telegram/client";

export const config = { path: "/api/report", method: "POST" };

const MAX_BODY_BYTES = 4096;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Raw IPs are never stored; only a hash used as a rate-limit key. */
const ipKey = (ip: string | null | undefined) =>
  ip ? createHash("sha256").update(`vsn-rate:${ip}`).digest("hex").slice(0, 32) : undefined;

export default async (request: Request, context?: { ip?: string }): Promise<Response> => {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Report too large" });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Body must be JSON" });
  }

  const report = parseReport(body);
  if (typeof report === "string") return json(400, { error: report });

  try {
    const outcome = await processReport(await getDb(), getTelegram(), report, {
      ipKey: ipKey(context?.ip ?? request.headers.get("x-nf-client-connection-ip")),
    });
    if (outcome.status === "rate_limited") return json(429, { error: "Too many reports" });
    return json(200, { ok: true, newSlots: outcome.newSlots });
  } catch (error) {
    console.error("report failed", error);
    return json(500, { error: "Could not record report" });
  }
};
