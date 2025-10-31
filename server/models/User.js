import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { encryptField, decryptField } from '../lib/encryption.js';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    set: encryptField,
    get: decryptField,
  },
  email: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  phone: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  fullName: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  dateOfBirth: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  password: {
    type: String,
    required: true,
  },
  publicKey: {
    type: String,
    required: true,
  },
  privateKey: {
    type: String,
    required: true,
    set: encryptField,
    get: decryptField,
  },
  authorizedIPs: [{
    ip: String,
    authorizedAt: Date,
    userAgent: String,
  }],
  description: {
    type: String,
    default: '',
  },
  profileImage: {
    type: String,
    default: '',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
