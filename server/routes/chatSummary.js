import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Chat from '../models/Chat.js';
import ChatSummary from '../models/ChatSummary.js';
import { summarizeChat, extractKeywords, isAIAvailable } from '../services/aiService.js';
import { decryptMessageWithChatKeys } from '../lib/chatCrypto.js';
import { decryptField } from '../lib/encryption.js';

const router = express.Router();

const UNREAD_THRESHOLD = 7;
const VOICE_NOTE_DURATION_THRESHOLD = 30;

function getChatRoomId(user1, user2) {
  return [user1, user2].sort().join('_');
}

router.get('/status', authenticateToken, (req, res) => {
  res.json({
    available: isAIAvailable(),
    unreadThreshold: UNREAD_THRESHOLD,
    voiceNoteDurationThreshold: VOICE_NOTE_DURATION_THRESHOLD,
  });
});

router.get('/check/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUser = req.user.username;
    const chatRoomId = getChatRoomId(currentUser, username);
    
    const unreadMessages = await Chat.find({
      chatRoomId,
      status: { $ne: 'seen' },
    }).lean();

    const filteredUnread = [];
    for (const msg of unreadMessages) {
      try {
        const decryptedReceiver = decryptField(msg.receiverId);
        if (decryptedReceiver === currentUser) {
          filteredUnread.push(msg);
        }
      } catch (err) {
        console.warn('Failed to decrypt receiverId:', err);
      }
    }

    const shouldShowButton = filteredUnread.length >= UNREAD_THRESHOLD;
    
    res.json({
      unreadCount: filteredUnread.length,
      showSummarizeButton: shouldShowButton && isAIAvailable(),
      threshold: UNREAD_THRESHOLD,
    });
  } catch (error) {
    console.error('Check summary eligibility error:', error);
    res.status(500).json({ error: 'Failed to check summary eligibility' });
  }
});

router.post('/generate/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const { includeAll = false } = req.body;
    const currentUser = req.user.username;
    const chatRoomId = getChatRoomId(currentUser, username);

    if (!isAIAvailable()) {
      return res.status(503).json({ error: 'AI service not available' });
    }

    let messagesToSummarize;
    
    if (includeAll) {
      messagesToSummarize = await Chat.find({ chatRoomId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
    } else {
      const allMessages = await Chat.find({
        chatRoomId,
        status: { $ne: 'seen' },
      }).lean();

      messagesToSummarize = [];
      for (const msg of allMessages) {
        try {
          const decryptedReceiver = decryptField(msg.receiverId);
          if (decryptedReceiver === currentUser) {
            messagesToSummarize.push(msg);
          }
        } catch (err) {
          console.warn('Failed to decrypt receiverId:', err);
        }
      }
    }

    if (messagesToSummarize.length === 0) {
      return res.status(400).json({ error: 'No messages to summarize' });
    }

    const formattedMessages = [];
    for (const msg of messagesToSummarize) {
      try {
        let content = '[Unable to decrypt]';
        if (msg.encryptedMessage && msg.chatPublicKey && msg.chatPrivateKey) {
          try {
            content = await decryptMessageWithChatKeys(
              msg.encryptedMessage,
              msg.chatPublicKey,
              msg.chatPrivateKey
            );
          } catch (e) {
            console.warn('Failed to decrypt message for summary:', e.message);
          }
        } else if (msg.encryptedMessage) {
          content = msg.encryptedMessage;
        }
        
        const sender = decryptField(msg.senderId);
        
        formattedMessages.push({
          sender,
          content,
          messageType: msg.messageType,
          transcription: msg.metadata?.transcription || null,
          timestamp: msg.timestamp,
        });
      } catch (err) {
        console.warn('Error processing message for summary:', err);
      }
    }

    const result = await summarizeChat(formattedMessages, {
      isGroupChat: false,
      maxLength: 500,
    });

    const keywords = await extractKeywords(result.summary);

    const summary = await ChatSummary.create({
      chatRoomId,
      userId: currentUser,
      summary: result.summary,
      messageCount: result.messageCount,
      firstMessageId: messagesToSummarize[messagesToSummarize.length - 1]?._id?.toString(),
      lastMessageId: messagesToSummarize[0]?._id?.toString(),
      keywords,
      isGroupChat: false,
      participants: [currentUser, username],
      model: result.model,
    });

    res.json({
      success: true,
      summary: {
        id: summary._id,
        text: result.summary,
        messageCount: result.messageCount,
        keywords,
        createdAt: summary.createdAt,
      },
    });
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

router.get('/history/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const { limit = 10 } = req.query;
    const currentUser = req.user.username;
    const chatRoomId = getChatRoomId(currentUser, username);

    const summaries = await ChatSummary.find({ chatRoomId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const decryptedSummaries = summaries.map(s => {
      const obj = s.toObject({ getters: true });
      return {
        id: obj._id,
        summary: obj.summary,
        messageCount: obj.messageCount,
        keywords: obj.keywords,
        createdAt: obj.createdAt,
        isRead: obj.isRead,
      };
    });

    res.json({ summaries: decryptedSummaries });
  } catch (error) {
    console.error('Get summary history error:', error);
    res.status(500).json({ error: 'Failed to get summary history' });
  }
});

router.put('/read/:summaryId', authenticateToken, async (req, res) => {
  try {
    const { summaryId } = req.params;
    
    await ChatSummary.findByIdAndUpdate(summaryId, { isRead: true });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Mark summary read error:', error);
    res.status(500).json({ error: 'Failed to mark summary as read' });
  }
});

router.get('/latest/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUser = req.user.username;
    const chatRoomId = getChatRoomId(currentUser, username);

    const latestSummary = await ChatSummary.findOne({ 
      chatRoomId,
      isRead: false,
    }).sort({ createdAt: -1 });

    if (!latestSummary) {
      return res.json({ summary: null });
    }

    const obj = latestSummary.toObject({ getters: true });
    
    res.json({
      summary: {
        id: obj._id,
        text: obj.summary,
        messageCount: obj.messageCount,
        keywords: obj.keywords,
        createdAt: obj.createdAt,
      },
    });
  } catch (error) {
    console.error('Get latest summary error:', error);
    res.status(500).json({ error: 'Failed to get latest summary' });
  }
});

export default router;
