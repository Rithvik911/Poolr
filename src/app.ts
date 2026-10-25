import express, { type Express } from "express";
import authRoutes from "./routes/auth.routes.js";

const app: Express = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Poolr API"
  });
});

app.use("/auth", authRoutes);

export default app;
