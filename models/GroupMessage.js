import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const groupMessageSchema = mongoose.Schema({
  group: { type: ObjectId, ref: "Group", required: true },
  sender: { type: ObjectId, ref: "User", required: true },
  content: { type: String },
  imageOrVideoUrl: { type: String },
  contentType: { type: String, enum: ["text", "image", "video"], default: "text" },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
   reactions: [
    {
      user: { type: ObjectId, ref: "User", required: true },
      emoji: { type: String },
    }
  ],
}, { timestamps: true });

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;