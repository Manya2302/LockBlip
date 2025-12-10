import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

function encryptJSON(value) {
  if (!value) return value;
  if (typeof value === 'object') {
    return encryptField(JSON.stringify(value));
  }
  return encryptField(value);
}

function decryptJSON(value) {
  if (!value) return value;
  try {
    const decrypted = decryptField(value);
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return value;
  }
}

const chatSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    get: decryptField,
    set: encryptField,
  },
  receiverId: {
    type: String,
    required: true,
    get: decryptField,
    set: encryptField,
  },
  encryptedMessage: {
    type: String,
    required: true,
  },
  chatRoomId: {
    type: String,
    required: true,
    index: true,
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'poll', 'live_location'],
    default: 'text',
  },
  liveLocationSessionId: {
    type: String,
    default: null,
    index: true,
  },
  liveLocationStatus: {
    type: String,
    enum: ['active', 'expired', 'stopped', null],
    default: null,
  },
  mediaUrl: {
    type: String,
    default: null,
    get: decryptField,
    set: encryptField,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    get: decryptJSON,
    set: encryptJSON,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent',
  },
  blockIndex: {
    type: Number,
    required: false,
  },
  hash: {
    type: String,
    required: false,
  },
  previousHash: {
    type: String,
    required: false,
  },
  chatPublicKey: {
    type: String,
    required: false,
    get: decryptField,
    set: encryptField,
  },
  chatPrivateKey: {
    type: String,
    required: false,
    get: decryptField,
    set: encryptField,
  },
  // Self-destruct fields
  selfDestruct: {
    type: Boolean,
    default: false,
  },
  autoDeleteTimer: {
    type: Number,
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
  playTimestamp: {
    type: Date,
    default: null,
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
  // list of usernames for which this message has been deleted (per-user delete)
  deletedFor: {
    type: [String],
    default: [],
    get: (arr) => {
      if (!arr) return [];
      try {
        return arr.map(a => decryptField(a));
      } catch (err) {
        console.warn('Failed to decrypt deletedFor array', err);
        return arr;
      }
    },
    set: (arr) => {
      if (!arr) return [];
      try {
        return arr.map(a => typeof a === 'string' ? encryptField(a) : a);
      } catch (err) {
        console.warn('Failed to encrypt deletedFor array', err);
        return arr;
      }
    }
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
  timestamps: true,
});

chatSchema.index({ chatRoomId: 1, timestamp: -1 });
chatSchema.index({ senderId: 1, receiverId: 1 });
chatSchema.index({ hash: 1 });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
