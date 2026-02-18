import { Router } from "express";
import * as AuthController from "./auth.controller.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google", AuthController.googleLogin);
router.patch("/complete-profile", requireAuth, AuthController.completeProfile);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/verify-otp", AuthController.verifyOtp);
router.post("/reset-password", AuthController.resetPassword);
router.post("/check-username", AuthController.checkUsername);
router.get("/me", requireAuth, AuthController.getUserDetails);

export default router;
