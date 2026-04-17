# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app/services/catalog-service
COPY services/catalog-service/package*.json ./
RUN npm install
COPY services/catalog-service .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/catalog-service /app/services/catalog-service
WORKDIR /app/services/catalog-service
RUN npm install --production
EXPOSE 3004
CMD ["npm", "start"]
