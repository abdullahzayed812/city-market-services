# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app/services/vendor-service
COPY services/vendor-service/package*.json ./
RUN npm install
COPY services/vendor-service .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/vendor-service /app/services/vendor-service
WORKDIR /app/services/vendor-service
RUN npm install --production
EXPOSE 3003
CMD ["npm", "start"]
