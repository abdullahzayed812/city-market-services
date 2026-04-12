# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install
RUN npm run build

# Copy API Gateway
WORKDIR /app/api-gateway
COPY api-gateway/package*.json ./
RUN npm install
COPY api-gateway .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy built shared package and api-gateway
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/api-gateway /app/api-gateway

WORKDIR /app/api-gateway

# Install only production dependencies
RUN npm install --production

EXPOSE 3000

CMD ["npm", "start"]
