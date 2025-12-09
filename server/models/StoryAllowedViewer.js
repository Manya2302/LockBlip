import mongoose from 'mongoose';

const storyAllowedViewerSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

storyAllowedViewerSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
storyAllowedViewerSchema.index({ storyId: 1 });
storyAllowedViewerSchema.index({ viewerId: 1 });

export default mongoose.model('StoryAllowedViewer', storyAllowedViewerSchema);
