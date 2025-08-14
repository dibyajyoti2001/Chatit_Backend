// import Group from "../models/Group.js";
// import GroupMessage from "../models/GroupMessage.js";
// import response from "../utils/responseHandler.js";
// import cloudinaryConfig from "../config/cloudinaryConfig.js";
// import redisClient from "../config/redis.js";
// import { decryptText, encryptText } from "../utils/encryption.js";

// // Create group
// const createGroup = async (req, res) => {
//   try {
//     const { name, members, description } = req.body;
//     // const profilePicture = req.file ? (await cloudinaryConfig.uploadFileToCloudinary(req.file)).secure_url : null;
//     const admin = req.user.userId;

//     if (!name || !members || !Array.isArray(members) || members.length < 1) {
//       return response(
//         res,
//         400,
//         "Group name and at least one member are required"
//       );
//     }

//     // Ensure admin is part of members
//     if (!members.includes(admin)) members.push(admin);

//     let profilePicture = null;
//     const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
//     if (file) {
//       const uploadResult = await cloudinaryConfig.uploadFileToCloudinary(file);
//       profilePicture = uploadResult?.secure_url;
//     } else if (req.body.profilePicture) {
//       profilePicture = req.body.profilePicture;
//     }

//     // Create the group
//     const group = await Group.create({
//       name,
//       profilePicture,
//       description: description || "Welcome to the Group!",
//       members,
//       admin,
//     });

//     // ✅ Redis Invalidation for all members' group list
//     // for (const memberId of members) {
//     //   await redisClient.del(`user:groups:${memberId}`);
//     // }

//     // ✅ Return response
//     const populatedGroup = await Group.findById(group._id).populate(
//       "members",
//       "name profilePicture"
//     );
//     return response(res, 201, "Group created successfully", populatedGroup);

//     // response(res, 201, "Group created successfully", group);
//   } catch (error) {
//     console.error(error);
//     response(res, 500, "Failed to create group");
//   }
// };

// // Send message in group
// const sendGroupMessage = async (req, res) => {
//   try {
//     const { groupId, content } = req.body;
//     const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
//     const userId = req.user.userId;

//     const group = await Group.findById(groupId);
//     if (!group) return response(res, 404, "Group not found");

//     let imageOrVideoUrl = null;
//     let contentType = "text";

//     if (file) {
//       const uploaded = await cloudinaryConfig.uploadFileToCloudinary(file);

//       if (!uploaded?.secure_url) {
//         return response(res, 400, "Failed to upload media");
//       }

//       imageOrVideoUrl = uploaded.secure_url;

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

//     if (!file && !content?.trim()) {
//       return response(res, 400, "Message content required");
//     }

//     // Save the message in MongoDB
//     // const message = await GroupMessage.create({
//     //   group: groupId,
//     //   sender: userId,
//     //   content: content || contentType,
//     //   imageOrVideoUrl,
//     //   contentType,
//     // });

//     const encryptedContent = content ? encryptText(content) : contentType;

//     const message = await GroupMessage.create({
//       group: groupId,
//       sender: userId,
//       content: encryptedContent,
//       imageOrVideoUrl,
//       contentType,
//     });

//     // Update group
//     group.lastMessage = message._id;
//     await group.save();

//     // Get populated message
//     const populatedMessage = await GroupMessage.findById(message._id).populate(
//       "sender",
//       "username profilePicture"
//     );

//     // Emit to group members
//     req.io.to(groupId).emit("new_group_message", populatedMessage);

//     // Push to Redis List
//     // const redisKey = `group:messages:${groupId}`;
//     // await redisClient.rPush(redisKey, JSON.stringify(populatedMessage));

//     // Keep only latest 50 messages
//     // await redisClient.lTrim(redisKey, -50, -1);

//     response(res, 201, "Message sent", populatedMessage);
//   } catch (error) {
//     console.error(error);
//     response(res, 500, "Failed to send message");
//   }
// };

// // Get group messages
// const getGroupMessages = async (req, res) => {
//   const { groupId } = req.params;
//   // const redisKey = `group:messages:${groupId}`;

//   try {
//     // 1. Try to fetch messages from Redis list
//     // const cachedMessages = await redisClient.lRange(redisKey, 0, -1);

