import express from 'express';
import User from '../models/User.js';
import Connection from '../models/Connection.js';
import Chat from '../models/Chat.js';
import { authenticateToken } from '../middleware/auth.js';
import { decryptField } from '../lib/encryption.js';

const router = express.Router();

router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`📋 Fetching contacts for user: ${user.username}`);

    const connections = await Connection.find({
      $or: [
        { sender: user.username, status: 'accepted' },
        { receiver: user.username, status: 'accepted' }
      ]
    }).lean();

    console.log(`🔗 Found ${connections.length} accepted connections`);
    console.log('Connections:', connections.map(c => `${c.sender} -> ${c.receiver} (${c.status})`));

    const friendUsernames = connections.map(conn => 
      conn.sender === user.username ? conn.receiver : conn.sender
    );

    console.log(`👥 Friend usernames:`, friendUsernames);

    const allUsers = await User.find({});
    const friendUsers = allUsers.filter(u => friendUsernames.includes(u.username));

    console.log(`📇 Found ${friendUsers.length} friend users in database`);

    const contacts = await Promise.all(friendUsers.map(async (friendUser) => {
      const chatRoomId = [user.username, friendUser.username].sort().join('_');

      // Fetch the latest message in the chat room (if any).
      const last = await Chat.find({ chatRoomId })
        .sort({ timestamp: -1 })
        .limit(1)
        .select('timestamp encryptedMessage')
        .lean();

      // For unread count, fetch candidates with status != 'seen' and
      // then filter in application code by decrypting sender/receiver.
      const unseen = await Chat.find({ chatRoomId, status: { $ne: 'seen' } })
        .select('senderId receiverId')
        .lean();

      let unreadCount = 0;
      for (const m of unseen) {
        try {
          const senderPlain = decryptField(m.senderId);
          const receiverPlain = decryptField(m.receiverId);
          if (senderPlain === friendUser.username && receiverPlain === user.username) {
            unreadCount++;
          }
        } catch (err) {
          console.warn('Failed to decrypt chat ids for unread count', err);
        }
      }

      return {
        id: friendUser.publicKey,
        name: friendUser.username,
        fullName: friendUser.fullName || '',
        phone: friendUser.phone || '',
        profileImage: friendUser.profileImage || '',
        description: friendUser.description || '',
        isOnline: false,
        lastMessageTime: last.length ? last[0].timestamp : null,
        unreadCount: unreadCount
      };
    }));

    contacts.sort((a, b) => {
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    console.log(`✅ Returning ${contacts.length} contacts sorted by last message time`);

    res.json(contacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      description: user.description || '',
      profileImage: user.profileImage || '',
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, phone, dateOfBirth, description, profileImage } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (description !== undefined) user.description = description;
    if (profileImage !== undefined) user.profileImage = profileImage;

    await user.save();

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      description: user.description,
      profileImage: user.profileImage,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    console.log('🔍 Search request received:', { query, userId: req.user.id });
    
    if (!query || query.length < 2) {
      console.log('❌ Query too short or missing');
      return res.json([]);
    }

    const searchQuery = query.startsWith('@') ? query.substring(1) : query;
    console.log('🔍 Processed search query:', searchQuery);
    
    const allUsers = await User.find({});
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    const matchingUsers = allUsers
      .filter(user => {
        if (user._id.toString() === req.user.id.toString()) return false;
        const lowerQuery = searchQuery.toLowerCase();
        const username = user.username || '';
        const fullName = user.fullName || '';
        const phone = user.phone || '';
        
        const matches = (
          username.toLowerCase().includes(lowerQuery) ||
          fullName.toLowerCase().includes(lowerQuery) ||
          phone.includes(searchQuery)
        );
        
        if (matches) {
          console.log(`✅ Match found: ${username} (${fullName})`);
        }
        
        return matches;
      })
      .map(user => ({
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        description: user.description || '',
        profileImage: user.profileImage || '',
        publicKey: user.publicKey,
        createdAt: user.createdAt,
      }));

    console.log(`✅ Returning ${matchingUsers.length} matching users`);
    res.json(matchingUsers);
  } catch (error) {
    console.error('❌ Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:username', authenticateToken, async (req, res) => {
  try {
    const { username } = req.params;
    
    const allUsers = await User.find({});
    const user = allUsers.find(u => u.username === username);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      description: user.description || '',
      profileImage: user.profileImage || '',
      publicKey: user.publicKey,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/theme', authenticateToken, async (req, res) => {
  try {
    const { theme } = req.body;
    
    if (!theme || !['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme. Must be "light" or "dark"' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.themePreference = theme;
    await user.save();

    console.log(`✅ Updated theme preference for ${user.username} to ${theme}`);

    res.json({ 
      success: true, 
      theme: user.themePreference 
    });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
