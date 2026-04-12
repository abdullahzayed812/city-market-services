# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app/services/delivery-service
COPY services/delivery-service/package*.json ./
RUN npm install
COPY services/delivery-service .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/delivery-service /app/services/delivery-service
WORKDIR /app/services/delivery-service
RUN npm install --production
EXPOSE 3006
CMD ["npm", "start"]
