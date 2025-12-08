import mongoose from 'mongoose';

const ghostAccessLogSchema = new mongoose.Schema({
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
  
  eventType: {
    type: String,
    enum: [
      'session_created',
      'pin_generated',
      'pin_shared',
      'access_requested',
      'access_granted',
      'access_denied',
      'session_joined',
      'session_left',
      'session_expired',
      'session_terminated',
      'screenshot_attempt',
      'blur_activated',
      'idle_lock',
      'reauth_required',
      'reauth_success',
      'reauth_failed',
    ],
    required: true,
  },
  
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet'],
    required: true,
  },
  
  ipAddress: {
    type: String,
    default: null,
  },
  
  userAgent: {
    type: String,
    default: null,
  },
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

ghostAccessLogSchema.index({ sessionId: 1, timestamp: -1 });
ghostAccessLogSchema.index({ userId: 1, timestamp: -1 });
ghostAccessLogSchema.index({ eventType: 1, timestamp: -1 });

const GhostAccessLog = mongoose.model('GhostAccessLog', ghostAccessLogSchema);

export default GhostAccessLog;