//     // if (cachedMessages.length > 0) {
//     //   const parsedMessages = cachedMessages.map(msg => JSON.parse(msg));
//     //   return response(res, 200, "Group messages retrieved from cache", parsedMessages);
//     // }

//     // 2. Not found in Redis? Fetch from MongoDB
//     const group = await Group.findById(groupId);
//     if (!group) return response(res, 404, "Group not found");

//     // const messages = await GroupMessage.find({ group: groupId })
//     //   .populate("sender", "username profilePicture")
//     //   .sort("createdAt");

//     const messages = await GroupMessage.find({ group: groupId })
//       .populate("sender", "username profilePicture")
//       .sort("createdAt");

//     const decryptedMessages = messages.map((msg) => ({
//       ...msg.toObject(),
//       content:
//         msg.contentType === "text" ? decryptText(msg.content) : msg.content,
//     }));

//     // 3. Push to Redis for caching (latest 50 messages)
//     // for (const msg of messages) {
//     //   await redisClient.rPush(redisKey, JSON.stringify(msg));
//     // }
//     // await redisClient.lTrim(redisKey, -50, -1); // trim to last 50

//     response(res, 200, "Group messages retrieved", decryptedMessages);
//   } catch (error) {
//     console.error(error);
//     response(res, 500, "Failed to get messages");
//   }
// };

// // Get groups where user is the group admin
// const getAdminGroups = async (req, res) => {
//   const userId = req.user.userId;
//   // const redisKey = `admin:groups:${userId}`;

//   try {
//     // const cached = await redisClient.get(redisKey);
//     // if (cached) {
//     //   return response(res, 200, "Admin groups from cache", JSON.parse(cached));
//     // }

//     const adminGroups = await Group.find({ admin: userId })
//       .populate("members", "username profilePicture")
//       .populate("lastMessage");

//     // await redisClient.setEx(redisKey, 60, JSON.stringify(adminGroups));

//     return response(res, 200, "Admin groups fetched", adminGroups);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Failed to fetch admin groups");
//   }
// };

// // Get groups where user is the group members and someone else is admin
// const getUserGroups = async (req, res) => {
//   // const redisKey = `user:groups:${userId}`;

//   try {
//     // const cached = await redisClient.get(redisKey);
//     // if (cached) {
//     //   return response(res, 200, "Groups fetched from cache", JSON.parse(cached));
//     // }

//     const groups = await Group.find({ members: req.user.userId })
//       .populate("members", "username profilePicture")
//       .populate("lastMessage")
//       .sort("-updatedAt");

//     // await redisClient.setEx(redisKey, 60, JSON.stringify(groups));

//     response(res, 200, "Groups fetched", groups);
//   } catch (error) {
//     console.error(error);
//     response(res, 500, "Failed to fetch groups");
//   }
// };

// const addMemberToGroup = async (req, res) => {
//   try {
//     const { groupId, newMemberId } = req.body;
//     const userId = req.user.userId;

//     const group = await Group.findById(groupId);
//     if (!group) return response(res, 404, "Group not found");

//     if (group.admin.toString() !== userId) {
//       return response(res, 403, "Only admin can add members");
//     }

//     if (group.members.includes(newMemberId)) {
//       return response(res, 400, "User already in the group");
//     }

//     group.members.push(newMemberId);
//     await group.save();

//     const updatedGroup = await Group.findById(groupId)
//       .populate("members", "username profilePicture")
//       .populate("admin", "username profilePicture");

//     req.io.to(groupId).emit("group_updated", updatedGroup);

//     return response(res, 200, "Member added successfully", updatedGroup);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Internal server error");
//   }
// };

// const updateGroupDetails = async (req, res) => {
//   const { name, description } = req.body;
//   const { groupId } = req.params;
//   const userId = req.user.userId;

//   try {
//     const group = await Group.findById(groupId);
//     if (!group) return response(res, 404, "Group not found");

//     // Only admin can update group details
//     if (group.admin.toString() !== userId) {
//       return response(res, 403, "Only group admin can update group details");
//     }

//     const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
//     if (file) {
//       const uploadResult = await cloudinaryConfig.uploadFileToCloudinary(file);
//       group.profilePicture = uploadResult?.secure_url;
//     } else if (req.body.profilePicture) {
//       group.profilePicture = req.body.profilePicture;
//     }

