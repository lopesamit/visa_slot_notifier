import { withCors } from "../src/cors";
import { getDb } from "../src/db";
import { publicStats } from "../src/stats";

export const config = { path: "/api/stats", method: ["GET", "OPTIONS"] };

const CACHE_MS = 60_000;

let cache: { watching: number; until: number } | undefined;

const json = (watching: number) =>
  new Response(JSON.stringify({ watching }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60",
    },
  });

export default withCors(async (request): Promise<Response> => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const now = Date.now();
  if (cache && now < cache.until) return json(cache.watching);

  try {
    const { watching } = await publicStats(await getDb());
    cache = { watching, until: now + CACHE_MS };
    return json(watching);
  } catch (error) {
    console.error("stats failed", error);
    return new Response(JSON.stringify({ error: "Could not load the count" }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}, "GET, OPTIONS");
