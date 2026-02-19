import { ServiceAuthenticator } from "@city-market/shared/node";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export const config = {
    orderServiceUrl: process.env.ORDER_SERVICE_URL || "http://localhost:3005",
    authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
    websocketGatewayClientId: process.env.WEBSOCKET_GATEWAY_CLIENT_ID || "websocket-gateway-id",
    websocketGatewayClientSecret: process.env.WEBSOCKET_GATEWAY_CLIENT_SECRET || "websocket-gateway-secret",
    authServiceTokenUrl:
        process.env.AUTH_SERVICE_TOKEN_URL || `${process.env.AUTH_SERVICE_URL || "http://localhost:3001"}/oauth/token`,
};

export const websocketGatewayAuthenticator = new ServiceAuthenticator(
    config.websocketGatewayClientId,
    config.websocketGatewayClientSecret,
    config.authServiceTokenUrl,
    "WebSocketGateway"
);
