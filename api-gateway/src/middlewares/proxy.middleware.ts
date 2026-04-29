import { createProxyMiddleware } from "http-proxy-middleware";

export const setupProxy = (basePath: string, targetUrl: string) => {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: {
      [`^${basePath}`]: "/",
    },
    on: {
      proxyReq: (proxyReq: any, req: any, res: any) => {
        let token = req.headers.authorization;

        // If no Authorization header, check for access_token cookie
        if (!token && req.cookies && req.cookies.access_token) {
          token = `Bearer ${req.cookies.access_token}`;
        }

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
