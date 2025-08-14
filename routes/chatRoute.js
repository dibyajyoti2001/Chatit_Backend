import express from "express";
import chatController from "../controllers/chatController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import cloudinaryConfig from "../config/cloudinaryConfig.js";

const router = express.Router();

//protected route
router.post("/send-message", authMiddleware, cloudinaryConfig.multerMiddleware, chatController.sendMessage);
router.get("/conversations", authMiddleware, chatController.getConversation);
router.get("/conversations/:conversationId/messages", authMiddleware, chatController.getMessages);
router.put("/messages/read", authMiddleware, chatController.markAsRead);
router.delete("/messages/:messageId", authMiddleware, chatController.deleteMessage);

export default router;
