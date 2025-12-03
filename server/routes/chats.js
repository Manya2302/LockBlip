import express from 'express';
import Chat from '../models/Chat.js';
import { authenticateToken } from '../middleware/auth.js';
import { serverDecrypt } from '../lib/chatCrypto.js';
import { encryptField, decryptField } from '../lib/encryption.js';

const router = express.Router();

function getChatRoomId(user1, user2) {
  return [user1, user2].sort().join('_');
}

router.get('/messages/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUser = req.user.username;
    
    const chatRoomId = getChatRoomId(currentUser, username);
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const messages = await Chat.find({ chatRoomId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Filter out any messages that have been deleted for the current user
    const decryptedMessages = [];
    for (const msg of messages) {
      try {
        const msgObj = msg.toObject({ getters: true });

        // If this message was marked deleted for the requesting user, skip it
        if (msgObj.deletedFor && Array.isArray(msgObj.deletedFor) && msgObj.deletedFor.includes(req.user.username)) {
          continue;
        }

        if (msgObj.encryptedMessage && msgObj.chatPublicKey && msgObj.chatPrivateKey) {
          try {
            msgObj.encryptedMessage = serverDecrypt(msgObj.encryptedMessage);
          } catch (error) {
            console.error('Failed to decrypt message server layer:', error);
          }
        }

        decryptedMessages.push(msgObj);
      } catch (err) {
        console.error('Error processing message for fetch:', err);
      }
    }
    
    // total should count only messages that aren't deleted for this user
    const totalCandidates = await Chat.find({ chatRoomId }).select('deletedFor').lean();
    let total = 0;
    for (const c of totalCandidates) {
      try {
        const decryptedDeletedFor = (c.deletedFor || []).map(d => {
          try { return decryptField(d); } catch (e) { return d; }
        });
        if (!decryptedDeletedFor.includes(req.user.username)) total += 1;
      } catch (err) {
        total += 1; // if decryption fails, count it conservatively
      }
    }
    
    res.json({
      messages: decryptedMessages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: skip + messages.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

router.patch('/messages/:messageId/status', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;
    
    if (!['delivered', 'seen'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const message = await Chat.findByIdAndUpdate(
      messageId,
      { status },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    res.json({ message: 'Status updated', status: message.status });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ message: 'Error updating message status' });
  }
});

router.patch('/messages/bulk-status', authenticateToken, async (req, res) => {
  try {
    const { messageIds, status } = req.body;
    const currentUser = req.user.username;
    
    if (!['delivered', 'seen'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // The stored receiverId values are encrypted non-deterministically,
    // so re-encrypting the username will not match the saved ciphertext.
    // Find the candidate messages, decrypt receiverId and update only the
    // messages that actually belong to the current user.
    const candidates = await Chat.find({ _id: { $in: messageIds } })
      .select('_id receiverId')
      .lean();

    const idsToUpdate = [];
    for (const c of candidates) {
      try {
        const decryptedReceiver = decryptField(c.receiverId);
        if (decryptedReceiver === currentUser) idsToUpdate.push(c._id.toString());
      } catch (err) {
        console.warn('Failed to decrypt receiverId for message', c._id, err);
      }
    }

    let modifiedCount = 0;
    if (idsToUpdate.length > 0) {
      const updateRes = await Chat.updateMany({ _id: { $in: idsToUpdate } }, { status });
      modifiedCount = updateRes.modifiedCount || 0;
    }

    res.json({ message: 'Status updated', updated: modifiedCount });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ message: 'Error updating message status' });
  }
});

router.patch('/messages/seen/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUser = req.user.username;
    
    const chatRoomId = getChatRoomId(currentUser, username);

    // Fetch candidate messages in the chat room, then decrypt receiverId
    // and update only those where the decrypted receiver matches the
    // current user. This handles the non-deterministic encryption output.
    const candidates = await Chat.find({ chatRoomId, status: { $ne: 'seen' } })
      .select('_id receiverId')
      .lean();

    const idsToUpdate = [];
    for (const c of candidates) {
      try {
        const decryptedReceiver = decryptField(c.receiverId);
        if (decryptedReceiver === currentUser) idsToUpdate.push(c._id.toString());
      } catch (err) {
        console.warn('Failed to decrypt receiverId for message', c._id, err);
      }
    }

    let modifiedCount = 0;
    if (idsToUpdate.length > 0) {
      const updateRes = await Chat.updateMany({ _id: { $in: idsToUpdate } }, { status: 'seen' });
      modifiedCount = updateRes.modifiedCount || 0;
    }

    res.json({ message: 'Messages marked as seen', updated: modifiedCount });
  } catch (error) {
    console.error('Error marking messages as seen:', error);
    res.status(500).json({ message: 'Error marking messages as seen' });
  }
});

router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUser = req.user.username;
    
    // Retrieve the message and compare the decrypted senderId to ensure
    // only the sender can delete the message. Do not try to re-encrypt the
    // username since encryption is non-deterministic.
    const message = await Chat.findById(messageId).select('senderId').lean();
    if (!message) {
      return res.status(404).json({ message: 'Message not found or unauthorized' });
    }

    try {
      const decryptedSender = decryptField(message.senderId);
      if (decryptedSender !== currentUser) {
        return res.status(404).json({ message: 'Message not found or unauthorized' });
      }
    } catch (err) {
      console.warn('Failed to decrypt senderId for message', messageId, err);
      return res.status(500).json({ message: 'Error deleting message' });
    }

    await Chat.findByIdAndDelete(messageId);
    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// Delete for both: remove message if requester is sender or receiver
router.post('/messages/:messageId/delete-both', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUser = req.user.username;

    const message = await Chat.findById(messageId).select('senderId receiverId').lean();
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    try {
      const senderPlain = decryptField(message.senderId);

      // Only the original sender can delete a message for everyone.
      if (senderPlain !== currentUser) {
        return res.status(403).json({ message: 'Only the sender can delete this message for everyone' });
      }
    } catch (err) {
      console.warn('Failed to decrypt senderId for delete-both', err);
      return res.status(500).json({ message: 'Error processing request' });
    }

    await Chat.findByIdAndDelete(messageId);
    res.json({ message: 'Deleted for both' });
  } catch (error) {
    console.error('Error deleting message for both:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// Delete for me: mark this message as deleted for the requesting user only
router.post('/messages/:messageId/delete-me', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUser = req.user.username;

    const message = await Chat.findById(messageId).select('senderId receiverId deletedFor').lean();
    if (!message) return res.status(404).json({ message: 'Message not found' });

    try {
      const senderPlain = decryptField(message.senderId);
      const receiverPlain = decryptField(message.receiverId);
      if (senderPlain !== currentUser && receiverPlain !== currentUser) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    } catch (err) {
      console.warn('Failed to decrypt ids for delete-me', err);
      return res.status(500).json({ message: 'Error processing request' });
    }

    // push encrypted username into deletedFor array
    try {
      await Chat.findByIdAndUpdate(messageId, { $push: { deletedFor: encryptField(currentUser) } });
      return res.json({ message: 'Deleted for me' });
    } catch (err) {
      console.error('Failed to mark deletedFor:', err);
      return res.status(500).json({ message: 'Error marking message deleted' });
    }
  } catch (error) {
    console.error('Error deleting message for me:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

export default router;
