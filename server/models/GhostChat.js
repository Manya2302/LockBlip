import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';

function generateSessionKey() {
  return CryptoJS.lib.WordArray.random(32).toString();
}

function encryptWithSessionKey(value, sessionKey) {
  if (!value) return value;
  return CryptoJS.AES.encrypt(value, sessionKey).toString();
}

function decryptWithSessionKey(value, sessionKey) {
  if (!value) return value;
  try {
    const bytes = CryptoJS.AES.decrypt(value, sessionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Ghost decryption error:', error);
    return value;
  }
}

const ghostChatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  participants: [{
    type: String,
    required: true,
  }],
  sessionKey: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  ghostEnabled: {
    type: Boolean,
    default: true,
  },
  ghostTerminated: {
    type: Boolean,
    default: false,
  },
  terminatedAt: {
    type: Date,
    default: null,
  },
  terminatedBy: {
    type: String,
    default: null,
  },
  joinedUsers: [{
    type: String,
  }],
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  expireAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ghostChatSessionSchema.index({ participants: 1 });

const GhostChatSession = mongoose.model('GhostChatSession', ghostChatSessionSchema);

export { GhostChatSession, generateSessionKey, encryptWithSessionKey, decryptWithSessionKey };
export default GhostChatSession;
