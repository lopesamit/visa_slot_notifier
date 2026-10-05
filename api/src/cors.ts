type Handler = (request: Request, context?: { ip?: string }) => Promise<Response>;

/**
 * The extension calls the API without a host permission, so the browser asks
 * first. Any extension origin is allowed: the API is public, and the link key
 * in the body, not the origin, is what authorizes a request.
 */
const isAllowedOrigin = (origin: string | null): origin is string =>
  !!origin && (origin.startsWith("chrome-extension://") || origin.startsWith("http://localhost:"));

const corsHeaders = (origin: string): Record<string, string> => ({
  "access-control-allow-origin": origin,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  vary: "Origin",
});

export const withCors =
  (handler: Handler): Handler =>
  async (request, context) => {
    const origin = request.headers.get("origin");
    const allowed = isAllowedOrigin(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(origin) : {} });
    }
    const response = await handler(request, context);
    if (!allowed) return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(corsHeaders(origin))) headers.set(name, value);
    return new Response(response.body, { status: response.status, headers });
  };
