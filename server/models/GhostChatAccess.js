import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ghostChatAccessSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  
  userId: {
    type: String,
    required: true,
    index: true,
  },
  
  partnerId: {
    type: String,
    required: true,
    index: true,
  },
  
  pinHash: {
    type: String,
    required: true,
  },
  
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet'],
    required: true,
  },
  
  isActive: {
    type: Boolean,
    default: true,
  },
  
  accessGranted: {
    type: Boolean,
    default: false,
  },
  
  accessGrantedAt: {
    type: Date,
    default: null,
  },
  
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  expireAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
});

ghostChatAccessSchema.index({ userId: 1, partnerId: 1, sessionId: 1 });
ghostChatAccessSchema.index({ sessionId: 1, isActive: 1 });

ghostChatAccessSchema.statics.hashPin = async function(pin) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(pin, salt);
};

ghostChatAccessSchema.statics.verifyPin = async function(pin, hash) {
  return bcrypt.compare(pin, hash);
};

ghostChatAccessSchema.statics.generatePin = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const GhostChatAccess = mongoose.model('GhostChatAccess', ghostChatAccessSchema);

export default GhostChatAccess;
