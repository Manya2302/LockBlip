import mongoose from 'mongoose';
import { encryptField, decryptField } from '../lib/encryption.js';

const coordinateSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  accuracy: {
    type: Number,
    default: null,
  },
  altitude: {
    type: Number,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const liveLocationSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
    get: decryptField,
    set: encryptField,
  },
  username: {
    type: String,
    required: true,
    get: decryptField,
    set: encryptField,
  },
  chatRoomId: {
    type: String,
    required: true,
    index: true,
  },
  viewers: [{
    type: String,
    get: decryptField,
    set: encryptField,
  }],
  startedAt: {
    type: Date,
    default: Date.now,
  },
  expiryAt: {
    type: Date,
    required: true,
    index: true,
  },
  expiryDuration: {
    type: Number,
    required: true,
  },
  liveCoordinates: [coordinateSchema],
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
  movementSpeed: {
    type: Number,
    default: 0,
  },
  lastMovementTime: {
    type: Date,
    default: Date.now,
  },
  stationaryAlertSent: {
    type: Boolean,
    default: false,
  },
  stationaryThreshold: {
    type: Number,
    default: 300000,
  },
  emergencyContacts: [{
    type: String,
    get: decryptField,
    set: encryptField,
  }],
  status: {
    type: String,
    enum: ['active', 'expired', 'stopped', 'alert'],
    default: 'active',
    index: true,
  },
  stoppedAt: {
    type: Date,
    default: null,
  },
  stoppedReason: {
    type: String,
    enum: ['manual', 'expired', 'emergency', null],
    default: null,
  },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});

liveLocationSchema.methods.addCoordinate = async function(latitude, longitude, accuracy, altitude) {
  const now = new Date();
  
  if (this.liveCoordinates.length > 0) {
    const lastCoord = this.liveCoordinates[this.liveCoordinates.length - 1];
    const distance = calculateDistance(
      lastCoord.latitude, lastCoord.longitude,
      latitude, longitude
    );
    const timeDiff = (now.getTime() - new Date(lastCoord.timestamp).getTime()) / 1000;
    
    if (timeDiff > 0) {
      this.movementSpeed = distance / timeDiff;
      
      if (distance > 0.001) {
        this.lastMovementTime = now;
        this.stationaryAlertSent = false;
      }
    }
  }
  
  this.liveCoordinates.push({
    latitude,
    longitude,
    accuracy,
    altitude,
    timestamp: now,
  });
  
  this.lastUpdate = now;
  
  return this.save();
};

liveLocationSchema.methods.checkStationaryStatus = function() {
  const now = new Date();
  const timeSinceMovement = now.getTime() - new Date(this.lastMovementTime).getTime();
  
  if (timeSinceMovement >= this.stationaryThreshold && !this.stationaryAlertSent) {
    return {
      isStationary: true,
      duration: timeSinceMovement,
      shouldAlert: true,
    };
  }
  
  return {
    isStationary: timeSinceMovement >= this.stationaryThreshold,
    duration: timeSinceMovement,
    shouldAlert: false,
  };
};

liveLocationSchema.methods.stopSharing = async function(reason = 'manual') {
  this.status = 'stopped';
  this.stoppedAt = new Date();
  this.stoppedReason = reason;
  
  return this.save();
};

liveLocationSchema.methods.getCurrentLocation = function() {
  if (this.liveCoordinates.length === 0) return null;
  return this.liveCoordinates[this.liveCoordinates.length - 1];
};

liveLocationSchema.methods.getRouteHistory = function() {
  return this.liveCoordinates.map(coord => ({
    lat: coord.latitude,
    lng: coord.longitude,
    time: coord.timestamp,
  }));
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

const LiveLocation = mongoose.model('LiveLocation', liveLocationSchema);

export default LiveLocation;
