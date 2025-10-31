import express from 'express';
import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper function to find user by decrypted username
async function findUserByUsername(username) {
  if (!username) return null;
  
  const trimmedUsername = username.trim();
  
  // Get all users and filter by decrypted username
  // Note: This is not scalable for large datasets
  const allUsers = await User.find({}).select('username fullName profileImage publicKey');
  
  // Find the user with matching decrypted username
  const matchedUser = allUsers.find(user => 
    user.username && user.username.toLowerCase() === trimmedUsername.toLowerCase()
  );
  
  return matchedUser || null;
}

router.post('/send-request', authenticateToken, async (req, res) => {
  try {
    const senderUser = await User.findById(req.user.id);
    if (!senderUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { receiver } = req.body;
    const sender = senderUser.username;

    if (!sender || !receiver) {
      return res.status(400).json({ message: 'Sender and receiver are required' });
    }

    if (sender === receiver) {
      return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    const existingConnection = await Connection.findOne({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({ 
        message: 'Connection already exists',
        status: existingConnection.status
      });
    }

    const connection = new Connection({
      sender,
      receiver,
      status: 'pending',
      isFriend: false,
      messagePermission: false,
    });

    await connection.save();
    res.status(201).json({ message: 'Friend request sent', connection });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ message: 'Failed to send friend request' });
  }
});

router.post('/accept-request', authenticateToken, async (req, res) => {
  try {
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ message: 'Connection ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const connection = await Connection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    if (connection.receiver !== currentUser.username) {
      return res.status(403).json({ message: 'Only the receiver can accept this request' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ message: 'Can only accept pending requests' });
    }

    connection.status = 'accepted';
    connection.isFriend = true;
    connection.messagePermission = true;
    connection.updatedAt = new Date();

    await connection.save();
    res.json({ message: 'Friend request accepted', connection });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ message: 'Failed to accept friend request' });
  }
});

router.post('/ignore-request', authenticateToken, async (req, res) => {
  try {
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ message: 'Connection ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const connection = await Connection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    if (connection.receiver !== currentUser.username) {
      return res.status(403).json({ message: 'Only the receiver can ignore this request' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ message: 'Can only ignore pending requests' });
    }

    connection.status = 'ignored';
    connection.isFriend = false;
    connection.messagePermission = false;
    connection.updatedAt = new Date();

    await connection.save();
    res.json({ message: 'Friend request ignored', connection });
  } catch (error) {
    console.error('Ignore request error:', error);
    res.status(500).json({ message: 'Failed to ignore friend request' });
  }
});

router.get('/friend-requests/:username', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const username = user.username;

    console.log('📬 Fetching friend requests for user:', username);

    const received = await Connection.find({
      receiver: username,
      status: 'pending'
    }).lean();

    const sent = await Connection.find({
      sender: username,
      status: 'pending'
    }).lean();

    console.log('📥 Received requests:', received.length);
    console.log('📤 Sent requests:', sent.length);

    const receivedWithDetails = await Promise.all(
      received.map(async (conn) => {
        const senderUsername = conn.sender;
        console.log('🔍 Looking up sender by username:', senderUsername);
        
        // Use helper function to find user by decrypted username
        const senderUser = await findUserByUsername(senderUsername);
        
        console.log('👤 Sender user found:', senderUser ? 'Yes' : 'No');
        if (senderUser) {
          console.log('✅ Sender details:', { username: senderUser.username, fullName: senderUser.fullName });
        }
        
        return {
          ...conn,
          senderDetails: senderUser ? {
            username: senderUser.username,
            fullName: senderUser.fullName,
            profileImage: senderUser.profileImage,
            publicKey: senderUser.publicKey
          } : {
            username: senderUsername,
            fullName: 'Unknown User',
            profileImage: ''
          }
        };
      })
    );

    const sentWithDetails = await Promise.all(
      sent.map(async (conn) => {
        const receiverUsername = conn.receiver;
        console.log('🔍 Looking up receiver by username:', receiverUsername);
        
        // Use helper function to find user by decrypted username
        const receiverUser = await findUserByUsername(receiverUsername);
        
        console.log('👤 Receiver user found:', receiverUser ? 'Yes' : 'No');
        
        return {
          ...conn,
          receiverDetails: receiverUser ? {
            username: receiverUser.username,
            fullName: receiverUser.fullName,
            profileImage: receiverUser.profileImage,
            publicKey: receiverUser.publicKey
          } : {
            username: receiverUsername,
            fullName: 'Unknown User',
            profileImage: ''
          }
        };
      })
    );

    console.log('✅ Sending response with:', {
      receivedCount: receivedWithDetails.length,
      sentCount: sentWithDetails.length
    });

    res.json({ 
      received: receivedWithDetails,
      sent: sentWithDetails
    });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Failed to fetch friend requests' });
  }
});

router.get('/friends/:username', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const username = user.username;

    const connections = await Connection.find({
      $or: [
        { sender: username, status: 'accepted' },
        { receiver: username, status: 'accepted' }
      ]
    }).lean();

    const friendUsernames = connections.map(conn => 
      conn.sender === username ? conn.receiver : conn.sender
    );

    const friends = await User.find({
      username: { $in: friendUsernames }
    }).select('username fullName profileImage description');

    res.json(friends);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Failed to fetch friends' });
  }
});

router.get('/connection-status/:username/:otherUsername', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const username = user.username;
    const { otherUsername } = req.params;

    const connection = await Connection.findOne({
      $or: [
        { sender: username, receiver: otherUsername },
        { sender: otherUsername, receiver: username }
      ]
    }).lean();

    if (!connection) {
      return res.json({ status: 'none', connectionId: null });
    }

    const isSender = connection.sender === username;
    
    res.json({
      status: connection.status,
      connectionId: connection._id,
      isSender,
      isFriend: connection.isFriend,
      messagePermission: connection.messagePermission
    });
  } catch (error) {
    console.error('Get connection status error:', error);
    res.status(500).json({ message: 'Failed to fetch connection status' });
  }
});

router.post('/remove-friend', authenticateToken, async (req, res) => {
  try {
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ message: 'Connection ID is required' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const connection = await Connection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    if (connection.sender !== currentUser.username && connection.receiver !== currentUser.username) {
      return res.status(403).json({ message: 'You can only remove your own connections' });
    }

    await Connection.findByIdAndDelete(connectionId);
    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Failed to remove friend' });
  }
});

export default router;
