import { Router } from "express";
import {
  createRideController,
  getRideController,
} from "../controllers/ride.controller";
import { searchRidesController } from "../controllers/ride-search.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createRideController);
router.get("/search", requireAuth, searchRidesController);
router.get("/:id", requireAuth, getRideController);

export default router;
