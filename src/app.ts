import express from "express";

const app = express();

// Parse incoming JSON request bodies
app.use(express.json());

// Health check API
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Poolr API"
  });
});

export default app;