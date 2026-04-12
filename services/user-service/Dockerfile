# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app/services/user-service
COPY services/user-service/package*.json ./
RUN npm install
COPY services/user-service .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/user-service /app/services/user-service
WORKDIR /app/services/user-service
RUN npm install --production
EXPOSE 3002
CMD ["npm", "start"]
