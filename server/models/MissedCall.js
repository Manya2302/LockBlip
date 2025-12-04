import mongoose from 'mongoose';

const missedCallSchema = new mongoose.Schema({
  callerId: {
    type: String,
    required: true,
    index: true,
  },
  receiverId: {
    type: String,
    required: true,
    index: true,
  },
  callType: {
    type: String,
    enum: ['voice', 'video'],
    required: true,
  },
  isSeen: {
    type: Boolean,
    default: false,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

missedCallSchema.index({ receiverId: 1, isSeen: 1 });
missedCallSchema.index({ receiverId: 1, callerId: 1, isSeen: 1 });

export default mongoose.model('MissedCall', missedCallSchema);
