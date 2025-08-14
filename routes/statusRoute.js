import express from "express";
import statusController from "../controllers/statusController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import cloudinaryConfig from "../config/cloudinaryConfig.js";

const router = express.Router();

//protected route
router.post("/", authMiddleware, cloudinaryConfig.multerMiddleware, statusController.createStatus);
router.get("/", authMiddleware, statusController.getStatus);

router.put("/:statusId/view", authMiddleware, statusController.viewStatus);

router.delete("/:statusId", authMiddleware, statusController.deleteStatus);

export default router;
