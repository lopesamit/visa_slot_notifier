import { describe, expect, it } from "vitest";
import { withCors } from "./cors";

const handler = withCors(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
const EXTENSION = "chrome-extension://nilgamnmhfnmklfaildcbaldpldbhnbd";

const request = (method: string, origin?: string) =>
  new Request("https://freevisaslotnotifier.com/api/share", {
    method,
    headers: origin ? { origin } : {},
    body: method === "POST" ? "{}" : undefined,
  });

describe("withCors", () => {
  it("answers the browser's pre-check for an extension", async () => {
    const response = await handler(request("OPTIONS", EXTENSION));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(EXTENSION);
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type");
  });

  it("allows an extension to read the response", async () => {
    const response = await handler(request("POST", EXTENSION));
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(EXTENSION);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("does not allow other websites", async () => {
    expect((await handler(request("OPTIONS", "https://example.com"))).status).toBe(403);
    const response = await handler(request("POST", "https://example.com"));
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
