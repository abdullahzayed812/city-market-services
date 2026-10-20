// config/env.ts requires this at import time; imported before ../events
process.env.WEBSOCKET_GATEWAY_CLIENT_SECRET ??= "test-secret";
