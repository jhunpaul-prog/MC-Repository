// /api/pdf-proxy.ts  (Edge function - no extra packages required)
export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const u = searchParams.get("u");
    if (!u) return new Response('Missing "u"', { status: 400 });

    // Fix %2520 ⇒ %20 (double-encoded spaces, etc.)
    const targetUrl = decodeURIComponent(u);

    // pdf.js needs Range support for byte-range requests
    const range = req.headers.get("range") || undefined;
    const upstream = await fetch(targetUrl, {
      headers: range ? { Range: range } : {},
    });

    const headers = new Headers();
    [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
      "cache-control",
      "etag",
      "last-modified",
    ].forEach((k) => {
      const v = upstream.headers.get(k);
      if (v) headers.set(k, v);
    });
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (e: any) {
    return new Response(`Proxy error: ${e?.message || e}`, { status: 500 });
  }
}