//     if (name) group.name = name;
//     if (description) group.description = description;

//     await group.save();

//     return response(res, 200, "Group details updated successfully!", group);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Internal server error");
//   }
// };

// const markGroupMessagesAsRead = async (req, res) => {
//   const { groupId } = req.body;
//   const userId = req.user.userId;

//   try {
//     const messages = await GroupMessage.updateMany(
//       { group: groupId, readBy: { $ne: userId } },
//       { $push: { readBy: userId } }
//     );

//     req.io.to(groupId).emit("group_message_read", { userId, groupId });

//     return response(res, 200, "Messages marked as read");
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Failed to mark messages as read");
//   }
// };

// const getGroupInfo = async (req, res) => {
//   const { groupId } = req.params;
//   const userId = req.user.userId;
//   // const redisKey = `group:info:${groupId}`;

//   try {
//     // const cached = await redisClient.get(redisKey);
//     // if (cached) {
//     //   const group = JSON.parse(cached);
//     //   if (!group.members.some(m => m._id === userId || m._id?.toString() === userId)) {
//     //     return response(res, 403, "Not authorized to view this group");
//     //   }
//     //   return response(res, 200, "Group details fetched from cache", group);
//     // }

//     const group = await Group.findById(groupId)
//       .populate("members", "username profilePicture")
//       .populate("admin", "username profilePicture")
//       .populate("name")
//       .populate("profilePicture")
//       .populate("description")
//       .populate("lastMessage");

//     if (!group) return response(res, 404, "Group not found");

//     // if (!group.members.includes(userId)) {
//     //   return response(res, 403, "Not authorized to view this group");
//     // }

//     const isMember = group.members.some(
//       (m) => m._id.toString() === userId.toString()
//     );

//     if (!isMember) {
//       return response(res, 403, "Not authorized to view this group");
//     }

//     // await redisClient.setEx(redisKey, 60, JSON.stringify(group));

//     // return response(res, 200, "Group details fetched", group);

//     console.log(group.name, group.profilePicture);

//     return response(res, 200, "Group details fetched", {
//       name: group.name,
//       profilePicture: group.profilePicture,
//       description: group.description,
//       admin: {
//         username: group.admin?.username || null,
//         profilePicture: group.admin?.profilePicture || null,
//       },
//       members: group.members.map((m) => ({
//         username: m.username,
//         profilePicture: m.profilePicture,
//       })),
//       lastMessage: group.lastMessage
//         ? {
//             content: group.lastMessage.content,
//             sender: {
//               username: group.lastMessage.sender?.username || null,
//               profilePicture: group.lastMessage.sender?.profilePicture || null,
//             },
//             createdAt: group.lastMessage.createdAt,
//           }
//         : null,
//     });
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Failed to fetch group details");
//   }
// };

// const deleteGroupMessage = async (req, res) => {
//   const { messageId } = req.params;
//   const userId = req.user.userId;

//   try {
//     const message = await GroupMessage.findById(messageId);
//     if (!message) return response(res, 404, "Message not found");

//     const group = await Group.findById(message.group);
//     if (!group) return response(res, 404, "Group not found");

//     if (
//       message.sender.toString() !== userId &&
//       group.admin.toString() !== userId
//     ) {
//       return response(res, 403, "Not authorized to delete this message");
//     }

//     await message.deleteOne();

//     req.io.to(group._id.toString()).emit("group_message_deleted", messageId);

//     // await redisClient.del(`group:messages:${group._id.toString()}`);

//     // const redisKey = `group:messages:${group._id.toString()}`;
//     // const cachedMessages = await redisClient.get(redisKey);

//     // if (cachedMessages) {
//     //   const messages = JSON.parse(cachedMessages);
//     //   const updated = messages.filter(msg => msg._id !== messageId);
//     //   await redisClient.set(redisKey, JSON.stringify(updated));
//     // }

//     return response(res, 200, "Message deleted successfully");
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Failed to delete message");
//   }
// };

// const deleteGroup = async (req, res) => {
//   const { groupId } = req.params;
//   const userId = req.user.userId;

