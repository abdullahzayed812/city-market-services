import { ConfigLoader, ServiceAuthenticator } from "@city-market/shared/node";

export const config = ConfigLoader.load<{
    orderServiceUrl: string;
    authServiceUrl: string;
    websocketGatewayClientId: string;
    websocketGatewayClientSecret: string;
    authServiceTokenUrl: string;
}>({
    orderServiceUrl: { env: "ORDER_SERVICE_URL", default: "http://localhost:3005" },
    authServiceUrl: { env: "AUTH_SERVICE_URL", default: "http://localhost:3001" },
    websocketGatewayClientId: { env: "WEBSOCKET_GATEWAY_CLIENT_ID", default: "websocket-gateway-id" },
    websocketGatewayClientSecret: { env: "WEBSOCKET_GATEWAY_CLIENT_SECRET", required: true, sensitive: true },
    authServiceTokenUrl: { env: "AUTH_SERVICE_TOKEN_URL", default: "http://localhost:3001/oauth/token" },
});

export const websocketGatewayAuthenticator = new ServiceAuthenticator(
    config.websocketGatewayClientId,
    config.websocketGatewayClientSecret,
    config.authServiceTokenUrl,
    "WebSocketGateway"
);
