// import cloudinaryConfig from "../config/cloudinaryConfig.js";
// import Conversation from "../models/Conversation.js";
// import response from "../utils/responseHandler.js";
// import Message from "../models/Message.js";
// import redisClient from "../config/redis.js";
// import { decryptText, encryptText } from "../utils/encryption.js";

// // export const cacheMessage = async (conversationId, message) => {
// //   const redisKey = `chat:${conversationId}`;

// //   // Push new message to list (like a chat feed)
// //   await redisClient.rPush(redisKey, JSON.stringify(message));

// //   // Optional: Trim to last 50 messages to avoid memory overload
// //   await redisClient.lTrim(redisKey, -50, -1);
// // };

// const sendMessage = async (req, res) => {
//   try {
//     const { senderId, receiverId, content, messageStatus } = req.body;
//     const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
//     const participants = [senderId, receiverId].sort();

//     let conversation = await Conversation.findOne({ participants });
//     if (!conversation) {
//       conversation = new Conversation({ participants });
//       await conversation.save();
//     }

//     let imageOrVideoUrl = null;
//     let contentType = null;

//     // ✅ First check if there's a file and upload
//     if (file) {
//       const uploadFile = await cloudinaryConfig.uploadFileToCloudinary(file);

//       if (!uploadFile?.secure_url) {
//         return response(res, 400, "Failed to upload media");
//       }

//       imageOrVideoUrl = uploadFile.secure_url;

//       if (file.mimetype.includes("image")) {
//         contentType = "image";
//       } else if (file.mimetype.includes("video")) {
//         contentType = "video";
//       } else if (file.mimetype.includes("audio")) {
//         contentType = "audio";
//       } else {
//         return response(res, 400, "Unsupported file type");
//       }
//     }
//     console.log(contentType);

//     // ✅ Then check if there's content
//     if (!file && !content?.trim()) {
//       return response(res, 400, "Message content is required");
//     }

//     // ✅ If no media but text present
//     // if (!contentType && content?.trim()) {
//     //   contentType = "text";
//     // }

//     // const message = new Message({
//     //   conversation: conversation._id,
//     //   sender: senderId,
//     //   receiver: receiverId,
//     //   content: content || contentType, // fallback to contentType if content is empty
//     //   contentType,
//     //   imageOrVideoUrl,
//     //   messageStatus,
//     // });

//     console.log("🟩 Original content:", content);
//     const encryptedContent = content ? encryptText(content) : contentType;
//     console.log("🔒 Encrypted content:", encryptedContent);

//     const message = new Message({
//       conversation: conversation._id,
//       sender: senderId,
//       receiver: receiverId,
//       content: encryptedContent,
//       contentType,
//       imageOrVideoUrl,
//       messageStatus,
//     });

//     await message.save();

//     // Update conversation
//     if (message?.content) {
//       conversation.lastMessage = message._id;
//     }

//     conversation.unreadCount += 1;
//     await conversation.save();

//     // Populate message for frontend
//     // const populatedMessage = await Message.findOne({ _id: message._id })
//     //   .populate("sender", "username profilePicture")
//     //   .populate("receiver", "username profilePicture");

//     const populatedMessage = await Message.findOne({ _id: message._id })
//       .populate("sender", "username profilePicture")
//       .populate("receiver", "username profilePicture");

//     if (populatedMessage.contentType === "text" && populatedMessage.content) {
//       try {
//         populatedMessage.content = decryptText(populatedMessage.content);
//       } catch (err) {
//         console.error("Decryption failed:", err.message);
//       }
//     }

//     // Save to Redis cache
//     // await cacheMessage(conversation._id, message);

//     // Invalidate cache
//     // await redisClient.del(`conversations:${senderId}`);
//     // await redisClient.del(`conversations:${receiverId}`);

