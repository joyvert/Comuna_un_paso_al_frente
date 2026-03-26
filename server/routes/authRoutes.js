import { Router } from "express";
import { AdminController } from "../controllers/adminController.js";
import { AuthController } from "../controllers/authController.js";
import { loginLockoutGuard, recoveryLockoutGuard } from "../middlewares/authAttemptsMiddleware.js";
import { registerAccess, requireAdmin, requireAuth } from "../middlewares/authJwt.js";
import {
  authGlobalLimiter,
  authSensitiveGetLimiter,
  loginIpLimiter,
  recoveryLimiter,
  registerLimiter,
} from "../middlewares/rateLimiters.js";

const router = Router();

router.use(authGlobalLimiter);

router.get("/registration-open", authSensitiveGetLimiter, AuthController.registrationOpen);
router.get("/salt/:userId", authSensitiveGetLimiter, AuthController.getSalt);
router.post("/register", registerLimiter, registerAccess, AuthController.register);
router.post("/login", loginIpLimiter, loginLockoutGuard, AuthController.login);
router.get("/recovery/:userId", authSensitiveGetLimiter, AuthController.recoveryQuestions);
router.post("/recovery/reset", recoveryLimiter, recoveryLockoutGuard, AuthController.resetPassword);

router.get("/admin/voceros", requireAuth, requireAdmin, AdminController.listVoceros);
router.post("/admin/voceros", requireAuth, requireAdmin, registerLimiter, AdminController.createVocero);
router.patch("/admin/voceros/:userId", requireAuth, requireAdmin, AdminController.updateVocero);
router.post(
  "/admin/voceros/:userId/reset-password",
  requireAuth,
  requireAdmin,
  recoveryLimiter,
  AdminController.resetVoceroPassword,
);

export default router;
