import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
// import sendOtpToEmail from "../services/emailService.js";
import twilioService from "../services/twilioService.js";
import generateToken from "../utils/generateToken.js";
import otpGenerate from "../utils/otpGenerator.js";
import response from "../utils/responseHandler.js";
import cloudinaryConfig from "../config/cloudinaryConfig.js";

// Send OTP
const sendOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix } = req.body;
  // const { phoneNumber, phoneSuffix, email } = req.body;
  const otp = await otpGenerate();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);
  let user;
  try {
    // if (email) {
    //   user = await User.findOne({email});

    //   if (!user) {
    //     user = new User({email})
    //   }
    //   user.emailOtp = otp;
    //   user.emailOtpExpiry = expiry;
    //   await user.save();
    //   await sendOtpToEmail(email, otp);
    //   return response(res, 200, 'Otp sent to your email', {email});
    // }

    if (!phoneNumber || !phoneSuffix) {
      return response(res, 400, "Phone number and phone suffix are required");
    }

    const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
    user = await User.findOne({ phoneNumber });
    if (!user) {
      user = await new User({ phoneNumber, phoneSuffix });
    }

    await twilioService.sendOtpToPhoneNumber(fullPhoneNumber, otp);
    await user.save();

    return response(res, 200, "Otp sent successfully!", user);
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, otp } = req.body;
  // const { phoneNumber, phoneSuffix, email, otp } = req.body;

  try {
    let user;
    // if (email) {
    //   user = await User.findOne({email});
    //   if (!user) {
    //     return response(res, 400, 'User Not Found');
    //   }

    //   const now = new Date();
    //   if (!user.emailOtp || String(user.emailOtp) !== String(otp) || now > new Date(user.emailOtpExpiry)){
    //     return response(res, 400, 'Invalid or expired otp')
    //   };
    //   user.isVerified = true;
    //   user.emailOtp = null;
    //   user.emailOtpExpiry = null;
    //   await user.save();
    // }
    // else {
    if (!phoneNumber || !phoneSuffix) {
      return response(res, 400, "Phone number and phone suffix are required");
    }
    const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
    user = await User.findOne({ phoneNumber });
    if (!user) {
      return response(res, 400, "User Not Found");
    }
    const result = await twilioService.verifyOtp(fullPhoneNumber, otp);
    if (result.status !== "approved") {
      return response(res, 400, "Invalid Otp");
    }
    user.isVerified = true;
    await user.save();
    // }

    const token = generateToken(user?._id);
    res.cookie("auth_token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    return response(res, 200, "Otp verified successfully", { token, user });
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

// Create Profile
// const createProfile = async (req, res) => {
//   const { username, about, agreed } = req.body;
//   const userId = req.user.userId;

//   console.log("User ID:", userId);
//   console.log("Request Body:", req.body);
//   console.log("File Info:", req.file);

//   try {
//     const user = await User.findById(userId);
//     if (!user) {
//       return response(res, 404, "User not found");
//     }

//     const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
//     if (file) {
//       const uploadResult = await cloudinaryConfig.uploadFileToCloudinary(file);
//       user.profilePicture = uploadResult?.secure_url;
//     } else if (req.body.profilePicture) {
//       user.profilePicture = req.body.profilePicture;
//     }

//     if (username) user.username = username;
//     if (agreed) user.agreed = agreed;
//     if (about) user.about = about;

//     await user.save();
//     return response(res, 200, "Profile created successfully!", user);
//   } catch (error) {
//     console.error("Create Profile Error:", error.message, error.stack);
//     return response(res, 500, "Internal server error");
//   }
// };

const createProfile = async (req, res) => {
  try {
    console.log("req.files:", req.files);
    console.log("req.body:", req.body);

    const { username, about, agreed } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) return response(res, 404, "User not found");

    const file = req.files?.profilePicture?.[0] || req.files?.image?.[0];
    if (file) {
      const uploadResult = await cloudinaryConfig.uploadFileToCloudinary(file);
      user.profilePicture = uploadResult?.secure_url;
    } else if (req.body.profilePicture) {
      user.profilePicture = req.body.profilePicture;
    }

    if (username) user.username = username;
    if (agreed !== undefined) user.agreed = agreed;
    if (about) user.about = about;

    await user.save();
    return response(res, 200, "Profile created successfully!", user);
  } catch (error) {
    console.error("Create Profile Error:", error);
    return response(res, 500, error.message || "Internal server error");
  }
};

// Updating User profile
const updateProfile = async (req, res) => {
  const { username, agreed, about } = req.body;
  const userId = req.user.userId;

  try {
    const user = await User.findById({ _id: userId });
    if (!user) {
      return response(res, 404, "User not found");
    }

    const file = req.files?.image?.[0] || req.files?.profilePicture?.[0];
    if (file) {
      const uploadResult = await cloudinaryConfig.uploadFileToCloudinary(file);
      console.log(uploadResult);
      user.profilePicture = uploadResult?.secure_url;
    } else if (req.body.profilePicture) {
      user.profilePicture = req.body.profilePicture;
    }

    if (username) {
      user.username = username;
    }
    if (agreed) {
      user.agreed = agreed;
    }
    if (about) {
      user.about = about;
    }

    await user.save();

    return response(res, 200, "User profile updated successfully!", user);
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

const checkAuthenticate = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return response(
        res,
        400,
        "Unauthorized! Please login before accessing our app."
      );
    }

    const user = await User.findById({ _id: userId });

    if (!user) {
      return response(res, 404, "User Not Found!");
    }
    return response(
      res,
      200,
      "User retrieved and allowed to use ChatIt.",
      user
    );
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

const logout = (req, res) => {
  try {
    res.cookie("auth_token", "", { expires: new Date(0) });
    return response(res, 200, "User logout successfully!");
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

const getAllUsers = async (req, res) => {
  const loggedInUser = req.user.userId;
  try {
    const users = await User.find({ _id: { $ne: loggedInUser } })
      .select(
        "username profilePicture lastSeen isOnline about phoneNumber phoneSuffix"
      )
      .lean();

    // const usersWithConversation = await Promise.all(
    //   users.map(async (user) => {
    //     const conversation = await Conversation.findOne({
    //       participants: { $all: [loggedInUser, user?._id] },
    //     })
    //       .populate({
    //         path: "lastMessage",
    //         select: "content createdAt sender receiver",
    //       })
    //       .lean();

    //     return {
    //       ...user,
    //       conversation: conversation | null,
    //     };
    //   })
    // );

    const usersWithConversation = await Promise.all(
      users.map(async (user) => {
        const conversation = await Conversation.findOne({
          participants: { $all: [loggedInUser, user?._id] },
        })
          .populate({
            path: "lastMessage",
            select: "content createdAt sender receiver",
          })
          .lean();

        return {
          ...user,
          avatar: user.profilePicture, // 👈 add this
          conversation: conversation || null,
        };
      })
    );

    return response(
      res,
      200,
      "users retrieved successfully",
      usersWithConversation
    );
  } catch (error) {
    console.log(error);
    return response(res, 500, "Internal server error");
  }
};

const getUser = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return response(
        res,
        401,
        "Unauthorized. Please login to access this route."
      );
    }

    const user = await User.findById(userId)
      .select(
        "username profilePicture phoneNumber phoneSuffix about isOnline lastSeen"
      )
      .lean();

    if (!user) {
      return response(res, 404, "User not found");
    }

    return response(res, 200, "User retrieved successfully", user);
  } catch (error) {
    console.error("Get User Error:", error);
    return response(res, 500, "Internal server error");
  }
};

export default {
  sendOtp,
  verifyOtp,
  createProfile,
  updateProfile,
  logout,
  checkAuthenticate,
  getAllUsers,
  getUser,
};