//     // Emit via socket.io
//     if (req.io && req.socketUserMap) {
//       const receiverSocketId = req.socketUserMap.get(receiverId);
//       if (receiverSocketId) {
//         req.io.to(receiverSocketId).emit("receive_message", populatedMessage);
//         message.messageStatus = "delivered";
//         await message.save();
//       }
//     }

//     return response(res, 201, "Message sent successfully", populatedMessage);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Internal server error");
//   }
// };

// // get all conversation
// const getConversation = async (req, res) => {
//   const userId = req.user.userId;
//   // const redisKey = `conversations:${userId}`;

//   try {
//     // Try to get from Redis
//     // const cachedData = await redisClient.get(redisKey);
//     // if (cachedData) {
//     //   const conversations = JSON.parse(cachedData);
//     //   return response(res, 200, "Conversation retrieved from cache", conversations);
//     // }

//     // Not in cache? Get from DB
//     const conversations = await Conversation.find({
//       participants: userId,
//     })
//       .populate("participants", "username profilePicture isOnline lastSeen")
//       .populate({
//         path: "lastMessage",
//         populate: {
//           path: "sender receiver",
//           select: "username profilePicture",
//         },
//       })
//       .sort({ updatedAt: -1 });

//     const decryptedConversations = conversations.map((conv) => {
//       const conversation = conv.toObject();

//       if (
//         conversation.lastMessage &&
//         conversation.lastMessage.content &&
//         conversation.lastMessage.contentType === "text"
//       ) {
//         try {
//           conversation.lastMessage.content = decryptText(
//             conversation.lastMessage.content
//           );
//         } catch (err) {
//           console.error("Decryption failed:", err.message);
//         }
//       }

//       return conversation;
//     });

//     // Cache in Redis for 60 seconds
//     // await redisClient.setEx(redisKey, 60, JSON.stringify(conversations)); // Cache for 60 seconds

//     return response(
//       res,
//       201,
//       "Conversation get successfully",
//       decryptedConversations
//     );
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Internal server error");
//   }
// };

// //get messages of specific conversation
// const getMessages = async (req, res) => {
//   const { conversationId } = req.params;
//   const userId = req.user.userId;
//   // const redisKey = `messages:${conversationId}`;

//   try {
//     const conversation = await Conversation.findById(conversationId);
//     if (!conversation) {
//       return response(res, 404, "Conversation not found");
//     }
//     if (!conversation.participants.includes(userId)) {
//       return response(res, 403, "Not authorized to view this conversation");
//     }

//     // Try Redis cache first
//     // const cachedMessages = await redisClient.lRange(redisKey, 0, -1);
//     // if (cachedMessages?.length) {
//     //   const parsedMessages = cachedMessages.map((msg) => JSON.parse(msg));
//     //   return response(res, 200, "Messages retrieved from cache", parsedMessages);
//     // }

//     // Not in cache? Get from DB
//     const messages = await Message.find({ conversation: conversationId })
//       .populate("sender", "username profilePicture")
//       .populate("receiver", "username profilePicture")
//       .sort("createdAt");

//     // const decryptedMessages = messages.map((msg) => ({
//     //   ...msg.toObject(),
//     //   content:
//     //     msg.contentType === "text" ? decryptText(msg.content) : msg.content,
//     // }));

//     const decryptedMessages = messages.map((msg) => ({
//       ...msg._doc,
//       content: decryptText(msg.content),
//     }));

//     // const decryptedMessages = messages.map((msg) => {
//     //   if (msg.contentType === "text") {
//     //     console.log("🔓 Decrypted:", decryptText(msg.content));
//     //     const decrypted = decryptText(msg.content);
//     //     console.log("🔐 Decrypting message:");
//     //     console.log("🔒 Encrypted:", msg.content);
//     //     console.log("🟩 Decrypted:", decrypted);
//     //     return {
//     //       ...msg.toObject(),
//     //       content: decrypted,
//     //     };
//     //   }

//     //   return msg.toObject();
//     // });

