import { createServer, type IncomingMessage } from "node:http";
import report from "../functions/report";
import subscription from "../functions/subscription";
import { mockDaysResponse, mockSchedulerPage } from "./mock-scheduler";

/**
 * Runs the API functions on localhost for the extension's dev build. Uses the
 * database in .env. Telegram still talks to the deployed webhook.
 */
type Handler = (request: Request, context?: { ip?: string }) => Promise<Response>;

const routes: Record<string, Handler> = {
  "/api/report": report,
  "/api/subscription": subscription,
};

const mockPages: Record<string, "ofc" | "consular"> = {
  "/dev/ofc-schedule": "ofc",
  "/dev/schedule": "consular",
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

  const mockKind = mockPages[url.pathname.replace(/\/$/, "")];
  if (mockKind && req.method === "GET") {
    res.writeHead(200, { "content-type": "text/html" }).end(mockSchedulerPage(mockKind));
    return;
  }
  if (url.pathname === "/dev/custom-actions/" && req.method === "POST") {
    const route = url.searchParams.get("route") ?? "";
    const kind = route.includes("-ofc-") ? "ofc" : "consular";
    res.writeHead(200, { "content-type": "application/json" }).end(mockDaysResponse(kind));
    return;
  }

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
  console.log(`Mock scheduler: http://localhost:${port}/dev/ofc-schedule and /dev/schedule`);
});
