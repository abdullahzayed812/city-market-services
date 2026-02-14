import express from "express";

import { errorHandler } from "@city-market/shared/node";

export const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "healthy", service: "payment-service" });
});

app.use(errorHandler);