//     // Store each message in Redis
//     // for (const message of messages) {
//     //   await redisClient.rPush(redisKey, JSON.stringify(message));
//     // }
//     // await redisClient.lTrim(redisKey, -50, -1);

//     // Mark as read

//     const result = await Message.updateMany(
//       {
//         conversation: conversationId,
//         receiver: userId,
//         messageStatus: { $in: ["send", "delivered"] },
//       },
//       { $set: { messageStatus: "read" } }
//     );

//     // Decrease unreadCount by number of messages updated
//     conversation.unreadCount = Math.max(
//       0,
//       conversation.unreadCount - result.modifiedCount
//     );
//     // conversation.unreadCount = 0;

//     await conversation.save();

//     return response(res, 200, "Message retrieved", decryptedMessages);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Internal server error");
//   }
// };

// const markAsRead = async (req, res) => {
//   const { messageId } = req.body;
//   const userId = req.user.userId;
//   try {
//     //get relevant message to determine senders
//     let messages = await Message.find({
//       _id: { $in: messageId },
//       receiver: userId,
//     });
//     await Message.updateMany(
//       {
//         _id: { $in: messageId },
//         receiver: userId,
//         messageStatus: { $in: ["send", "delivered"] },
//       },
//       { $set: { messageStatus: "read" } }
//     );

//     // notify to original sender
//     if (req.io && req.socketUserMap) {
//       for (const message of messages) {
//         const senderSocketId = req.socketUserMap.get(message.sender.toString());
//         if (senderSocketId) {
//           const updatedMessage = {
//             _id: message._id,
//             messageStatus: "read",
//           };
//           req.io.to(senderSocketId).emit("message_read", updatedMessage);

//           await message.save();
//         }
//       }
//     }

//     return response(res, 200, "Message marked as read", messages);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Internal server error");
//   }
// };

// const deleteMessage = async (req, res) => {
//   const { messageId } = req.params;
//   const userId = req.user.userId;
//   try {
//     const message = await Message.findById(messageId);
//     if (!message) {
//       return response(res, 404, "Message not found");
//     }
//     if (message.sender.toString() !== userId) {
//       return response(res, 403, "Not authorized to delete this message");
//     }
//     await message.deleteOne();

//     // Invalidate cache
//     // await redisClient.del(`chat:${message.conversation.toString()}`);
//     // await deleteMessageFromRedisList(message.conversation.toString(), message._id.toString());
//     // await redisClient.del(`conversations:${userId}`);
//     // await redisClient.del(`conversations:${message.receiver.toString()}`);

//     // Emit socket event
//     if (req.io && req.socketUserMap) {
//       const receiverSocketId = req.socketUserMap.get(
//         message.receiver.toString()
//       );
//       if (receiverSocketId) {
//         req.io.to(receiverSocketId).emit("message_deleted", messageId);
//       }
//     }

//     return response(res, 200, "Message deleted successfully");
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Internal server error");
//   }
// };

// export const deleteMessageFromRedisList = async (
//   conversationId,
//   messageIdToDelete
// ) => {
//   // const redisKey = `chat:${conversationId}`;
//   try {
//     const messages = await redisClient.lRange(redisKey, 0, -1);
//     if (!messages || messages.length === 0) return;

//     const updatedMessages = messages
//       .map((m) => JSON.parse(m))
//       .filter((msg) => msg._id !== messageIdToDelete);

//     // Delete old list
//     // await redisClient.del(redisKey);

//     // Re-push filtered messages (in reverse to preserve original order)
//     // for (const msg of updatedMessages.reverse()) {
//     //   await redisClient.lPush(redisKey, JSON.stringify(msg));
//     // }

//     // console.log(`✅ Message ${messageIdToDelete} deleted from Redis list for ${conversationId}`);
//   } catch (error) {
//     console.error("❌ Failed to delete message from Redis:", error);
//   }
// };

