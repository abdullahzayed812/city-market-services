# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app/services/notification-service
COPY services/notification-service/package*.json ./
RUN npm install
COPY services/notification-service .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/notification-service /app/services/notification-service
WORKDIR /app/services/notification-service
RUN npm install --production
EXPOSE 3008
CMD ["npm", "start"]
