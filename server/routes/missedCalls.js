import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import MissedCall from '../models/MissedCall.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    
    const missedCalls = await MissedCall.find({ receiverId: username })
      .sort({ timestamp: -1 })
      .lean();
    
    res.json({ missedCalls });
  } catch (error) {
    console.error('Error fetching missed calls:', error);
    res.status(500).json({ error: 'Failed to fetch missed calls' });
  }
});

router.get('/counts', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    
    const unseenCalls = await MissedCall.find({ 
      receiverId: username, 
      isSeen: false 
    }).lean();
    
    const perUser = {};
    let totalMissed = 0;
    
    for (const call of unseenCalls) {
      const callerId = call.callerId;
      if (!perUser[callerId]) {
        perUser[callerId] = { voice: 0, video: 0 };
      }
      if (call.callType === 'voice') {
        perUser[callerId].voice++;
      } else {
        perUser[callerId].video++;
      }
      totalMissed++;
    }
    
    res.json({ totalMissed, perUser });
  } catch (error) {
    console.error('Error fetching missed call counts:', error);
    res.status(500).json({ error: 'Failed to fetch missed call counts' });
  }
});

router.post('/mark-seen', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const { callerId } = req.body;
    
    if (!callerId) {
      return res.status(400).json({ error: 'callerId is required' });
    }
    
    const result = await MissedCall.updateMany(
      { receiverId: username, callerId, isSeen: false },
      { isSeen: true }
    );
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking missed calls as seen:', error);
    res.status(500).json({ error: 'Failed to mark missed calls as seen' });
  }
});

router.post('/mark-seen-by-type', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const { callerId, callType } = req.body;
    
    if (!callerId) {
      return res.status(400).json({ error: 'callerId is required' });
    }
    
    if (!callType || !['voice', 'video'].includes(callType)) {
      return res.status(400).json({ error: 'callType must be voice or video' });
    }
    
    const result = await MissedCall.updateMany(
      { receiverId: username, callerId, callType, isSeen: false },
      { isSeen: true }
    );
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking missed calls by type as seen:', error);
    res.status(500).json({ error: 'Failed to mark missed calls as seen' });
  }
});

router.post('/mark-all-seen', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    
    const result = await MissedCall.updateMany(
      { receiverId: username, isSeen: false },
      { isSeen: true }
    );
    
    res.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking all missed calls as seen:', error);
    res.status(500).json({ error: 'Failed to mark all missed calls as seen' });
  }
});

export default router;
