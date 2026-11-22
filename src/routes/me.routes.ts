import { Router } from "express";
import { getMeController } from "../controllers/auth.controller";
import { listOwnRidesController } from "../controllers/ride.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, getMeController);
router.get("/rides", requireAuth, listOwnRidesController);

export default router;