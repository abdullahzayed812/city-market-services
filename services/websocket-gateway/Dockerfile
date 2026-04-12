# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app/services/websocket-gateway
COPY services/websocket-gateway/package*.json ./
RUN npm install
COPY services/websocket-gateway .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/websocket-gateway /app/services/websocket-gateway
WORKDIR /app/services/websocket-gateway
RUN npm install --production
EXPOSE 3009
CMD ["npm", "start"]
