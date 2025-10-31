import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const storySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  content: {
    type: String,
    required: true,
  },
  mediaType: {
    type: String,
    enum: ['text', 'image'],
    default: 'text',
  },
  backgroundColor: {
    type: String,
    default: '#1a1a1a',
  },
  image: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Story', storySchema);
