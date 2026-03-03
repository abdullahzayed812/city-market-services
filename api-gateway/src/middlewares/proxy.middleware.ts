import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import { translate } from "@city-market/shared";

export const setupProxy = (basePath: string, targetUrl: string) => {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    pathRewrite: {
      [`^${basePath}`]: "/",
    },
    selfHandleResponse: true,
    on: {
      proxyReq: (proxyReq: any, req: any, res: any) => {
        if (req.headers.authorization) {
          proxyReq.setHeader("Authorization", req.headers.authorization);
        }

        // Only handle body if it was parsed by express.json() and it's an appropriate content-type
        if (req.body && Object.keys(req.body).length > 0 && req.headers["content-type"]?.includes("application/json")) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        if (proxyRes.headers["content-type"]?.includes("application/json")) {
          try {
            const data = JSON.parse(responseBuffer.toString("utf8"));
            let lang = req.headers["accept-language"] as string;

            // Normalize language header
            if (lang) {
              lang = lang.includes("en") ? "en" : "ar";
            } else {
              lang = "ar";
            }

            if (data && data.message) {
              data.message = translate(data.message, lang);
            }
            // Optional: If you want to translate string-based errors as well
            if (data && data.errors && typeof data.errors === "string") {
              data.errors = translate(data.errors, lang);
            }

            // Must return string or buffer
            return JSON.stringify(data);
          } catch (e) {
            console.error("Interceptor parse error", e);
          }
        }
        return responseBuffer;
      }),
      error: (err: any, req: any, res: any) => {
        console.error(`Proxy error for ${req.path} to ${targetUrl}:`, err);
        res.status(500).send("Proxy error");
      },
    },
  });
};
