import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import GhostUser from '../models/GhostUser.js';
import GhostChatSession, { generateSessionKey, encryptWithSessionKey, decryptWithSessionKey } from '../models/GhostChat.js';
import GhostMessage from '../models/GhostMessage.js';
import GhostChatAccess from '../models/GhostChatAccess.js';
import GhostAccessLog from '../models/GhostAccessLog.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const GHOST_SESSION_DURATION = 30 * 60 * 1000;
const DEFAULT_MESSAGE_EXPIRY = 24 * 60 * 60 * 1000;
const GHOST_ACCESS_EXPIRY = 60 * 60 * 1000;

async function logGhostAccess(sessionId, userId, eventType, deviceType, metadata = {}, req = null) {
  try {
    await GhostAccessLog.create({
      sessionId,
      userId,
      eventType,
      deviceType,
      ipAddress: req?.ip || null,
      userAgent: req?.get('user-agent') || null,
      metadata,
    });
  } catch (error) {
    console.error('Ghost access log error:', error);
  }
}

router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const username = req.user.username;
    
    if (!pin || pin.length < 4 || pin.length > 8) {
      return res.status(400).json({ error: 'PIN must be 4-8 digits' });
    }
    
    const existing = await GhostUser.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: 'Ghost mode already set up' });
    }
    
    const hashedPin = GhostUser.hashPin(pin);
    
    await GhostUser.create({
      username,
      ghostPin: hashedPin,
    });
    
    res.json({ success: true, message: 'Ghost mode set up successfully' });
  } catch (error) {
    console.error('Ghost setup error:', error);
    res.status(500).json({ error: 'Failed to set up ghost mode' });
  }
});

router.post('/authenticate', authenticateToken, async (req, res) => {
  try {
    const { pin, biometricToken } = req.body;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser) {
      return res.status(404).json({ error: 'Ghost mode not set up' });
    }
    
    let authenticated = false;
    
    if (pin) {
      authenticated = ghostUser.validatePin(pin);
    } else if (biometricToken && ghostUser.biometricEnabled) {
      authenticated = ghostUser.biometricToken === biometricToken;
    }
    
    if (!authenticated) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + GHOST_SESSION_DURATION);
    
    await GhostUser.findByIdAndUpdate(ghostUser._id, {
      ghostSessionToken: sessionToken,
      sessionExpiresAt,
      lastGhostAccess: new Date(),
    });
    
    res.json({
      success: true,
      sessionToken,
      expiresAt: sessionExpiresAt,
      autoLockTimeout: ghostUser.autoLockTimeout,
    });
  } catch (error) {
    console.error('Ghost authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/verify-session', authenticateToken, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser) {
      return res.status(404).json({ valid: false });
    }
    
    const isValid = ghostUser.ghostSessionToken === sessionToken &&
                    ghostUser.sessionExpiresAt > new Date();
    
    if (isValid) {
      await GhostUser.findByIdAndUpdate(ghostUser._id, {
        lastGhostAccess: new Date(),
      });
    }
    
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Ghost session verify error:', error);
    res.status(500).json({ valid: false });
  }
});

