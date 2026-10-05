import { createServer, type IncomingMessage } from "node:http";
import share from "../functions/share";
import subscription from "../functions/subscription";
import { withCors } from "../src/cors";

/**
 * Runs the API functions on localhost for the extension's dev build. Uses the
 * database in .env. Telegram still talks to the deployed webhook.
 */
type Handler = (request: Request, context?: { ip?: string }) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/api/share": share,
  "/api/subscription": subscription,
};

const port = Number(process.env.PORT || 8787);

/**
 * The local API uses the live database and bot, so a test share would alert
 * real subscribers. Only August 2028 dates are accepted here; `dev:cleanup`
 * deletes them.
 */
const TEST_MONTH = "2028-08";

function realDateShare(path: string, body: Buffer): boolean {
  if (path !== "/api/share") return false;
  try {
    const { dates } = JSON.parse(body.toString()) as { dates?: unknown };
    return !Array.isArray(dates) || dates.some((d) => typeof d !== "string" || !d.startsWith(`${TEST_MONTH}-`));
  } catch {
    return false;
  }
}

const toHeaders = (req: IncomingMessage) =>
  new Headers(
    Object.entries(req.headers).flatMap(([name, value]): [string, string][] =>
      value === undefined ? [] : (Array.isArray(value) ? value : [value]).map((v) => [name, v]),
    ),
  );

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const route = routes[url.pathname];
  if (!route || (req.method !== "POST" && req.method !== "OPTIONS")) {
    res.writeHead(404).end("Not found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);

  const handler: Handler = realDateShare(url.pathname, body)
    ? withCors(async () => {
        console.log(`blocked a non-test date on ${url.pathname}`);
        return new Response(
          JSON.stringify({ error: "Local testing: share only August 2028 dates, so real subscribers are not alerted." }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      })
    : route;

  try {
    const response = await handler(
      new Request(url, {
        method: req.method,
        headers: toHeaders(req),
        body: req.method === "POST" ? body : undefined,
      }),
      { ip: req.socket.remoteAddress },
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    console.log(`${response.status} ${url.pathname}`);
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("Server error");
  }
}).listen(port, () => {
  console.log(`API on http://localhost:${port} (routes: ${Object.keys(routes).join(", ")})`);
});
