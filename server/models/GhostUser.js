import mongoose from 'mongoose';
import CryptoJS from 'crypto-js';

function hashPin(pin) {
  return CryptoJS.SHA256(pin).toString();
}

const ghostUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  ghostPin: {
    type: String,
    required: true,
  },
  biometricEnabled: {
    type: Boolean,
    default: false,
  },
  biometricToken: {
    type: String,
    default: null,
  },
  lastGhostAccess: {
    type: Date,
    default: null,
  },
  ghostSessionToken: {
    type: String,
    default: null,
  },
  sessionExpiresAt: {
    type: Date,
    default: null,
  },
  autoLockTimeout: {
    type: Number,
    default: 30,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ghostUserSchema.methods.validatePin = function(pin) {
  return this.ghostPin === hashPin(pin);
};

ghostUserSchema.statics.hashPin = hashPin;

const GhostUser = mongoose.model('GhostUser', ghostUserSchema);

export default GhostUser;
