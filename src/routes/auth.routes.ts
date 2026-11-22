import { Router } from "express";
import {
  loginController,
  registerController,
} from "../controllers/auth.controller";
import { loginRateLimiter } from "../middleware/login-rate-limit.middleware";

const router = Router();

router.post("/register", registerController);
router.post("/login", loginRateLimiter, loginController);

export default router;
