import mongoose from "mongoose";

const statusSchema = new mongoose.Schema({
  user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
  content: {type: String, required: true},
  contentType: {type: String, enum: ['image', 'video', 'text'], default: true},
  viewers: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
  expiresAt: {type: Date, required: true},
}, {timestamps: true});

const Status = mongoose.model('Status', statusSchema);
export default Status;