// export default {
//   sendMessage,
//   getConversation,
//   getMessages,
//   markAsRead,
//   deleteMessage,
// };

import cloudinaryConfig from "../config/cloudinaryConfig.js";
import Conversation from "../models/Conversation.js";
import response from "../utils/responseHandler.js";
import Message from "../models/Message.js";
import redisClient from "../config/redis.js";

// export const cacheMessage = async (conversationId, message) => {
//   const redisKey = `chat:${conversationId}`;

//   // Push new message to list (like a chat feed)
//   await redisClient.rPush(redisKey, JSON.stringify(message));

//   // Optional: Trim to last 50 messages to avoid memory overload
//   await redisClient.lTrim(redisKey, -50, -1);
// };

const sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, content, messageStatus } = req.body;
    const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
    const participants = [senderId, receiverId].sort();

    let conversation = await Conversation.findOne({ participants });
    if (!conversation) {
      conversation = new Conversation({ participants });
      await conversation.save();
    }

    let imageOrVideoUrl = null;
    let contentType = null;

    // ✅ First check if there's a file and upload
    if (file) {
      const uploadFile = await cloudinaryConfig.uploadFileToCloudinary(file);

      if (!uploadFile?.secure_url) {
        return response(res, 400, "Failed to upload media");
      }

      imageOrVideoUrl = uploadFile.secure_url;

      if (file.mimetype.includes("image")) {
        contentType = "image";
      } else if (file.mimetype.includes("video")) {
        contentType = "video";
      } else if (file.mimetype.includes("audio")) {
        contentType = "audio";
      } else {
        return response(res, 400, "Unsupported file type");
      }
    }
    console.log(contentType);

    // ✅ Then check if there's content
    if (!file && !content?.trim()) {
      return response(res, 400, "Message content is required");
    }

    // ✅ If no media but text present
    // if (!contentType && content?.trim()) {
    //   contentType = "text";
    // }

    const message = new Message({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      content: content || contentType, // fallback to contentType if content is empty
      contentType,
      imageOrVideoUrl,
      messageStatus,
    });

    await message.save();

    // Update conversation
    if (message?.content) {
      conversation.lastMessage = message._id;
    }

    conversation.unreadCount += 1;
    await conversation.save();

    // Populate message for frontend
    const populatedMessage = await Message.findOne({ _id: message._id })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture");

    // Save to Redis cache
    // await cacheMessage(conversation._id, message);

    // Invalidate cache
    // await redisClient.del(`conversations:${senderId}`);
    // await redisClient.del(`conversations:${receiverId}`);

    // Emit via socket.io
    if (req.io && req.socketUserMap) {
      const receiverSocketId = req.socketUserMap.get(receiverId);
      if (receiverSocketId) {
        req.io.to(receiverSocketId).emit("receive_message", populatedMessage);
        message.messageStatus = "delivered";
        await message.save();
      }
    }

    return response(res, 201, "Message sent successfully", populatedMessage);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// get all conversation
const getConversation = async (req, res) => {
  const userId = req.user.userId;
  // const redisKey = `conversations:${userId}`;

  try {
    // Try to get from Redis
    // const cachedData = await redisClient.get(redisKey);
    // if (cachedData) {
    //   const conversations = JSON.parse(cachedData);
    //   return response(res, 200, "Conversation retrieved from cache", conversations);
    // }

    // Not in cache? Get from DB
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender receiver",
          select: "username profilePicture",
        },
      })
      .sort({ updatedAt: -1 });

    // Cache in Redis for 60 seconds
    // await redisClient.setEx(redisKey, 60, JSON.stringify(conversations)); // Cache for 60 seconds

    return response(res, 201, "Conversation get successfully", conversations);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

