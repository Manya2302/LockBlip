import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const blockSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: String,
    required: true,
  },
  from: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  to: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  payload: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  prevHash: {
    type: String,
    required: true,
  },
  hash: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

blockSchema.index({ from: 1, to: 1 });
blockSchema.index({ index: 1 });

export default mongoose.model('Block', blockSchema);
