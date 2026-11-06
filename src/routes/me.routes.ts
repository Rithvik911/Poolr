import { Router } from "express";
import { listOwnRidesController } from "../controllers/ride.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/rides", requireAuth, listOwnRidesController);

export default router;
