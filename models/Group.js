import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const groupSchema = mongoose.Schema({
  name: { type: String, required: true },
  profilePicture: { type: String },
  description: { type: String },
  admin: { type: ObjectId, ref: "User", required: true },
  members: [{ type: ObjectId, ref: "User", required: true }],
  lastMessage: { type: ObjectId, ref: "GroupMessage" },
}, { timestamps: true });

const Group = mongoose.model("Group", groupSchema);
export default Group;