//   try {
//     const group = await Group.findById(groupId);
//     if (!group) return response(res, 404, "Group not found");

//     if (group.admin.toString() !== userId) {
//       return response(res, 403, "Only admin can delete group");
//     }

//     await GroupMessage.deleteMany({ group: groupId });
//     await group.deleteOne();

//     req.io.to(groupId).emit("group_deleted", { groupId });

//     // await redisClient.del(`group:messages:${groupId}`);
//     // await redisClient.del(`group:info:${groupId}`);
//     // await redisClient.del(`admin:groups:${userId}`);
//     // group.members.forEach(async memberId => {
//     //   await redisClient.del(`user:groups:${memberId.toString()}`);
//     // });

//     return response(res, 200, "Group deleted successfully");
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Failed to delete group");
//   }
// };

// export default {
//   createGroup,
//   sendGroupMessage,
//   getGroupMessages,
//   getUserGroups,
//   addMemberToGroup,
//   updateGroupDetails,
//   markGroupMessagesAsRead,
//   deleteGroupMessage,
//   getAdminGroups,
//   getGroupInfo,
//   deleteGroup,
// };

import Group from "../models/Group.js";
import GroupMessage from "../models/GroupMessage.js";
import response from "../utils/responseHandler.js";
import cloudinaryConfig from "../config/cloudinaryConfig.js";
import redisClient from "../config/redis.js";

// Create group
const createGroup = async (req, res) => {
  try {
    const { name, members, description } = req.body;
    // const profilePicture = req.file ? (await cloudinaryConfig.uploadFileToCloudinary(req.file)).secure_url : null;
    const admin = req.user.userId;

    if (!name || !members || !Array.isArray(members) || members.length < 1) {
      return response(
        res,
        400,
        "Group name and at least one member are required"
      );
    }

    // Ensure admin is part of members
    if (!members.includes(admin)) members.push(admin);

    let profilePicture = null;
    const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
    if (file) {
      const uploadResult = await cloudinaryConfig.uploadFileToCloudinary(file);
      profilePicture = uploadResult?.secure_url;
    } else if (req.body.profilePicture) {
      profilePicture = req.body.profilePicture;
    }

    // Create the group
    const group = await Group.create({
      name,
      profilePicture,
      description: description || "Welcome to the Group!",
      members,
      admin,
    });

    // ✅ Redis Invalidation for all members' group list
    // for (const memberId of members) {
    //   await redisClient.del(`user:groups:${memberId}`);
    // }

    // ✅ Return response
    const populatedGroup = await Group.findById(group._id).populate(
      "members",
      "name profilePicture"
    );
    return response(res, 201, "Group created successfully", populatedGroup);

    // response(res, 201, "Group created successfully", group);
  } catch (error) {
    console.error(error);
    response(res, 500, "Failed to create group");
  }
};

