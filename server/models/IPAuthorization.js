import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const ipAuthSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  ip: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  userAgent: String,
  authorized: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

export default mongoose.model('IPAuthorization', ipAuthSchema);
