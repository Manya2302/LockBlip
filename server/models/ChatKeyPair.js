import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const chatKeyPairSchema = new mongoose.Schema({
  chatRoomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  publicKey: {
    type: String,
    required: true,
    get: decryptField,
    set: encryptField,
  },
  privateKey: {
    type: String,
    required: true,
    get: decryptField,
    set: encryptField,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
  timestamps: true,
});

const ChatKeyPair = mongoose.model('ChatKeyPair', chatKeyPairSchema);

export default ChatKeyPair;