router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    if (ghostUser.sessionExpiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    const newExpiry = new Date(Date.now() + GHOST_SESSION_DURATION);
    await GhostUser.findByIdAndUpdate(ghostUser._id, {
      sessionExpiresAt: newExpiry,
      lastGhostAccess: new Date(),
    });
    
    res.json({ success: true, expiresAt: newExpiry });
  } catch (error) {
    console.error('Ghost heartbeat error:', error);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    
    await GhostUser.findOneAndUpdate(
      { username },
      { ghostSessionToken: null, sessionExpiresAt: null }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ghost logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    
    res.json({
      isSetUp: !!ghostUser,
      biometricEnabled: ghostUser?.biometricEnabled || false,
      autoLockTimeout: ghostUser?.autoLockTimeout || 30,
    });
  } catch (error) {
    console.error('Ghost status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

router.post('/sessions', authenticateToken, async (req, res) => {
  try {
    const { sessionToken, participantUsername } = req.body;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const sessionId = crypto.randomBytes(16).toString('hex');
    const sessionKey = generateSessionKey();
    const expireAt = new Date(Date.now() + DEFAULT_MESSAGE_EXPIRY);
    
    const participants = [username, participantUsername].sort();
    
    const existingSession = await GhostChatSession.findOne({
      participants: { $all: participants },
      isActive: true,
    });
    
    if (existingSession) {
      return res.json({
        success: true,
        session: {
          sessionId: existingSession.sessionId,
          participants: existingSession.participants,
          sessionKey: existingSession.sessionKey,
          expireAt: existingSession.expireAt,
        },
      });
    }
    
    await GhostChatSession.create({
      sessionId,
      participants,
      sessionKey,
      createdBy: username,
      expireAt,
    });
    
    res.json({
      success: true,
      session: {
        sessionId,
        participants,
        sessionKey,
        expireAt,
      },
    });
  } catch (error) {
    console.error('Ghost session create error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { sessionToken } = req.query;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const sessions = await GhostChatSession.find({
      participants: username,
      isActive: true,
    }).lean();
    
    res.json({ sessions });
  } catch (error) {
    console.error('Ghost sessions list error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionToken, sessionId, message, messageType = 'text', mediaUrl } = req.body;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const session = await GhostChatSession.findOne({ sessionId, isActive: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!session.participants.includes(username)) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    
    const receiverId = session.participants.find(p => p !== username);
    const encryptedPayload = encryptWithSessionKey(message, session.sessionKey);
    const encryptedMediaUrl = mediaUrl ? encryptWithSessionKey(mediaUrl, session.sessionKey) : null;
    
    const expireAt = new Date(Date.now() + DEFAULT_MESSAGE_EXPIRY);
    
    const ghostMessage = await GhostMessage.create({
      sessionId,
      senderId: username,
      receiverId,
      encryptedPayload,
      messageType,
      encryptedMediaUrl,
      autoDeleteTimer: 30,
      expireAt,
    });
    
    await GhostChatSession.findByIdAndUpdate(session._id, {
      lastActivity: new Date(),
    });
    
    res.json({
      success: true,
      message: {
        id: ghostMessage._id,
        sessionId,
        senderId: username,
        receiverId,
        messageType,
        timestamp: ghostMessage.timestamp,
        autoDeleteTimer: ghostMessage.autoDeleteTimer,
      },
    });
  } catch (error) {
    console.error('Ghost message send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/messages/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionToken } = req.query;
    const { sessionId } = req.params;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const session = await GhostChatSession.findOne({ sessionId, isActive: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!session.participants.includes(username)) {
      return res.status(403).json({ error: 'Not a participant' });
    }
    
    const messages = await GhostMessage.find({
      sessionId,
      isDeleted: false,
    }).sort({ timestamp: 1 }).lean();
    
    const decryptedMessages = messages.map(msg => ({
      id: msg._id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      content: decryptWithSessionKey(msg.encryptedPayload, session.sessionKey),
      messageType: msg.messageType,
      mediaUrl: msg.encryptedMediaUrl ? decryptWithSessionKey(msg.encryptedMediaUrl, session.sessionKey) : null,
      viewed: msg.viewed,
      viewTimestamp: msg.viewTimestamp,
      autoDeleteTimer: msg.autoDeleteTimer,
      deleteAt: msg.deleteAt,
      timestamp: msg.timestamp,
    }));
    
    res.json({ messages: decryptedMessages });
  } catch (error) {
    console.error('Ghost messages get error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.post('/messages/:messageId/view', authenticateToken, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const { messageId } = req.params;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const message = await GhostMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    if (message.receiverId !== username) {
      return res.status(403).json({ error: 'Not the recipient' });
    }
    
    if (message.viewed) {
      return res.json({
        success: true,
        viewTimestamp: message.viewTimestamp,
        deleteAt: message.deleteAt,
      });
    }
    
    const viewTimestamp = new Date();
    const deleteAt = new Date(viewTimestamp.getTime() + message.autoDeleteTimer * 1000);
    
    await GhostMessage.findByIdAndUpdate(messageId, {
      viewed: true,
      viewTimestamp,
      deleteAt,
    });
    
    res.json({
      success: true,
      viewTimestamp,
      deleteAt,
      autoDeleteTimer: message.autoDeleteTimer,
    });
  } catch (error) {
    console.error('Ghost message view error:', error);
    res.status(500).json({ error: 'Failed to mark message as viewed' });
  }
});

router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { sessionToken, autoLockTimeout, biometricEnabled, newPin } = req.body;
    const username = req.user.username;
    
    const ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const updates = {};
    if (autoLockTimeout !== undefined) updates.autoLockTimeout = autoLockTimeout;
    if (biometricEnabled !== undefined) updates.biometricEnabled = biometricEnabled;
    if (newPin) updates.ghostPin = GhostUser.hashPin(newPin);
    
    await GhostUser.findByIdAndUpdate(ghostUser._id, updates);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ghost settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.post('/activate', authenticateToken, async (req, res) => {
  try {
    const { partnerId, deviceType = 'desktop', disclaimerAgreed = false } = req.body;
    const username = req.user.username;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner ID required' });
    }
    
    if (!disclaimerAgreed) {
      return res.status(400).json({ error: 'You must agree to the disclaimer to activate Ghost Mode' });
    }
    
    let ghostUser = await GhostUser.findOne({ username });
    if (!ghostUser) {
      const defaultPin = GhostUser.hashPin(crypto.randomBytes(16).toString('hex'));
      ghostUser = await GhostUser.create({
        username,
        ghostPin: defaultPin,
        ghostEnabled: true,
      });
    }
    
    const pin = GhostChatAccess.generatePin();
    const pinHash = await GhostChatAccess.hashPin(pin);
    
    const sessionId = crypto.randomBytes(16).toString('hex');
    const sessionKey = generateSessionKey();
    const expireAt = new Date(Date.now() + DEFAULT_MESSAGE_EXPIRY);
    const accessExpireAt = new Date(Date.now() + GHOST_ACCESS_EXPIRY);
    
    const participants = [username, partnerId].sort();
    
    let existingSession = await GhostChatSession.findOne({
      participants: { $all: participants },
      isActive: true,
    });
    
    let finalSessionId = sessionId;
    let finalSessionKey = sessionKey;
    
    if (existingSession) {
      finalSessionId = existingSession.sessionId;
      finalSessionKey = existingSession.sessionKey;
      
      await GhostChatSession.findByIdAndUpdate(existingSession._id, {
        lastActivity: new Date(),
      });
    } else {
      await GhostChatSession.create({
        sessionId,
        participants,
        sessionKey,
        createdBy: username,
        expireAt,
      });
    }
    
    await GhostChatAccess.deleteMany({
      userId: username,
      partnerId: partnerId,
      isActive: true,
    });
    
    await GhostChatAccess.create({
      sessionId: finalSessionId,
      userId: username,
      partnerId: partnerId,
      pinHash,
      deviceType,
      expireAt: accessExpireAt,
      isActive: true,
      accessGranted: true,
      accessGrantedAt: new Date(),
    });
    
    await GhostChatAccess.create({
      sessionId: finalSessionId,
      userId: partnerId,
      partnerId: username,
      pinHash,
      deviceType: 'unknown',
      expireAt: accessExpireAt,
      isActive: true,
      accessGranted: false,
    });
    
    await logGhostAccess(finalSessionId, username, 'session_created', deviceType, { partnerId, disclaimerAgreed: true }, req);
    await logGhostAccess(finalSessionId, username, 'pin_generated', deviceType, { disclaimerAgreed: true }, req);
    
    res.json({
      success: true,
      sessionId: finalSessionId,
      pin,
      partnerId,
      expireAt: accessExpireAt,
      message: `Ghost Mode activated by ${username}`,
    });
  } catch (error) {
    console.error('Ghost activate error:', error);
    res.status(500).json({ error: 'Failed to activate Ghost Mode' });
  }
});

router.post('/join', authenticateToken, async (req, res) => {
  try {
    const { pin, deviceType = 'desktop' } = req.body;
    const username = req.user.username;
    
    if (!pin || pin.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit PIN required' });
    }
    
    const accessRecords = await GhostChatAccess.find({
      userId: username,
      isActive: true,
      accessGranted: false,
      expireAt: { $gt: new Date() },
    });
    
    let matchedAccess = null;
    for (const record of accessRecords) {
      const isValid = await GhostChatAccess.verifyPin(pin, record.pinHash);
      if (isValid) {
        matchedAccess = record;
        break;
      }
    }
    
    if (!matchedAccess) {
      await logGhostAccess('unknown', username, 'access_denied', deviceType, { reason: 'invalid_pin' }, req);
      return res.status(401).json({ error: 'Invalid PIN or expired invitation' });
    }
    
    const session = await GhostChatSession.findOne({
      sessionId: matchedAccess.sessionId,
      isActive: true,
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    await GhostChatAccess.findByIdAndUpdate(matchedAccess._id, {
      accessGranted: true,
      accessGrantedAt: new Date(),
      deviceType,
      lastActivity: new Date(),
    });
    
    await logGhostAccess(matchedAccess.sessionId, username, 'access_granted', deviceType, { partnerId: matchedAccess.partnerId }, req);
    await logGhostAccess(matchedAccess.sessionId, username, 'session_joined', deviceType, {}, req);
    
    res.json({
      success: true,
      sessionId: matchedAccess.sessionId,
      sessionKey: session.sessionKey,
      partnerId: matchedAccess.partnerId,
      participants: session.participants,
      expireAt: session.expireAt,
    });
  } catch (error) {
    console.error('Ghost join error:', error);
    res.status(500).json({ error: 'Failed to join Ghost Mode' });
  }
});

router.post('/validate-access', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const username = req.user.username;
    
    const access = await GhostChatAccess.findOne({
      sessionId,
      userId: username,
      isActive: true,
      accessGranted: true,
      expireAt: { $gt: new Date() },
    });
    
    if (!access) {
      return res.json({ valid: false, reason: 'no_access' });
    }
    
    const session = await GhostChatSession.findOne({
      sessionId,
      isActive: true,
    });
    
    if (!session) {
      return res.json({ valid: false, reason: 'session_expired' });
    }
    
    await GhostChatAccess.findByIdAndUpdate(access._id, {
      lastActivity: new Date(),
    });
    
    res.json({
      valid: true,
      sessionKey: session.sessionKey,
      partnerId: access.partnerId,
      participants: session.participants,
    });
  } catch (error) {
    console.error('Ghost validate access error:', error);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

router.post('/reauth', authenticateToken, async (req, res) => {
  try {
    const { sessionId, pin, deviceType = 'desktop' } = req.body;
    const username = req.user.username;
    
    const access = await GhostChatAccess.findOne({
      sessionId,
      userId: username,
      isActive: true,
    });
    
    if (!access) {
      return res.status(404).json({ error: 'No access record found' });
    }
    
    const isValid = await GhostChatAccess.verifyPin(pin, access.pinHash);
    
    if (!isValid) {
      await logGhostAccess(sessionId, username, 'reauth_failed', deviceType, {}, req);
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    
    const newExpiry = new Date(Date.now() + GHOST_ACCESS_EXPIRY);
    await GhostChatAccess.findByIdAndUpdate(access._id, {
      expireAt: newExpiry,
      lastActivity: new Date(),
    });
    
    await logGhostAccess(sessionId, username, 'reauth_success', deviceType, {}, req);
    
    res.json({ success: true, expireAt: newExpiry });
  } catch (error) {
    console.error('Ghost reauth error:', error);
    res.status(500).json({ error: 'Re-authentication failed' });
  }
});

router.post('/log-event', authenticateToken, async (req, res) => {
  try {
    const { sessionId, eventType, deviceType = 'desktop', metadata = {} } = req.body;
    const username = req.user.username;
    
    const validEvents = ['screenshot_attempt', 'blur_activated', 'idle_lock', 'reauth_required'];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }
    
    await logGhostAccess(sessionId, username, eventType, deviceType, metadata, req);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ghost log event error:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

router.get('/access-logs/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const username = req.user.username;
    
    const access = await GhostChatAccess.findOne({
      sessionId,
      userId: username,
      isActive: true,
    });
    
    if (!access) {
      return res.status(403).json({ error: 'No access to this session' });
    }
    
    const logs = await GhostAccessLog.find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    
    res.json({ logs });
  } catch (error) {
    console.error('Ghost access logs error:', error);
    res.status(500).json({ error: 'Failed to get access logs' });
  }
});

router.post('/terminate', authenticateToken, async (req, res) => {
  try {
    const { sessionId, deviceType = 'desktop' } = req.body;
    const username = req.user.username;
    
    const session = await GhostChatSession.findOne({
      sessionId,
      participants: username,
      isActive: true,
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    await GhostChatSession.findByIdAndUpdate(session._id, { isActive: false });
    await GhostChatAccess.updateMany({ sessionId }, { isActive: false });
    await GhostMessage.deleteMany({ sessionId });
    
    await logGhostAccess(sessionId, username, 'session_terminated', deviceType, {}, req);
    
    res.json({ success: true, message: 'Session terminated and all messages deleted' });
  } catch (error) {
    console.error('Ghost terminate error:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

export default router;
