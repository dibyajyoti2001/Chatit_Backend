// import CallHistory from "../models/CallHistory.js";
// import response from "../utils/responseHandler.js";
// import redisClient from "../config/redis.js";

// // Save Call History after call ends
// export const saveCallHistory = async (req, res) => {
//   try {
//     const {
//       caller,
//       receiver,
//       callType,
//       callStatus,
//       duration,
//       startedAt,
//       endedAt,
//     } = req.body;

//     // 1. storing in mongodb
//     const callHistory = await CallHistory.create({
//       caller,
//       receiver,
//       callType,
//       callStatus,
//       duration,
//       startedAt,
//       endedAt,
//     });

//     // 2. Push new history to Redis for both users
//     const redisKeyCaller = `callHistory:${caller}`;
//     const redisKeyReceiver = `callHistory:${receiver}`;

//     // Optional: maintain recent N items (e.g., last 50)
//     await redisClient.lPush(redisKeyCaller, newEntry);
//     await redisClient.lTrim(redisKeyCaller, 0, 19); // Keep only 50 latest

//     await redisClient.lPush(redisKeyReceiver, newEntry);
//     await redisClient.lTrim(redisKeyReceiver, 0, 19);

//     return response(res, 201, "Call history saved and cached", callHistory);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Failed to save call history");
//   }
// };

// // Fetch user's call history
// export const getUserCallHistory = async (req, res) => {
//   const userId = req.user.userId;
//   const redisKey = `callHistory:${userId}`;

//   try {
//     // Try to get recent N from Redis
//     const cachedList = await redisClient.lRange(redisKey, 0, 19);

//     if (cachedList?.length > 0) {
//       const parsed = cachedList.map((item) => JSON.parse(item));
//       return response(res, 200, "Call history fetched from cache", parsed);
//     }

//     // Fallback to DB if no cache
//     const history = await CallHistory.find({
//       $or: [{ caller: userId }, { receiver: userId }],
//     })
//       .populate("caller", "username profilePicture")
//       .populate("receiver", "username profilePicture")
//       .sort({ createdAt: -1 });

//     return response(res, 200, "Call history fetched", history);
//   } catch (error) {
//     console.error(error);
//     return response(res, 500, "Failed to fetch call history");
//   }
// };

import CallHistory from "../models/CallHistory.js";
import response from "../utils/responseHandler.js";
import redisClient from "../config/redis.js";

// Save Call History after call ends
export const saveCallHistory = async (req, res) => {
  try {
    const {
      caller,
      receiver,
      callType,
      callStatus,
      duration,
      startedAt,
      endedAt,
    } = req.body;

    // 1. Store in MongoDB
    const callHistory = await CallHistory.create({
      caller,
      receiver,
      callType,
      callStatus,
      duration,
      startedAt,
      endedAt,
    });

    // 2. Prepare Redis entry
    const newEntry = JSON.stringify({
      _id: callHistory._id,
      caller,
      receiver,
      callType,
      callStatus,
      duration,
      startedAt,
      endedAt,
    });

    // 3. Redis: Cache last 20 histories per user
    const redisKeyCaller = `callHistory:${caller}`;
    const redisKeyReceiver = `callHistory:${receiver}`;

    await redisClient.lPush(redisKeyCaller, newEntry);
    await redisClient.lTrim(redisKeyCaller, 0, 19); // Keep latest 20

    await redisClient.lPush(redisKeyReceiver, newEntry);
    await redisClient.lTrim(redisKeyReceiver, 0, 19);

    return response(res, 201, "Call history saved and cached", callHistory);
  } catch (error) {
    console.error("Save Call History Error:", error);
    return response(res, 500, "Failed to save call history");
  }
};

// Fetch user's call history
export const getUserCallHistory = async (req, res) => {
  const userId = req.user.userId;
  const redisKey = `callHistory:${userId}`;

  try {
    // 1. Try to fetch from Redis
    const cachedList = await redisClient.lRange(redisKey, 0, 19);

    if (cachedList && cachedList.length > 0) {
      const parsed = cachedList
        .map((item) => {
          try {
            return JSON.parse(item);
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean);

      return response(res, 200, "Call history fetched from cache", parsed);
    }

    // 2. Fallback to DB
    const history = await CallHistory.find({
      $or: [{ caller: userId }, { receiver: userId }],
    })
      .populate("caller", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort({ createdAt: -1 })
      .limit(20);

    return response(res, 200, "Call history fetched", history);
  } catch (error) {
    console.error("Fetch Call History Error:", error);
    return response(res, 500, "Failed to fetch call history");
  }
};
