import mongoose from 'mongoose';

const storyHiddenViewerSchema = new mongoose.Schema({
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

storyHiddenViewerSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
storyHiddenViewerSchema.index({ storyId: 1 });
storyHiddenViewerSchema.index({ viewerId: 1 });

export default mongoose.model('StoryHiddenViewer', storyHiddenViewerSchema);
