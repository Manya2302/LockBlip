import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const chatSummarySchema = new mongoose.Schema({
  chatRoomId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
    get: decryptField,
    set: encryptField,
  },
  summary: {
    type: String,
    required: true,
    get: decryptField,
    set: encryptField,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  firstMessageId: {
    type: String,
    default: null,
  },
  lastMessageId: {
    type: String,
    default: null,
  },
  keywords: {
    type: [String],
    default: [],
  },
  isGroupChat: {
    type: Boolean,
    default: false,
  },
  participants: [{
    type: String,
    get: decryptField,
    set: encryptField,
  }],
  model: {
    type: String,
    default: 'gemini-1.5-flash',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

chatSummarySchema.index({ chatRoomId: 1, userId: 1, createdAt: -1 });

const ChatSummary = mongoose.model('ChatSummary', chatSummarySchema);

export default ChatSummary;
