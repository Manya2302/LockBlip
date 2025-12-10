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
    
    // Get the last summary timestamp for this chat
    const lastSummary = await ChatSummary.findOne({ chatRoomId, userId: currentUser })
      .sort({ createdAt: -1 })
      .lean();
    
    const lastSummaryTime = lastSummary ? new Date(lastSummary.createdAt) : null;
    
    // Query for messages since last summary (or all messages if no previous summary)
    const query = { chatRoomId };
    if (lastSummaryTime) {
      query.timestamp = { $gt: lastSummaryTime };
    }
    
    const recentMessages = await Chat.find(query).lean();

    // Filter to only messages received by current user
    const receivedMessages = [];
    for (const msg of recentMessages) {
      try {
        const decryptedReceiver = decryptField(msg.receiverId);
        if (decryptedReceiver === currentUser) {
          receivedMessages.push(msg);
        }
      } catch (err) {
        console.warn('Failed to decrypt receiverId:', err);
      }
    }

    const shouldShowButton = receivedMessages.length >= UNREAD_THRESHOLD;
    
    console.log('📊 AI Summary check:', { 
      username, 
      currentUser, 
      messageCount: receivedMessages.length, 
      threshold: UNREAD_THRESHOLD,
      shouldShow: shouldShowButton && isAIAvailable()
    });
    
    res.json({
      unreadCount: receivedMessages.length,
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
    const { includeAll = false, messageCount = 50 } = req.body;
    const currentUser = req.user.username;
    const chatRoomId = getChatRoomId(currentUser, username);

    console.log('📝 AI Summary request:', { username, currentUser, chatRoomId, includeAll });

    if (!isAIAvailable()) {
      console.log('❌ AI service not available');
      return res.status(503).json({ error: 'AI service not available' });
    }

    let messagesToSummarize;
    
    // Get the last summary timestamp for this chat to avoid re-summarizing old messages
    const lastSummary = await ChatSummary.findOne({ chatRoomId, userId: currentUser })
      .sort({ createdAt: -1 })
      .lean();
    
    const lastSummaryTime = lastSummary ? new Date(lastSummary.createdAt) : null;
    console.log('📝 Last summary time:', lastSummaryTime);
    
    if (includeAll) {
      messagesToSummarize = await Chat.find({ chatRoomId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
    } else {
      // Get recent messages that were sent TO the current user (messages they received)
      // This includes both read and unread messages since the last summary
      const query = { chatRoomId };
      
      // If there was a previous summary, only get messages after it
      if (lastSummaryTime) {
        query.timestamp = { $gt: lastSummaryTime };
      }
      
      const allMessages = await Chat.find(query)
        .sort({ timestamp: -1 })
        .limit(messageCount)
        .lean();

      console.log('📝 Found messages in chatroom:', allMessages.length);

      // Filter to only messages received by current user (not sent by them)
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
      
      console.log('📝 Messages to summarize (received by user):', messagesToSummarize.length);
    }

    if (messagesToSummarize.length === 0) {
      return res.status(400).json({ error: 'No messages to summarize' });
    }

    const formattedMessages = [];
    for (const msg of messagesToSummarize) {
      try {
        let content = null;
        
        // Only attempt decryption if we have all required keys
        if (msg.encryptedMessage && msg.chatPublicKey && msg.chatPrivateKey) {
          try {
            content = await decryptMessageWithChatKeys(
              msg.encryptedMessage,
              msg.chatPublicKey,
              msg.chatPrivateKey
            );
          } catch (e) {
            // Skip messages that fail to decrypt - don't include them in summary
            console.warn('Skipping message due to decryption failure:', e.message);
            continue;
          }
        } else {
          // Skip messages without proper encryption keys
          console.warn('Skipping message - missing encryption keys');
          continue;
        }
        
        // Skip if content is empty or null
        if (!content || content.trim() === '') {
          continue;
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
        console.warn('Error processing message for summary, skipping:', err.message);
        continue;
      }
    }

    console.log('📝 Successfully decrypted messages for AI:', formattedMessages.length, 
      formattedMessages.slice(0, 3).map(m => ({ sender: m.sender, content: m.content?.substring(0, 50) })));
    
    // Check if we have enough valid messages to summarize
    if (formattedMessages.length === 0) {
      return res.status(400).json({ error: 'No messages could be decrypted for summary' });
    }
    
    if (formattedMessages.length < 3) {
      return res.status(400).json({ error: 'Not enough readable messages to generate a meaningful summary (need at least 3)' });
    }
    
    const result = await summarizeChat(formattedMessages, {
      isGroupChat: false,
      maxLength: 500,
    });

    console.log('📝 AI Summary result:', result.summary?.substring(0, 100), '... (', result.messageCount, 'messages)');

    const keywords = await extractKeywords(result.summary);
    console.log('📝 Extracted keywords:', keywords);

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