// Send message in group
const sendGroupMessage = async (req, res) => {
  try {
    const { groupId, content } = req.body;
    const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return response(res, 404, "Group not found");

    let imageOrVideoUrl = null;
    let contentType = "text";

    if (file) {
      const uploaded = await cloudinaryConfig.uploadFileToCloudinary(file);

      if (!uploaded?.secure_url) {
        return response(res, 400, "Failed to upload media");
      }

      imageOrVideoUrl = uploaded.secure_url;

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

    if (!file && !content?.trim()) {
      return response(res, 400, "Message content required");
    }

    // Save the message in MongoDB
    const message = await GroupMessage.create({
      group: groupId,
      sender: userId,
      content: content || contentType,
      imageOrVideoUrl,
      contentType,
    });

    // Update group
    group.lastMessage = message._id;
    await group.save();

    // Get populated message
    const populatedMessage = await GroupMessage.findById(message._id).populate(
      "sender",
      "username profilePicture"
    );

    // Emit to group members
    req.io.to(groupId).emit("new_group_message", populatedMessage);

    // Push to Redis List
    // const redisKey = `group:messages:${groupId}`;
    // await redisClient.rPush(redisKey, JSON.stringify(populatedMessage));

    // Keep only latest 50 messages
    // await redisClient.lTrim(redisKey, -50, -1);

    response(res, 201, "Message sent", populatedMessage);
  } catch (error) {
    console.error(error);
    response(res, 500, "Failed to send message");
  }
};

// Get group messages
const getGroupMessages = async (req, res) => {
  const { groupId } = req.params;
  // const redisKey = `group:messages:${groupId}`;

  try {
    // 1. Try to fetch messages from Redis list
    // const cachedMessages = await redisClient.lRange(redisKey, 0, -1);

    // if (cachedMessages.length > 0) {
    //   const parsedMessages = cachedMessages.map(msg => JSON.parse(msg));
    //   return response(res, 200, "Group messages retrieved from cache", parsedMessages);
    // }

    // 2. Not found in Redis? Fetch from MongoDB
    const group = await Group.findById(groupId);
    if (!group) return response(res, 404, "Group not found");

    const messages = await GroupMessage.find({ group: groupId })
      .populate("sender", "username profilePicture")
      .sort("createdAt");

    // 3. Push to Redis for caching (latest 50 messages)
    // for (const msg of messages) {
    //   await redisClient.rPush(redisKey, JSON.stringify(msg));
    // }
    // await redisClient.lTrim(redisKey, -50, -1); // trim to last 50

    response(res, 200, "Group messages retrieved", messages);
  } catch (error) {
    console.error(error);
    response(res, 500, "Failed to get messages");
  }
};

// Get groups where user is the group admin
const getAdminGroups = async (req, res) => {
  const userId = req.user.userId;
  // const redisKey = `admin:groups:${userId}`;

  try {
    // const cached = await redisClient.get(redisKey);
    // if (cached) {
    //   return response(res, 200, "Admin groups from cache", JSON.parse(cached));
    // }

    const adminGroups = await Group.find({ admin: userId })
      .populate("members", "username profilePicture")
      .populate("lastMessage");

    // await redisClient.setEx(redisKey, 60, JSON.stringify(adminGroups));

    return response(res, 200, "Admin groups fetched", adminGroups);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to fetch admin groups");
  }
};

// Get groups where user is the group members and someone else is admin
const getUserGroups = async (req, res) => {
  // const redisKey = `user:groups:${userId}`;

  try {
    // const cached = await redisClient.get(redisKey);
    // if (cached) {
    //   return response(res, 200, "Groups fetched from cache", JSON.parse(cached));
    // }

    const groups = await Group.find({ members: req.user.userId })
      .populate("members", "username profilePicture")
      .populate("lastMessage")
      .sort("-updatedAt");

    // await redisClient.setEx(redisKey, 60, JSON.stringify(groups));

    response(res, 200, "Groups fetched", groups);
  } catch (error) {
    console.error(error);
    response(res, 500, "Failed to fetch groups");
  }
};

const addMemberToGroup = async (req, res) => {
  try {
    const { groupId, newMemberId } = req.body;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return response(res, 404, "Group not found");

    if (group.admin.toString() !== userId) {
      return response(res, 403, "Only admin can add members");
    }

    if (group.members.includes(newMemberId)) {
      return response(res, 400, "User already in the group");
    }

    group.members.push(newMemberId);
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("members", "username profilePicture")
      .populate("admin", "username profilePicture");

    req.io.to(groupId).emit("group_updated", updatedGroup);

    return response(res, 200, "Member added successfully", updatedGroup);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

const updateGroupDetails = async (req, res) => {
  const { name, description } = req.body;
  const { groupId } = req.params;
  const userId = req.user.userId;

  try {
    const group = await Group.findById(groupId);
    if (!group) return response(res, 404, "Group not found");

    // Only admin can update group details
    if (group.admin.toString() !== userId) {
      return response(res, 403, "Only group admin can update group details");
    }

    const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
    if (file) {
      const uploadResult = await cloudinaryConfig.uploadFileToCloudinary(file);
      group.profilePicture = uploadResult?.secure_url;
    } else if (req.body.profilePicture) {
      group.profilePicture = req.body.profilePicture;
    }

    if (name) group.name = name;
    if (description) group.description = description;

    await group.save();

    return response(res, 200, "Group details updated successfully!", group);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

const markGroupMessagesAsRead = async (req, res) => {
  const { groupId } = req.body;
  const userId = req.user.userId;

  try {
    const messages = await GroupMessage.updateMany(
      { group: groupId, readBy: { $ne: userId } },
      { $push: { readBy: userId } }
    );

    req.io.to(groupId).emit("group_message_read", { userId, groupId });

    return response(res, 200, "Messages marked as read");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to mark messages as read");
  }
};

const getGroupInfo = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.userId;
  // const redisKey = `group:info:${groupId}`;

  try {
    // const cached = await redisClient.get(redisKey);
    // if (cached) {
    //   const group = JSON.parse(cached);
    //   if (!group.members.some(m => m._id === userId || m._id?.toString() === userId)) {
    //     return response(res, 403, "Not authorized to view this group");
    //   }
    //   return response(res, 200, "Group details fetched from cache", group);
    // }

    const group = await Group.findById(groupId)
      .populate("members", "username profilePicture")
      .populate("admin", "username profilePicture")
      .populate("name")
      .populate("profilePicture")
      .populate("description")
      .populate("lastMessage");

    if (!group) return response(res, 404, "Group not found");

    // if (!group.members.includes(userId)) {
    //   return response(res, 403, "Not authorized to view this group");
    // }

    const isMember = group.members.some(
      (m) => m._id.toString() === userId.toString()
    );

    if (!isMember) {
      return response(res, 403, "Not authorized to view this group");
    }

    // await redisClient.setEx(redisKey, 60, JSON.stringify(group));

    // return response(res, 200, "Group details fetched", group);

    console.log(group.name, group.profilePicture);

    return response(res, 200, "Group details fetched", {
      name: group.name,
      profilePicture: group.profilePicture,
      description: group.description,
      admin: {
        username: group.admin?.username || null,
        profilePicture: group.admin?.profilePicture || null,
      },
      members: group.members.map((m) => ({
        username: m.username,
        profilePicture: m.profilePicture,
      })),
      lastMessage: group.lastMessage
        ? {
            content: group.lastMessage.content,
            sender: {
              username: group.lastMessage.sender?.username || null,
              profilePicture: group.lastMessage.sender?.profilePicture || null,
            },
            createdAt: group.lastMessage.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to fetch group details");
  }
};

const deleteGroupMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  try {
    const message = await GroupMessage.findById(messageId);
    if (!message) return response(res, 404, "Message not found");

    const group = await Group.findById(message.group);
    if (!group) return response(res, 404, "Group not found");

    if (
      message.sender.toString() !== userId &&
      group.admin.toString() !== userId
    ) {
      return response(res, 403, "Not authorized to delete this message");
    }

    await message.deleteOne();

    req.io.to(group._id.toString()).emit("group_message_deleted", messageId);

    // await redisClient.del(`group:messages:${group._id.toString()}`);

    // const redisKey = `group:messages:${group._id.toString()}`;
    // const cachedMessages = await redisClient.get(redisKey);

    // if (cachedMessages) {
    //   const messages = JSON.parse(cachedMessages);
    //   const updated = messages.filter(msg => msg._id !== messageId);
    //   await redisClient.set(redisKey, JSON.stringify(updated));
    // }

    return response(res, 200, "Message deleted successfully");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to delete message");
  }
};

const deleteGroup = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.userId;

  try {
    const group = await Group.findById(groupId);
    if (!group) return response(res, 404, "Group not found");

    if (group.admin.toString() !== userId) {
      return response(res, 403, "Only admin can delete group");
    }

    await GroupMessage.deleteMany({ group: groupId });
    await group.deleteOne();

    req.io.to(groupId).emit("group_deleted", { groupId });

    // await redisClient.del(`group:messages:${groupId}`);
    // await redisClient.del(`group:info:${groupId}`);
    // await redisClient.del(`admin:groups:${userId}`);
    // group.members.forEach(async memberId => {
    //   await redisClient.del(`user:groups:${memberId.toString()}`);
    // });

    return response(res, 200, "Group deleted successfully");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Failed to delete group");
  }
};

export default {
  createGroup,
  sendGroupMessage,
  getGroupMessages,
  getUserGroups,
  addMemberToGroup,
  updateGroupDetails,
  markGroupMessagesAsRead,
  deleteGroupMessage,
  getAdminGroups,
  getGroupInfo,
  deleteGroup,
};
