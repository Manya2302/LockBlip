import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
  },
  receiver: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'ignored', 'blocked'],
    default: 'pending',
  },
  isFriend: {
    type: Boolean,
    default: false,
  },
  messagePermission: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

connectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });

connectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Connection', connectionSchema);
