import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/** Dev-only middleware so pdf.js can fetch PDFs same-origin on localhost */
function pdfProxyPlugin(): Plugin {
  return {
    name: "pdf-proxy",
    configureServer(server) {
      server.middlewares.use("/pdf-proxy", async (req, res) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          const upstreamUrl = url.searchParams.get("u");
          if (!upstreamUrl) {
            res.statusCode = 400;
            res.end("Missing ?u param");
            return;
          }

          const method = (req.method || "GET").toUpperCase();
          const range = req.headers["range"] as string | undefined;

          const headers: Record<string, string> = {};
          if (range) headers["Range"] = range;

          const upstream = await fetch(upstreamUrl, {
            method,
            headers,
            redirect: "follow",
          });

          res.statusCode = upstream.status;

          res.setHeader(
            "Content-Type",
            upstream.headers.get("content-type") || "application/pdf"
          );
          const cl = upstream.headers.get("content-length");
          if (cl) res.setHeader("Content-Length", cl);
          const cr = upstream.headers.get("content-range");
          if (cr) res.setHeader("Content-Range", cr);

          res.setHeader(
            "Accept-Ranges",
            upstream.headers.get("accept-ranges") || "bytes"
          );
          res.setHeader("Content-Disposition", "inline");
          res.setHeader("Cache-Control", "no-store");

          if (method === "HEAD" || upstream.status === 204) {
            res.end();
            return;
          }

          const reader = upstream.body?.getReader();
          if (!reader) {
            res.end();
            return;
          }
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch {
          res.statusCode = 502;
          res.end("Proxy error");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    pdfProxyPlugin(), // keep BEFORE router
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  base: "/",
  build: { assetsInlineLimit: 0 },
  ssr: { noExternal: ["tesseract.js"] },
  optimizeDeps: { include: ["tesseract.js"] },
  server: {
    proxy: {
      "/api": { target: "http://localhost:5173", changeOrigin: true },
      "/.well-known": { target: "http://localhost:5173", changeOrigin: true },
    },
  },
});
