
import { Router } from "express";
import { registerController , loginController, getMeController} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { loginRateLimiter } from "../middleware/login-rate-limit.middleware";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginRateLimiter, loginController);
router.get("/me", requireAuth, getMeController);
export default router;
