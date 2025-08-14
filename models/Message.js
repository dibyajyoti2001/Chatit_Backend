import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // For 1-1 chats
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // For 1-1 chats
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" }, // For group chats
  content: { type: String},
  imageOrVideoUrl: { type: String },
  contentType: { type: String, enum: ['image', 'video', 'text', 'audio'], default: 'text' },
  reactions: [
    { 
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: String
    }
  ],
  messageStatus: { type: String, default: "sent" },
}, { timestamps: true });


const Message = mongoose.model('Message', messageSchema);
export default Message;