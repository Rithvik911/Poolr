import { Router } from "express";
import authRoutes from "./auth.routes";
import meRoutes from "./me.routes";
import rideRoutes from "./ride.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/me", meRoutes);
router.use("/rides", rideRoutes);

export default router;