//get messages of specific conversation
const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;
  // const redisKey = `messages:${conversationId}`;

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return response(res, 404, "Conversation not found");
    }
    if (!conversation.participants.includes(userId)) {
      return response(res, 403, "Not authorized to view this conversation");
    }

    // Try Redis cache first
    // const cachedMessages = await redisClient.lRange(redisKey, 0, -1);
    // if (cachedMessages?.length) {
    //   const parsedMessages = cachedMessages.map((msg) => JSON.parse(msg));
    //   return response(res, 200, "Messages retrieved from cache", parsedMessages);
    // }

    // Not in cache? Get from DB
    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort("createdAt");

    // Store each message in Redis
    // for (const message of messages) {
    //   await redisClient.rPush(redisKey, JSON.stringify(message));
    // }
    // await redisClient.lTrim(redisKey, -50, -1);

    // Mark as read
    const result = await Message.updateMany(
      {
        conversation: conversationId,
        receiver: userId,
        messageStatus: { $in: ["send", "delivered"] },
      },
      { $set: { messageStatus: "read" } }
    );

    // Decrease unreadCount by number of messages updated
    conversation.unreadCount = Math.max(
      0,
      conversation.unreadCount - result.modifiedCount
    );
    // conversation.unreadCount = 0;

    await conversation.save();

    return response(res, 200, "Message retrieved", messages);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

const markAsRead = async (req, res) => {
  const { messageId } = req.body;
  const userId = req.user.userId;
  try {
    //get relevant message to determine senders
    let messages = await Message.find({
      _id: { $in: messageId },
      receiver: userId,
    });
    await Message.updateMany(
      {
        _id: { $in: messageId },
        receiver: userId,
        messageStatus: { $in: ["send", "delivered"] },
      },
      { $set: { messageStatus: "read" } }
    );

    // notify to original sender
    if (req.io && req.socketUserMap) {
      for (const message of messages) {
        const senderSocketId = req.socketUserMap.get(message.sender.toString());
        if (senderSocketId) {
          const updatedMessage = {
            _id: message._id,
            messageStatus: "read",
          };
          req.io.to(senderSocketId).emit("message_read", updatedMessage);

          await message.save();
        }
      }
    }

    return response(res, 200, "Message marked as read", messages);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;
  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return response(res, 404, "Message not found");
    }
    if (message.sender.toString() !== userId) {
      return response(res, 403, "Not authorized to delete this message");
    }
    await message.deleteOne();

    // Invalidate cache
    // await redisClient.del(`chat:${message.conversation.toString()}`);
    // await deleteMessageFromRedisList(message.conversation.toString(), message._id.toString());
    // await redisClient.del(`conversations:${userId}`);
    // await redisClient.del(`conversations:${message.receiver.toString()}`);

    // Emit socket event
    if (req.io && req.socketUserMap) {
      const receiverSocketId = req.socketUserMap.get(
        message.receiver.toString()
      );
      if (receiverSocketId) {
        req.io.to(receiverSocketId).emit("message_deleted", messageId);
      }
    }

    return response(res, 200, "Message deleted successfully");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

export const deleteMessageFromRedisList = async (
  conversationId,
  messageIdToDelete
) => {
  // const redisKey = `chat:${conversationId}`;
  try {
    const messages = await redisClient.lRange(redisKey, 0, -1);
    if (!messages || messages.length === 0) return;

    const updatedMessages = messages
      .map((m) => JSON.parse(m))
      .filter((msg) => msg._id !== messageIdToDelete);

    // Delete old list
    // await redisClient.del(redisKey);

    // Re-push filtered messages (in reverse to preserve original order)
    // for (const msg of updatedMessages.reverse()) {
    //   await redisClient.lPush(redisKey, JSON.stringify(msg));
    // }

    // console.log(`✅ Message ${messageIdToDelete} deleted from Redis list for ${conversationId}`);
  } catch (error) {
    console.error("❌ Failed to delete message from Redis:", error);
  }
};

export default {
  sendMessage,
  getConversation,
  getMessages,
  markAsRead,
  deleteMessage,
};
