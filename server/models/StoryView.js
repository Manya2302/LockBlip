import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const storyViewSchema = new mongoose.Schema({
  storyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story',
    required: true,
  },
  viewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  viewerUsername: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

storyViewSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
storyViewSchema.index({ storyId: 1, viewedAt: -1 });

export default mongoose.model('StoryView', storyViewSchema);
