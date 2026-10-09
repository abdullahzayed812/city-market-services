import { createProxyMiddleware } from "http-proxy-middleware";

// Express strips the router mount path (e.g. /delivery) before the proxy sees the
// request, so the path is forwarded as-is. Don't strip basePath again: that turned
// /delivery-offices/me into /-offices/me (and /delivery-ratings into /-ratings).
// targetPrefix: for services whose own routes keep the prefix (media-service serves
// /media/upload); nginx does the same with `rewrite ... /media/$1`.
export const setupProxy = (_basePath: string, targetUrl: string, targetPrefix?: string) => {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    xfwd: true, // forward X-Forwarded-For/Proto/Port so downstream services see the real client IP
    ...(targetPrefix ? { pathRewrite: (path: string) => `${targetPrefix}${path.startsWith("/") ? path : `/${path}`}` } : {}),
    on: {
      proxyReq: (proxyReq: any, req: any, res: any) => {
        // Auth relies solely on the Authorization header. There used to be a fallback to an
        // `access_token` cookie here, but that cookie is now namespaced per calling app
        // (see auth.controller.ts) and this generic proxy has no way to know which app's
        // cookie applies to a given request — falling back to an unscoped name would silently
        // authenticate as whichever web app logged in last in that browser.
        const token = req.headers.authorization;

        if (token) {
          proxyReq.setHeader("Authorization", token);
        }

        // Pass through Accept-Language for service-level translation
        if (req.headers["accept-language"]) {
          proxyReq.setHeader("Accept-Language", req.headers["accept-language"]);
        }

        // Rewrite body: express.json() consumed the stream, so we must re-stream it.
        // Always do this when Content-Type is JSON (even empty body {}), otherwise
        // the downstream service's body parser hangs waiting for bytes that never arrive.
        if (req.headers["content-type"]?.includes("application/json") && req.body) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      error: (err: any, req: any, res: any) => {
        console.error(`Proxy error for ${req.path} to ${targetUrl}:`, err);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            message: "service_unavailable",
          });
        }
      },
    },
  });
};
