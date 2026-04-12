# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install
RUN npm run build

# Copy Auth Service
WORKDIR /app/services/auth-service
COPY services/auth-service/package*.json ./
RUN npm install
COPY services/auth-service .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copy built shared package and auth-service
COPY --from=builder /app/shared /app/shared
COPY --from=builder /app/services/auth-service /app/services/auth-service

WORKDIR /app/services/auth-service

# Install only production dependencies
RUN npm install --production

EXPOSE 3001

CMD ["npm", "start"]
