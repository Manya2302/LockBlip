import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

export default mongoose.model('OTP', otpSchema);
