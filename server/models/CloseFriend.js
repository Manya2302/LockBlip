import mongoose from 'mongoose';

const closeFriendSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

closeFriendSchema.index({ userId: 1, friendId: 1 }, { unique: true });
closeFriendSchema.index({ userId: 1 });
closeFriendSchema.index({ friendId: 1 });

export default mongoose.model('CloseFriend', closeFriendSchema);
