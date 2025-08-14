import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const callHistorySchema = mongoose.Schema(
  {
    caller: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    callStatus: {
      type: String,
      enum: ["missed", "rejected", "ended", "unanswered"],
      required: true,
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const CallHistory =
  mongoose.models.CallHistory ||
  mongoose.model("CallHistory", callHistorySchema);

export default CallHistory;
