# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app/services/order-service
COPY services/order-service/package*.json ./
RUN npm install
COPY services/order-service .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/order-service /app/services/order-service
WORKDIR /app/services/order-service
RUN npm install --production
EXPOSE 3005
CMD ["npm", "start"]
