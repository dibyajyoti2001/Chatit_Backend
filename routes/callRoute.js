import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  saveCallHistory,
  getUserCallHistory,
} from "../controllers/callHistoryController.js";

const router = express.Router();

router.post("/save-history", authMiddleware, saveCallHistory);
router.get("/my-history", authMiddleware, getUserCallHistory);

export default router;
