import express from "express";
import authController from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import cloudinaryConfig from "../config/cloudinaryConfig.js";

const router = express.Router();

router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.get("/logout", authController.logout);

// protected route

router.post(
  "/create-profile",
  authMiddleware,
  cloudinaryConfig.multerMiddleware,
  authController.createProfile
);

router.put(
  "/update-profile",
  authMiddleware,
  cloudinaryConfig.multerMiddleware,
  authController.updateProfile
);

router.get("/check-auth", authMiddleware, authController.checkAuthenticate);
router.get("/users", authMiddleware, authController.getAllUsers);

router.get("/get-user", authMiddleware, authController.getUser);

export default router;
