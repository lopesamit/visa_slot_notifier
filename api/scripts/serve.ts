import { createServer, type IncomingMessage } from "node:http";
import report from "../functions/report";
import subscription from "../functions/subscription";

/**
 * Runs the API functions on localhost for the extension's dev build. Uses the
 * database in .env. Telegram still talks to the deployed webhook.
 */
type Handler = (request: Request, context?: { ip?: string }) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/api/report": report,
  "/api/subscription": subscription,
};

const port = Number(process.env.PORT || 8787);

const toHeaders = (req: IncomingMessage) =>
  new Headers(
    Object.entries(req.headers).flatMap(([name, value]): [string, string][] =>
      value === undefined ? [] : (Array.isArray(value) ? value : [value]).map((v) => [name, v]),
    ),
  );

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const handler = routes[url.pathname];
  if (!handler || req.method !== "POST") {
    res.writeHead(404).end("Not found");
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  try {
    const response = await handler(
      new Request(url, { method: "POST", headers: toHeaders(req), body: Buffer.concat(chunks) }),
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
