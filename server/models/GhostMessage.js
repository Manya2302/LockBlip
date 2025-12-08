import mongoose from 'mongoose';

const ghostMessageSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  encryptedPayload: {
    type: String,
    required: true,
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document'],
    default: 'text',
  },
  encryptedMediaUrl: {
    type: String,
    default: null,
  },
  viewed: {
    type: Boolean,
    default: false,
  },
  viewTimestamp: {
    type: Date,
    default: null,
  },
  autoDeleteTimer: {
    type: Number,
    default: 30,
  },
  deleteAt: {
    type: Date,
    default: null,
    index: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  expireAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
});

ghostMessageSchema.index({ sessionId: 1, timestamp: -1 });

const GhostMessage = mongoose.model('GhostMessage', ghostMessageSchema);

export default GhostMessage;
