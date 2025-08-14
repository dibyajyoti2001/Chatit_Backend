import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import cloudinaryConfig from "../config/cloudinaryConfig.js";
import groupController from "../controllers/groupController.js";

const router = express.Router();

router.post("/create", authMiddleware, cloudinaryConfig.multerMiddleware, groupController.createGroup);
router.post("/send-message", authMiddleware, cloudinaryConfig.multerMiddleware, groupController.sendGroupMessage);
router.get("/messages/:groupId", authMiddleware, groupController.getGroupMessages);
router.get("/admin-groups", authMiddleware, groupController.getAdminGroups);
router.get("/user-groups", authMiddleware, groupController.getUserGroups);
router.put("/add-member", authMiddleware, groupController.addMemberToGroup);
router.put(
  "/update-group-profile",
  authMiddleware,
  cloudinaryConfig.multerMiddleware,
  groupController.updateGroupDetails
);
router.put("/mark-read", authMiddleware, groupController.markGroupMessagesAsRead);
router.get("/group-info/:groupId", authMiddleware, groupController.getGroupInfo);
router.delete("/delete-message/:messageId", authMiddleware, groupController.deleteGroupMessage);
router.delete("/delete/:groupId", authMiddleware, groupController.deleteGroup);



export default router;
