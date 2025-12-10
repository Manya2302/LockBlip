import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import LiveLocation from '../models/LiveLocation.js';
import { decryptField } from '../lib/encryption.js';

const router = express.Router();

const EXPIRY_PRESETS = {
  '15min': 15 * 60 * 1000,
  '1hour': 60 * 60 * 1000,
  '8hours': 8 * 60 * 60 * 1000,
};

const DEFAULT_UPDATE_INTERVAL = 10000;
const DEFAULT_STATIONARY_THRESHOLD = 5 * 60 * 1000;

function getChatRoomId(user1, user2) {
  return [user1, user2].sort().join('_');
}

router.post('/start', authenticateToken, async (req, res) => {
  try {
    console.log('📍 Live Location Start Request received');
    console.log('📍 User from auth:', req.user?.username, 'ID:', req.user?.id?.toString());
    
    const { 
      targetUsername, 
      expiryPreset, 
      customDuration, 
      emergencyContacts = [],
      stationaryThreshold = DEFAULT_STATIONARY_THRESHOLD,
      initialLocation,
    } = req.body;

    console.log('📍 Request body:', { targetUsername, expiryPreset, customDuration, hasInitialLocation: !!initialLocation });

    const currentUser = req.user.username;
    const userId = req.user.id?.toString();
    
    if (!targetUsername) {
      return res.status(400).json({ error: 'Target username is required' });
    }

    const activeSessions = await LiveLocation.find({ status: 'active' });
    
    let existingSessionId = null;
    for (const session of activeSessions) {
      try {
        const decryptedUserId = decryptField(session.userId);
        console.log('📍 Comparing session userId:', decryptedUserId, 'with current:', userId);
        if (decryptedUserId === userId || decryptedUserId?.toString() === userId) {
          existingSessionId = session.sessionId;
          break;
        }
      } catch (e) {
        console.warn('Failed to decrypt userId for existing session check:', e.message);
      }
    }
    
    if (existingSessionId) {
      return res.status(400).json({ 
        error: 'You already have an active location sharing session',
        existingSessionId,
      });
    }

    let expiryDuration;
    if (expiryPreset && EXPIRY_PRESETS[expiryPreset]) {
      expiryDuration = EXPIRY_PRESETS[expiryPreset];
    } else if (customDuration && customDuration > 0) {
      expiryDuration = Math.min(customDuration, 24 * 60 * 60 * 1000);
    } else {
      expiryDuration = EXPIRY_PRESETS['15min'];
    }

    const sessionId = uuidv4();
    const chatRoomId = getChatRoomId(currentUser, targetUsername);
    const expiryAt = new Date(Date.now() + expiryDuration);

    const liveLocation = await LiveLocation.create({
      sessionId,
      userId,
      username: currentUser,
      chatRoomId,
      viewers: [targetUsername],
      expiryAt,
      expiryDuration,
      emergencyContacts,
      stationaryThreshold,
      liveCoordinates: initialLocation ? [{
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        accuracy: initialLocation.accuracy || null,
        altitude: initialLocation.altitude || null,
        timestamp: new Date(),
      }] : [],
    });

    res.json({
      success: true,
      session: {
        sessionId: liveLocation.sessionId,
        expiryAt: liveLocation.expiryAt,
        expiryDuration,
        chatRoomId,
        updateInterval: DEFAULT_UPDATE_INTERVAL,
      },
    });
  } catch (error) {
    console.error('Start live location error:', error);
    res.status(500).json({ error: 'Failed to start live location sharing' });
  }
});

router.post('/update/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { latitude, longitude, accuracy, altitude } = req.body;
    const userId = req.user.id;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const session = await LiveLocation.findOne({ sessionId, status: 'active' });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    try {
      const decryptedUserId = decryptField(session.userId);
      if (decryptedUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this session' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Authorization check failed' });
    }

    if (new Date() > session.expiryAt) {
      await session.stopSharing('expired');
      return res.status(410).json({ error: 'Session has expired' });
    }

    await session.addCoordinate(latitude, longitude, accuracy, altitude);

    const stationaryStatus = session.checkStationaryStatus();

    res.json({
      success: true,
      movementSpeed: session.movementSpeed,
      stationaryStatus,
      coordinateCount: session.liveCoordinates.length,
    });
  } catch (error) {
    console.error('Update live location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.post('/stop/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await LiveLocation.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    try {
      const decryptedUserId = decryptField(session.userId);
      if (decryptedUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized to stop this session' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Authorization check failed' });
    }

    await session.stopSharing('manual');

    res.json({
      success: true,
      message: 'Location sharing stopped',
    });
  } catch (error) {
    console.error('Stop live location error:', error);
    res.status(500).json({ error: 'Failed to stop location sharing' });
  }
});

