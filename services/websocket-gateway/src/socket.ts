import { Server, Socket } from "socket.io";
import * as jwt from "jsonwebtoken";
import axios from "axios";
import { UserRole } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "access_secret_key";
const VENDOR_SERVICE_URL = process.env.VENDOR_SERVICE_URL || "http://localhost:3003";
const DELIVERY_SERVICE_URL = process.env.DELIVERY_SERVICE_URL || "http://localhost:3006";

interface DecodedToken {
  userId: string;
  email: string;
  role: UserRole;
}

export const setupSocketServer = (io: Server) => {
  io.use(async (socket: Socket, next: (err?: any) => void) => {
    let token = socket.handshake.auth.token || socket.handshake.query.token;
    if (token) token = (token as string).trim();

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as DecodedToken;
      socket.data.user = decoded;
      next();
    } catch (err: any) {
      console.error("[WS Auth] verify failed:", err.message, "| secret used:", JWT_SECRET.slice(0, 8) + "...", "| token prefix:", (token as string).slice(0, 20));
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const user = socket.data.user as DecodedToken;
    console.log(`User connected: ${user.email} (${user.role})`);

    // Join user-specific room
    socket.join(`user:${user.userId}`);

    // Join role-specific room
    socket.join(`role:${user.role}`);

    // Join specific entity rooms based on role
    if (user.role === UserRole.VENDOR) {
      try {
        const response = await axios.get(`${VENDOR_SERVICE_URL}/me`, {
          headers: { Authorization: `Bearer ${socket.handshake.auth.token || socket.handshake.query.token}` },
        });
        if (response?.data?.data && response?.data?.data?.id) {
          socket.join(`vendor:${response?.data?.data?.id}`);
          console.log(`Vendor ${user.email} joined room: vendor:${response?.data?.data?.id}`);
        }
      } catch (error: any) {
        console.error(`Failed to fetch vendor profile for user ${user.userId}:`, error.message);
      }
    } else if (user.role === UserRole.COURIER) {
      try {
        const response = await axios.get(`${DELIVERY_SERVICE_URL}/couriers/me`, {
          headers: { Authorization: `Bearer ${socket.handshake.auth.token || socket.handshake.query.token}` },
        });
        if (response?.data?.data && response?.data?.data?.id) {
          socket.join(`courier:${response?.data?.data?.id}`);
          console.log(`Courier ${user.email} joined room: courier:${response?.data?.data?.id}`);
        }
      } catch (error: any) {
        console.error(`Failed to fetch courier profile for user ${user.userId}:`, error.message);
      }
    }

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${user.email}`);
    });
  });
};
