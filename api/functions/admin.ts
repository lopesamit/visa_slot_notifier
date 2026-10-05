import { createHash } from "node:crypto";
import { dashboardData, isAdminToken } from "../src/admin";
import { withCors } from "../src/cors";
import { getDb } from "../src/db";
import { hitLimit } from "../src/limits";
import { getTelegram } from "../src/telegram/client";

export const config = { path: "/api/admin", method: ["POST", "OPTIONS"] };

const IP_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const ipKey = (ip: string | null | undefined) =>
  ip ? createHash("sha256").update(`vsn-rate:${ip}`).digest("hex").slice(0, 32) : undefined;

export default withCors(async (request: Request, context?: { ip?: string }): Promise<Response> => {
  try {
    const db = await getDb();
    const ip = ipKey(context?.ip ?? request.headers.get("x-nf-client-connection-ip"));
    if (ip && !(await hitLimit(db, `admin-ip:${ip}`, IP_LIMIT.limit, IP_LIMIT.windowMs))) {
      return json(429, { error: "Too many requests" });
    }
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!isAdminToken(token)) return json(401, { error: "Wrong admin key" });
    return json(200, await dashboardData(db, getTelegram()));
  } catch (error) {
    console.error("admin failed", error);
    return json(500, { error: "Could not load the dashboard" });
  }
});
