import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import GhostUser from '../models/GhostUser.js';
import GhostChatSession, { generateSessionKey, encryptWithSessionKey, decryptWithSessionKey } from '../models/GhostChat.js';
import GhostMessage from '../models/GhostMessage.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const GHOST_SESSION_DURATION = 30 * 60 * 1000;
const DEFAULT_MESSAGE_EXPIRY = 24 * 60 * 60 * 1000;

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

export default router;
