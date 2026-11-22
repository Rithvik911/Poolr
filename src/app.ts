import express, { type Express } from "express";
import {
  healthController,
  readinessController,
} from "./controllers/health.controller";
import {
  errorHandler,
  notFoundMiddleware,
} from "./middleware/error.middleware";
import { requestIdMiddleware } from "./middleware/request-id.middleware";
import v1Routes from "./routes/v1.routes";

const app: Express = express();

app.use(requestIdMiddleware);
app.use(express.json());

app.get("/health", healthController);
app.get("/ready", readinessController);

app.use("/v1", v1Routes);

app.use(notFoundMiddleware);
app.use(errorHandler);

export default app;
