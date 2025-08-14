import { Server } from "socket.io";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: process.env.REDIS_URL });
const redisClient = pubClient;
const subClient = pubClient.duplicate();

await pubClient.connect();
await subClient.connect();

// Map to store online users -> userId, socketId
const onlineUsers = new Map();

// Map to track typing status -> userId -> [conversation]: boolean
const typingUsers = new Map();

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
    pingTimeout: 60000, //Disconnect inactive users or sockets after 60s
  });

  io.adapter(createAdapter(pubClient, subClient));
  io.socketUserMap = new Map();

  // when a new socket connection is established
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    let userId = null;

    // handle user connection and mark them online in database
    socket.on("user_connected", async (connectingUserId) => {
      try {
        userId = connectingUserId;
        onlineUsers.set(userId, socket.id);

        await redisClient.set(`online:${userId}`, socket.id);

        socket.join(userId); //join a personal room for direct emits

        // update user status in db
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date(),
        });

        // notify all users that this user is now online
        io.emit("user_status", { userId, isOnline: true });
      } catch (error) {
        console.error("Error handling user connection: ", error);
      }
    });

    // Return online status of requested user
    socket.on("get_user_status", async (requestedUserId, callback) => {
      try {
        const socketId = await redisClient.get(`online:${requestedUserId}`);
        const isOnline = socketId !== null;
        callback({
          userId: requestedUserId,
          isOnline,
          lastSeen: isOnline ? new Date() : null,
        });
      } catch (err) {
        console.error("Redis error fetching user status:", err);
        callback({ userId: requestedUserId, isOnline: false });
      }
    });

    // Forward message to receiver if online
    socket.on("send_message", async (message) => {
      try {
        // const receiverSocketId = onlineUsers.get(message.receiver?.id);
        const receiverSocketId = await redisClient.get(
          `online:${message.receiver?.id}`
        );
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", message);
        }
      } catch (error) {
        console.error("Error sending message: ", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    // update message as read and notify sender
    socket.on("message_read", async ({ messageIds, senderId }) => {
      try {
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { messageStatus: "read" } }
        );

        const senderSocketId = onlineUsers.get(senderId);
        if (senderSocketId) {
          messageIds.forEach((messageId) => {
            io.to(senderSocketId).emit("message_status_update", {
              messageId,
              messageStatus: "read",
            });
          });
        }
      } catch (error) {
        console.error("Error updating message read status: ", error);
      }
    });

    // handle typing start event and auto-stop after 3s
    socket.on("typing_start", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      if (!typingUsers.has(userId)) typingUsers.set(userId, {});

      const userTyping = typingUsers.get(userId);

      userTyping[conversationId] = true;

      // clear any existing timout
      if (userTyping[`${conversationId}_timeout`]) {
        clearTimeout(userTyping[`${conversationId}_timeout`]);
      }

      // auto-stop after 3s
      userTyping[`${conversationId}_timeout`] = setTimeout(() => {
        userTyping[conversationId] = false;
        io.to(receiverId).emit("user_typing", {
          userId,
          conversationId,
          isTyping: false,
        });
      }, 3000);

      // Notify receiver
      socket.to(receiverId).emit("user_typing", {
        userId,
        conversationId,
        isTyping: true,
      });
    });

    //
    socket.on("typing_stop", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      if (!typingUsers.has(userId)) {
        const userTyping = typingUsers.get(userId);
        userTyping[conversationId] = false;
      }

      const userTyping = typingUsers.get(userId);

      if (userTyping[`${conversationId}_timeout`]) {
        clearTimeout(userTyping[`${conversationId}_timeout`]);
        delete userTyping[`${conversationId}_timeout`];
      }

      socket.to(receiverId).emit("user_typing", {
        userId,
        conversationId,
        isTyping: false,
      });
    });

    // add or update reactions
    socket.on(
      "add_reaction",
      async ({ messageId, emoji, userId, reactionUserId }) => {
        try {
          const message = await Message.findById(messageId);
          if (!message) return;

          const existingIndex = message.reactions.findIndex(
            (r) => r.user.toString() === reactionUserId
          );

          if (existingIndex > -1) {
            const existing = message.reactions(existingIndex);
            if (existing.emoji === emoji) {
              // remove same reaction
              message.reactions.splice(existingIndex, 1);
            } else {
              // change emoji
              message.reactions[existingIndex].emoji = emoji;
            }
          } else {
            // add new reaction
            message.reactions.push({ user: reactionUserId, emoji });
          }

          await message.save();

          const populatedMessage = await Message.findOne(message?._id)
            .populate("sender", "username profilePicture")
            .populate("receiver", "username profilePicture")
            .populate("reactions.user", "username");

          const reactionUpdated = {
            messageId,
            reactions: populatedMessage.reactions,
          };

          const senderSocket = onlineUsers.get(
            populatedMessage.sender._id.toString()
          );
          const receiverSocket = onlineUsers.get(
            populatedMessage.receiver?._id.toString()
          );

          if (senderSocket)
            io.to(senderSocket).emit("reaction_update", reactionUpdated);

          if (receiverSocket)
            io.to(receiverSocket).emit("reaction_update", reactionUpdated);
        } catch (error) {
          console.error("Error handling reaction: ", error);
        }
      }
    );

    // Group Messaging
    // Join Group Room (on login or group open)
    socket.on("join_group", async ({ groupId }) => {
      try {
        const group = await Group.findById(groupId);
        if (!group) return;
        if (!group.members.includes(userId)) return;
        socket.join(groupId);
        console.log(`User ${userId} joined group ${groupId}`);
      } catch (error) {
        console.error("Error joining group:", error);
      }
    });

    // Send Group Message (real-time broadcast after saving via API)
    socket.on("send_group_message", async ({ groupId, content }) => {
      try {
        const group = await Group.findById(groupId);
        if (!group) return;

        const message = await GroupMessage.create({
          group: groupId,
          sender: userId,
          content,
          contentType: "text",
        });

        group.lastMessage = message._id;
        await group.save();

        const populatedMessage = await GroupMessage.findById(
          message._id
        ).populate("sender", "username profilePicture");

        io.to(groupId).emit("new_group_message", populatedMessage);
      } catch (error) {
        console.error("Error sending group message:", error);
        socket.emit("group_message_error", "Failed to send message");
      }
    });

    // Group Updated Event (after adding new member)
    socket.on("group_updated_broadcast", async ({ groupId }) => {
      try {
        const updatedGroup = await Group.findById(groupId)
          .populate("members", "username profilePicture")
          .populate("admin", "username profilePicture")
          .populate("lastMessage");

        io.to(groupId).emit("group_updated", updatedGroup);
      } catch (error) {
        console.error("Error broadcasting group update:", error);
      }
    });

    // Mark Messages as Read (real-time read indicators)
    socket.on("group_mark_read", async ({ groupId }) => {
      try {
        await GroupMessage.updateMany(
          { group: groupId, readBy: { $ne: userId } },
          { $push: { readBy: userId } }
        );

        io.to(groupId).emit("group_message_read", { userId, groupId });
      } catch (error) {
        console.error("Error marking group messages as read:", error);
      }
    });

    // Delete Group Message (sender/admin deletes message, notify all)
    socket.on("group_delete_message", async ({ messageId }) => {
      try {
        const message = await GroupMessage.findById(messageId);
        if (!message) return;

        const group = await Group.findById(message.group);
        if (!group) return;

        if (
          message.sender.toString() !== userId &&
          group.admin.toString() !== userId
        ) {
          return socket.emit("group_delete_message_error", "Not authorized");
        }

        await message.deleteOne();
        io.to(group._id.toString()).emit("group_message_deleted", messageId);
      } catch (error) {
        console.error("Error deleting group message:", error);
      }
    });

    // add group reactions
    socket.on("group_add_reaction", async ({ messageId, emoji }) => {
      try {
        const message = await GroupMessage.findById(messageId);
        if (!message) return;

        const existingIndex = message.reactions.findIndex(
          (r) => r.user.toString() === userId
        );

        if (existingIndex > -1) {
          if (message.reactions[existingIndex].emoji === emoji) {
            // Remove reaction if same emoji clicked again
            message.reactions.splice(existingIndex, 1);
          } else {
            // Update to new emoji
            message.reactions[existingIndex].emoji = emoji;
          }
        } else {
          message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        const populatedMessage = await GroupMessage.findById(messageId)
          .populate("sender", "username profilePicture")
          .populate("reactions.user", "username profilePicture");

        io.to(message.group.toString()).emit("group_reaction_update", {
          messageId,
          reactions: populatedMessage.reactions,
        });
      } catch (error) {
        console.error("Group reaction error:", error);
      }
    });

    // Calling Socket Code
    // Initiate Call
    socket.on("start_call", ({ callType, receiverId, roomId }) => {
      console.log(
        `User ${userId} is starting a ${callType} call to ${receiverId}`
      );

      io.to(receiverId).emit("incoming_call", {
        roomId,
        callerId: userId,
        callType,
      });
    });

    // Accept Call
    // socket.on("accept_call", ({ roomId, receiverId }) => {
    //     console.log(`User ${userId} accepted the call with room ${roomId}`);
    //     io.to(receiverId).emit("call_accepted", { roomId });
    // });

    socket.on("accept_call", ({ roomId, callerId }) => {
      console.log(`User ${userId} accepted the call with room ${roomId}`);
      io.to(callerId).emit("call_accepted", { roomId });
    });

    // Reject Call
    // socket.on("reject_call", ({ receiverId }) => {
    //     console.log(`User ${userId} rejected the call`);
    //     io.to(receiverId).emit("call_rejected", { rejectedBy: userId });
    // });

    socket.on("reject_call", ({ callerId }) => {
      console.log(`User ${userId} rejected the call`);
      io.to(callerId).emit("call_rejected", { rejectedBy: userId });
    });

    // End Call
    socket.on("end_call", ({ callerId }) => {
      console.log(`User ${userId} ended the call`);
      io.to(callerId).emit("call_ended", { endedBy: userId });
    });

    // Forwards WebRTC Signals (Offer/Answer/ICE)
    socket.on("webrtc_signal", ({ callerId, data }) => {
      io.to(callerId).emit("webrtc_signal", {
        senderId: userId,
        data,
      });
    });

    // ========= GROUP CALL HANDLING =========

    socket.on("start_group_call", ({ groupId, callType }) => {
      console.log(
        `User ${userId} started a ${callType} group call in group ${groupId}`
      );

      // Join room for signaling
      socket.join(groupId);

      // Notify others in the group about the incoming group call
      socket.to(groupId).emit("incoming_group_call", {
        groupId,
        callerId: userId,
        callType,
      });
    });

    socket.on("join_group_call", ({ groupId }) => {
      console.log(`User ${userId} joined group call in group ${groupId}`);

      // Join signaling room
      socket.join(groupId);

      // Inform others to connect with the new user
      socket.to(groupId).emit("user_joined_group_call", { userId });
    });

    // Forward WebRTC Signal to group peers
    socket.on("group_webrtc_signal", ({ groupId, signalData, toUserId }) => {
      io.to(toUserId).emit("group_webrtc_signal", {
        fromUserId: userId,
        signalData,
      });
    });

    // Leave Group Call
    socket.on("leave_group_call", ({ groupId }) => {
      console.log(`User ${userId} left group call in group ${groupId}`);

      socket.leave(groupId);

      // Notify others
      socket.to(groupId).emit("user_left_group_call", { userId });
    });

    // End Group Call (by host/admin)
    socket.on("end_group_call", ({ groupId }) => {
      console.log(`Group call in ${groupId} ended by ${userId}`);

      // Notify all
      io.to(groupId).emit("group_call_ended", { endedBy: userId });

      // Leave room
      socket.leave(groupId);
    });

    socket.on("request_group_call_users", ({ groupId }) => {
      const socketsInRoom = io.sockets.adapter.rooms.get(groupId);
      const users = Array.from(socketsInRoom || []).map((socketId) => {
        const userEntry = Array.from(onlineUsers.entries()).find(
          ([uid, sid]) => sid === socketId
        );
        return userEntry?.[0]; // userId
      });

      socket.emit("group_call_users", { groupId, users });
    });

    socket.on("start_call", ({ callType, receiverId, roomId }) => {
      io.to(receiverId).emit("incoming_call", {
        roomId,
        callerId: userId,
        callType,
      });

      setTimeout(() => {
        io.to(userId).emit("call_missed", { receiverId });
      }, 30000);
    });

    // handle disconnection and mark user offline
    const handleDisconnected = async () => {
      if (!userId) return;

      try {
        onlineUsers.delete(userId);

        await redisClient.del(`online:${userId}`); // Redis cleanup

        // clear all typing timeouts
        if (typingUsers.has(userId)) {
          const userTyping = typingUsers.get(userId);
          Object.keys(userTyping).forEach((key) => {
            if (key.endsWith("_timeout")) clearTimeout(userTyping[key]);
          });

          typingUsers.delete(userId);
        }

        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });

        io.emit("user_status", {
          userId,
          isOnline: false,
          lastSeen: new Date(),
        });

        socket.leave(userId);

        console.log(`user ${userId} disconnected`);
      } catch (error) {
        console.error("Error handling disconnection", error);
      }
    };

    // disconnect event
    socket.on("disconnect", handleDisconnected);
  });

  // attach the online user map to the socket server for external user
  io.socketUserMap = onlineUsers;

  return io;
};

export default initializeSocket;
