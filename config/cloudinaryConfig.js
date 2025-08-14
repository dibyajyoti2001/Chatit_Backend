import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileToCloudinary = (file) => {
  const options = {
    resource_type: file.mimetype.startsWith("video") ? "video" : "image",
  };

  return new Promise(async (resolve, reject) => {
    const uploader = file.mimetype.startsWith("video")
      ? cloudinary.uploader.upload_large
      : cloudinary.uploader.upload;

    uploader(file.path, options, (error, result) => {
      const filePath = path.resolve(file.path);
      console.log("📁 Attempting to delete:", filePath);

      fs.unlink(filePath, (err) => {
        if (err) return console.error("❌ Failed to delete file:", err);
        console.log("✅ File deleted from local uploads folder.");
      });

      if (error) {
        return reject(error);
      }
      resolve(result);
    });
  });
};

// const multerMiddleware = multer({dest: 'uploads/'}).single('profilePicture');
const multerMiddleware = multer({ dest: "uploads/" }).fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

export default { uploadFileToCloudinary, multerMiddleware };
