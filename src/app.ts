import express, { type Express } from "express";
import authRoutes from "./routes/auth.routes";
import rideRoutes from "./routes/ride.routes";

const app: Express = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Poolr API"
  });
});

app.use("/auth", authRoutes);
app.use("/rides", rideRoutes);

export default app;