router.get('/view/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const currentUser = req.user.username;

    const session = await LiveLocation.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(410).json({ 
        error: 'Location sharing has ended',
        reason: session.stoppedReason || 'expired',
      });
    }

    let isViewer = false;
    try {
      for (const viewer of session.viewers) {
        const decryptedViewer = decryptField(viewer);
        if (decryptedViewer === currentUser) {
          isViewer = true;
          break;
        }
      }
    } catch (e) {
      console.warn('Failed to check viewer authorization');
    }

    if (!isViewer) {
      return res.status(403).json({ error: 'Not authorized to view this location' });
    }

    const currentLocation = session.getCurrentLocation();
    const routeHistory = session.getRouteHistory();

    res.json({
      sessionId: session.sessionId,
      sharer: session.toObject({ getters: true }).username,
      currentLocation: currentLocation ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: currentLocation.accuracy,
        timestamp: currentLocation.timestamp,
      } : null,
      routeHistory,
      movementSpeed: session.movementSpeed,
      startedAt: session.startedAt,
      expiryAt: session.expiryAt,
      lastUpdate: session.lastUpdate,
    });
  } catch (error) {
    console.error('View live location error:', error);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentUser = req.user.username;

    const activeSessions = await LiveLocation.find({ status: 'active' });

    const mySessions = [];
    const viewableSessions = [];

    for (const session of activeSessions) {
      try {
        const decryptedUserId = decryptField(session.userId);
        if (decryptedUserId === userId) {
          mySessions.push({
            sessionId: session.sessionId,
            chatRoomId: session.chatRoomId,
            expiryAt: session.expiryAt,
            startedAt: session.startedAt,
            coordinateCount: session.liveCoordinates.length,
          });
          continue;
        }

        for (const viewer of session.viewers) {
          const decryptedViewer = decryptField(viewer);
          if (decryptedViewer === currentUser) {
            viewableSessions.push({
              sessionId: session.sessionId,
              sharer: session.toObject({ getters: true }).username,
              chatRoomId: session.chatRoomId,
              expiryAt: session.expiryAt,
              startedAt: session.startedAt,
            });
            break;
          }
        }
      } catch (e) {
        console.warn('Failed to process session:', e);
      }
    }

    res.json({
      mySessions,
      viewableSessions,
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ error: 'Failed to get active sessions' });
  }
});

router.post('/alert/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await LiveLocation.findOne({ sessionId, status: 'active' });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    try {
      const decryptedUserId = decryptField(session.userId);
      if (decryptedUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    } catch (e) {
      return res.status(403).json({ error: 'Authorization check failed' });
    }

    session.status = 'alert';
    session.stationaryAlertSent = true;
    await session.save();

    res.json({
      success: true,
      message: 'Alert sent to emergency contacts',
      emergencyContacts: session.toObject({ getters: true }).emergencyContacts,
    });
  } catch (error) {
    console.error('Send alert error:', error);
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

router.get('/presets', (req, res) => {
  res.json({
    presets: [
      { key: '15min', label: '15 minutes', duration: EXPIRY_PRESETS['15min'] },
      { key: '1hour', label: '1 hour', duration: EXPIRY_PRESETS['1hour'] },
      { key: '8hours', label: '8 hours', duration: EXPIRY_PRESETS['8hours'] },
    ],
    maxCustomDuration: 24 * 60 * 60 * 1000,
    updateInterval: DEFAULT_UPDATE_INTERVAL,
    stationaryThreshold: DEFAULT_STATIONARY_THRESHOLD,
  });
});

export default router;
