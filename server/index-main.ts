
// Load .env into process.env for local development
import dotenv from 'dotenv';
dotenv.config();

console.log('Starting server initialization...');

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import mongoose from 'mongoose';

console.log('Basic imports loaded');

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import blockchainRoutes from './routes/blockchain.js';
import storiesRoutes from './routes/stories.js';
import connectionsRoutes from './routes/connections.js';
import chatsRoutes from './routes/chats.js';
import uploadsRoutes from './routes/uploads.js';
import missedCallsRoutes from './routes/missedCalls.js';
import ghostRoutes from './routes/ghost.js';
import { startDeletionWorker, markMessageViewed, markAudioPlayed } from './services/deletionWorker.js';
import GhostChatSession, { encryptWithSessionKey, decryptWithSessionKey } from './models/GhostChat.js';
import GhostMessage from './models/GhostMessage.js';
import GhostUser from './models/GhostUser.js';
import { initializeBlockchain, addMessageBlock } from './lib/blockchain.js';
import MissedCall from './models/MissedCall.js';
import { authenticateSocket } from './middleware/auth.js';
import { setupVite, serveStatic } from './vite.js';
import { encryptField, decryptField } from './lib/encryption.js';
import { 
  encryptMessageWithChatKeys, 
  decryptMessageWithChatKeys, 
  calculateMessageHash, 
  getPreviousMessageHash,
  getChatKeys 
} from './lib/chatCrypto.js';
import Connection from './models/Connection.js';
import Chat from './models/Chat.js';
import User from './models/User.js';
import path from 'path';

console.log('All imports loaded');

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

const app = express();
const server = createServer(app);

app.set('trust proxy', true);

const io = new Server(server, {
  cors: {
    origin: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000',
    credentials: true,
  },
});

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000',
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  validate: { trustProxy: false },
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/missed-calls', missedCallsRoutes);
app.use('/api/ghost', ghostRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.use(authenticateSocket);

const userSockets = new Map<string, string>();

interface PendingCall {
  from: string;
  to: string;
  offer: RTCSessionDescriptionInit;
  callType: 'video' | 'audio';
  timestamp: Date;
  iceCandidates: RTCIceCandidateInit[];
  canceled: boolean;
}

const pendingCalls = new Map<string, PendingCall>();

function getPendingCallKey(from: string, to: string): string {
  return `${from}:${to}`;
}

async function getMissedCallCounts(username: string) {
  const unseenCalls = await MissedCall.find({ 
    receiverId: username, 
    isSeen: false 
  }).lean();
  
  const perUser: { [key: string]: { voice: number; video: number } } = {};
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
  
  return { totalMissed, perUser };
}

async function createMissedCall(callerId: string, receiverId: string, callType: 'voice' | 'video') {
  try {
    await MissedCall.create({
      callerId,
      receiverId,
      callType,
      isSeen: false,
      timestamp: new Date(),
    });
    
    console.log(`📞 Missed call recorded: ${callerId} -> ${receiverId} (${callType})`);
    
    // Create a system message for the missed call in the chat
    const chatRoomId = [callerId, receiverId].sort().join('_');
    const callTypeLabel = callType === 'voice' ? 'voice' : 'video';
    const systemMessage = `📞 Missed ${callTypeLabel} call`;
    
    const { encryptMessageWithChatKeys, calculateMessageHash, getPreviousMessageHash } = await import('./lib/chatCrypto.js');
    const { encryptedMessage, chatPublicKey, chatPrivateKey } = await encryptMessageWithChatKeys(systemMessage, chatRoomId);
    
    const previousHash = await getPreviousMessageHash(chatRoomId);
    const timestamp = new Date();
    const hash = calculateMessageHash(
      chatRoomId,
      'LockBlip',
      receiverId,
      'text',
      encryptedMessage,
      timestamp.toISOString(),
      previousHash
    );
    
    const block = await addMessageBlock('LockBlip', receiverId, encryptedMessage);
    
    const chatMessage = await Chat.create({
      senderId: 'LockBlip',
      receiverId: receiverId,
      encryptedMessage,
      chatRoomId,
      messageType: 'text',
      mediaUrl: null,
      metadata: { 
        isSystemMessage: true, 
        missedCallFrom: callerId,
        missedCallType: callType 
      },
      status: 'delivered',
      blockIndex: block.index,
      hash,
      previousHash,
      chatPublicKey,
      chatPrivateKey,
      timestamp,
    });
    
    console.log(`📞 System message created for missed call: ${chatMessage._id}`);
    
    // Also send the missed call message to the receiver if online
    const receiverSocketId = userSockets.get(receiverId);
    if (receiverSocketId) {
      const counts = await getMissedCallCounts(receiverId);
      io.to(receiverSocketId).emit('missed_call_update', counts);
      io.to(receiverSocketId).emit('new_missed_call', { callerId, callType });
      
      // Send the system message to the receiver
      const { serverDecrypt } = await import('./lib/chatCrypto.js');
      const chatEncrypted = serverDecrypt(encryptedMessage);
      
      io.to(receiverSocketId).emit('receive-message', {
        from: 'LockBlip',
        messageId: chatMessage._id.toString(),
        encryptedMessage: chatEncrypted,
        chatPublicKey,
        chatPrivateKey,
        hash,
        previousHash,
        block: {
          index: block.index,
          timestamp: block.timestamp,
          hash: block.hash,
          prevHash: block.prevHash,
          payload: block.payload,
        },
        messageType: 'text',
        mediaUrl: null,
        metadata: { 
          isSystemMessage: true, 
          missedCallFrom: callerId,
          missedCallType: callType 
        },
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error creating missed call:', error);
    return false;
  }
}

io.on('connection', async (socket: AuthenticatedSocket) => {
  console.log(`User connected: ${socket.username}`);
  if (socket.username) {
    userSockets.set(socket.username, socket.id);
    
    // Send missed call counts on connection
    try {
      const missedCallCounts = await getMissedCallCounts(socket.username);
      socket.emit('missed_call_update', missedCallCounts);
      console.log(`📞 Sent missed call counts to ${socket.username}:`, missedCallCounts);
    } catch (err) {
      console.error('Error sending missed call counts on connection:', err);
    }
    
    for (const [key, pendingCall] of pendingCalls.entries()) {
      if (pendingCall.to === socket.username) {
        if (pendingCall.canceled) {
          console.log(`📞 Notifying ${socket.username} that call from ${pendingCall.from} was canceled`);
          socket.emit('webrtc-call-cancel', { from: pendingCall.from });
          pendingCalls.delete(key);
        } else {
          const callerSocketId = userSockets.get(pendingCall.from);
          if (callerSocketId) {
            console.log(`📞 Forwarding pending call from ${pendingCall.from} to ${socket.username}`);
            socket.emit('webrtc-call-offer', { 
              from: pendingCall.from, 
              offer: pendingCall.offer, 
              callType: pendingCall.callType 
            });
            
            pendingCall.iceCandidates.forEach((candidate) => {
              socket.emit('webrtc-ice-candidate', { from: pendingCall.from, candidate });
            });
            
            io.to(callerSocketId).emit('webrtc-recipient-online', { to: pendingCall.to });
            pendingCalls.delete(key);
          } else {
            console.log(`📞 Caller ${pendingCall.from} is no longer online, removing stale pending call`);
            pendingCalls.delete(key);
          }
        }
        break;
      }
    }
  }

  socket.emit('connected', { username: socket.username });

  socket.on('send-message', async (data) => {
    try {
      const { to, message, messageType = 'text', mediaUrl = null, metadata = null } = data;
      
      const areFriends = await Connection.findOne({
        $or: [
          { sender: socket.username, receiver: to, status: 'accepted' },
          { sender: to, receiver: socket.username, status: 'accepted' }
        ]
      });

      if (!areFriends) {
        console.log(`Message blocked: ${socket.username} and ${to} are not friends`);
        socket.emit('error', { message: 'You can only message friends' });
        return;
      }
      
      const chatRoomId = [socket.username, to].sort().join('_');
      
      const { encryptedMessage, chatPublicKey, chatPrivateKey } = await encryptMessageWithChatKeys(message, chatRoomId);
      
      const previousHash = await getPreviousMessageHash(chatRoomId);
      const timestamp = new Date();
      const hash = calculateMessageHash(
        chatRoomId,
        socket.username!,
        to,
        messageType,
        encryptedMessage,
        timestamp.toISOString(),
        previousHash
      );
      
      const block = await addMessageBlock(
        socket.username!,
        to,
        encryptedMessage
      );
      
      const chatMessage = await Chat.create({
        senderId: socket.username,
        receiverId: to,
        encryptedMessage,
        chatRoomId,
        messageType,
        mediaUrl,
        metadata,
        status: 'sent',
        blockIndex: block.index,
        hash,
        previousHash,
        chatPublicKey,
        chatPrivateKey,
        timestamp,
      });

      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        const { serverDecrypt } = await import('./lib/chatCrypto.js');
        const chatEncrypted = serverDecrypt(encryptedMessage);
        
        io.to(recipientSocketId).emit('receive-message', {
          from: socket.username,
          messageId: chatMessage._id.toString(),
          encryptedMessage: chatEncrypted,
          chatPublicKey,
          chatPrivateKey,
          hash,
          previousHash,
          block: {
            index: block.index,
            timestamp: block.timestamp,
            hash: block.hash,
            prevHash: block.prevHash,
            payload: block.payload,
          },
          messageType,
          mediaUrl,
          metadata,
        });
        
        await Chat.findByIdAndUpdate(chatMessage._id, { status: 'delivered' });
        
        socket.emit('message-delivered', {
          messageId: chatMessage._id.toString(),
          blockNumber: block.index,
        });
      }

      socket.emit('message-sent', {
        messageId: chatMessage._id.toString(),
        blockNumber: block.index,
        hash: block.hash,
        previousHash,
        timestamp: timestamp.toISOString(),
      });

      console.log(`Message block #${block.index} created: ${socket.username} -> ${to} (hash: ${hash.substring(0, 8)}...)`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('message-seen', async (data) => {
    try {
      const { messageId, from } = data;
      
      const message = await Chat.findByIdAndUpdate(
        messageId,
        { status: 'seen' },
        { new: true }
      );
      
      if (message) {
        const senderSocketId = userSockets.get(from);
        if (senderSocketId) {
          io.to(senderSocketId).emit('message-status-update', {
            messageId,
            status: 'seen',
          });
        }
      }
    } catch (error) {
      console.error('Message seen error:', error);
    }
  });
  
  socket.on('messages-seen-bulk', async (data) => {
    try {
      const { username } = data;
      const chatRoomId = [socket.username, username].sort().join('_');
      
      console.log('📬 messages-seen-bulk event received');
      console.log('  From user (viewer):', socket.username);
      console.log('  For messages from:', username);
      console.log('  Chat room ID:', chatRoomId);
      
      // The stored `receiverId` values are encrypted using a non-deterministic
      // algorithm (random salt), so encrypting the username again will not
      // produce a value that matches the DB. To reliably mark messages as
      // seen we first fetch candidate messages in the chat room (status !=
      // 'seen'), then decrypt `receiverId` in application code and update
      // only those message documents whose decrypted receiver matches the
      // viewer username.
      const candidates = await Chat.find({ chatRoomId, status: { $ne: 'seen' } })
        .select('_id receiverId')
        .lean();

      const idsToUpdate = [] as string[];
      for (const c of candidates) {
        try {
          const decryptedReceiver = decryptField(c.receiverId);
          if (decryptedReceiver === socket.username) {
            idsToUpdate.push(c._id.toString());
          }
        } catch (err) {
          console.warn('Failed to decrypt receiverId for candidate message', c._id, err);
        }
      }

      let modifiedCount = 0;
      if (idsToUpdate.length > 0) {
        const updateRes = await Chat.updateMany({ _id: { $in: idsToUpdate } }, { status: 'seen' });
        modifiedCount = updateRes.modifiedCount || 0;
      }

      console.log('  Database update result:', modifiedCount, 'messages updated');

      const senderSocketId = userSockets.get(username);
      if (senderSocketId) {
        console.log('  Notifying sender:', username, 'via socket:', senderSocketId);
        io.to(senderSocketId).emit('messages-seen-bulk', {
          from: socket.username,
          count: modifiedCount,
        });
      } else {
        console.log('  Sender', username, 'is not online');
      }
    } catch (error) {
      console.error('Messages seen bulk error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username}`);
    if (socket.username) {
      userSockets.delete(socket.username);
      
      for (const [key, pendingCall] of pendingCalls.entries()) {
        if (pendingCall.from === socket.username) {
          console.log(`📞 Cleaning up pending call from disconnected user ${socket.username}`);
          pendingCalls.delete(key);
        }
      }
    }
  });

  socket.on('delete-message-for-both', (data) => {
    try {
      const { messageId, to } = data;
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('message-deleted', { messageId });
      }
    } catch (err) {
      console.error('Error in delete-message-for-both socket relay:', err);
    }
  });

  socket.on('webrtc-call-offer', async (data) => {
    try {
      const { to, offer, callType, from } = data;
      console.log(`📞 Call offer from ${from} to ${to} (${callType})`);
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-call-offer', { from, offer, callType });
        socket.emit('webrtc-recipient-online', { to });
      } else {
        console.log(`📞 Recipient ${to} is offline, storing pending call and creating missed call`);
        const callKey = getPendingCallKey(from, to);
        pendingCalls.set(callKey, {
          from,
          to,
          offer,
          callType,
          timestamp: new Date(),
          iceCandidates: [],
          canceled: false,
        });
        socket.emit('webrtc-recipient-offline', { to });
        
        // Create missed call record when recipient is offline
        const missedCallType = callType === 'audio' ? 'voice' : 'video';
        await createMissedCall(from, to, missedCallType);
      }
    } catch (err) {
      console.error('Error in webrtc-call-offer:', err);
    }
  });
  
  socket.on('webrtc-call-cancel', (data) => {
    try {
      const { to, from } = data;
      console.log(`📞 Call canceled by ${from} to ${to}`);
      const callKey = getPendingCallKey(from, to);
      
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        pendingCalls.delete(callKey);
        io.to(recipientSocketId).emit('webrtc-call-cancel', { from });
      } else {
        const pendingCall = pendingCalls.get(callKey);
        if (pendingCall) {
          pendingCall.canceled = true;
          console.log(`📞 Marked pending call as canceled for offline recipient ${to}`);
        }
      }
    } catch (err) {
      console.error('Error in webrtc-call-cancel:', err);
    }
  });

  socket.on('webrtc-call-answer', (data) => {
    try {
      const { to, answer, from } = data;
      console.log(`📞 Call answer from ${from} to ${to}`);
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-call-answer', { from, answer });
      }
    } catch (err) {
      console.error('Error in webrtc-call-answer:', err);
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    try {
      const { to, candidate } = data;
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-ice-candidate', { from: socket.username, candidate });
      } else {
        const callKey = getPendingCallKey(socket.username!, to);
        const pendingCall = pendingCalls.get(callKey);
        if (pendingCall) {
          console.log(`📞 Buffering ICE candidate for pending call to ${to}`);
          pendingCall.iceCandidates.push(candidate);
        }
      }
    } catch (err) {
      console.error('Error in webrtc-ice-candidate:', err);
    }
  });

  socket.on('webrtc-call-reject', (data) => {
    try {
      const { to, from, reason } = data;
      console.log(`📞 Call rejected by ${from} to ${to}`);
      
      const callKey = getPendingCallKey(to, from);
      pendingCalls.delete(callKey);
      
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-call-reject', { from, reason });
      }
    } catch (err) {
      console.error('Error in webrtc-call-reject:', err);
    }
  });

  socket.on('webrtc-call-end', (data) => {
    try {
      const { to, from } = data;
      console.log(`📞 Call ended by ${from} to ${to}`);
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('webrtc-call-end', { from });
      }
    } catch (err) {
      console.error('Error in webrtc-call-end:', err);
    }
  });

  // Record missed call when call times out (unanswered)
  socket.on('record_missed_call', async (data) => {
    try {
      const { to, callType } = data;
      const from = socket.username;
      if (!from || !to || !callType) {
        console.log('📞 Invalid missed call data');
        return;
      }
      
      console.log(`📞 Recording missed call (timeout): ${from} -> ${to} (${callType})`);
      const missedCallType = callType === 'audio' ? 'voice' : 'video';
      await createMissedCall(from, to, missedCallType);
    } catch (err) {
      console.error('Error recording missed call:', err);
    }
  });

  // Reset missed calls by type - only when user clicks the specific call icon
  socket.on('reset_missed_calls_by_type', async (data) => {
    try {
      const { callerId, callType } = data;
      const receiverId = socket.username;
      
      if (!receiverId || !callerId || !callType) {
        console.log('📞 Invalid reset_missed_calls_by_type data');
        return;
      }
      
      if (!['voice', 'video'].includes(callType)) {
        console.log('📞 Invalid callType in reset_missed_calls_by_type');
        return;
      }
      
      console.log(`📞 Resetting ${callType} missed calls for ${receiverId} from ${callerId}`);
      
      const result = await MissedCall.updateMany(
        { receiverId, callerId, callType, isSeen: false },
        { isSeen: true }
      );
      
      console.log(`📞 Marked ${result.modifiedCount} ${callType} missed calls as seen`);
      
      // Send updated counts to receiver
      const counts = await getMissedCallCounts(receiverId);
      socket.emit('missed_call_update', counts);
    } catch (err) {
      console.error('Error resetting missed calls by type:', err);
    }
  });

  // Legacy reset_missed_calls - kept for backwards compatibility but now only used explicitly
  socket.on('reset_missed_calls', async (data) => {
    try {
      const { callerId } = data;
      const receiverId = socket.username;
      
      if (!receiverId || !callerId) {
        console.log('📞 Invalid reset_missed_calls data');
        return;
      }
      
      console.log(`📞 Resetting all missed calls for ${receiverId} from ${callerId}`);
      
      const result = await MissedCall.updateMany(
        { receiverId, callerId, isSeen: false },
        { isSeen: true }
      );
      
      console.log(`📞 Marked ${result.modifiedCount} missed calls as seen`);
      
      // Send updated counts
      const counts = await getMissedCallCounts(receiverId);
      socket.emit('missed_call_update', counts);
    } catch (err) {
      console.error('Error resetting missed calls:', err);
    }
  });

  // Get missed call counts on demand
  socket.on('get_missed_call_counts', async () => {
    try {
      if (!socket.username) return;
      
      const counts = await getMissedCallCounts(socket.username);
      socket.emit('missed_call_update', counts);
    } catch (err) {
      console.error('Error getting missed call counts:', err);
    }
  });

  // Self-destruct: Send message with auto-delete timer
  socket.on('send-self-destruct-message', async (data) => {
    try {
      const { to, message, messageType = 'text', mediaUrl = null, autoDeleteTimer = 30 } = data;
      
      const areFriends = await Connection.findOne({
        $or: [
          { sender: socket.username, receiver: to, status: 'accepted' },
          { sender: to, receiver: socket.username, status: 'accepted' }
        ]
      });

      if (!areFriends) {
        socket.emit('error', { message: 'You can only message friends' });
        return;
      }
      
      const chatRoomId = [socket.username, to].sort().join('_');
      const { encryptedMessage, chatPublicKey, chatPrivateKey } = await encryptMessageWithChatKeys(message, chatRoomId);
      const previousHash = await getPreviousMessageHash(chatRoomId);
      const timestamp = new Date();
      const hash = calculateMessageHash(
        chatRoomId,
        socket.username!,
        to,
        messageType,
        encryptedMessage,
        timestamp.toISOString(),
        previousHash
      );
      
      const block = await addMessageBlock(socket.username!, to, encryptedMessage);
      
      const chatMessage = await Chat.create({
        senderId: socket.username,
        receiverId: to,
        encryptedMessage,
        chatRoomId,
        messageType,
        mediaUrl,
        metadata: { isSelfDestruct: true },
        status: 'sent',
        blockIndex: block.index,
        hash,
        previousHash,
        chatPublicKey,
        chatPrivateKey,
        timestamp,
        selfDestruct: true,
        autoDeleteTimer,
      });

      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        const { serverDecrypt } = await import('./lib/chatCrypto.js');
        const chatEncrypted = serverDecrypt(encryptedMessage);
        
        io.to(recipientSocketId).emit('receive-self-destruct-message', {
          from: socket.username,
          messageId: chatMessage._id.toString(),
          encryptedMessage: chatEncrypted,
          chatPublicKey,
          chatPrivateKey,
          hash,
          previousHash,
          block: {
            index: block.index,
            timestamp: block.timestamp,
            hash: block.hash,
            prevHash: block.prevHash,
            payload: block.payload,
          },
          messageType,
          mediaUrl,
          autoDeleteTimer,
          selfDestruct: true,
        });
        
        await Chat.findByIdAndUpdate(chatMessage._id, { status: 'delivered' });
      }

      socket.emit('message-sent', {
        messageId: chatMessage._id.toString(),
        blockNumber: block.index,
        hash: block.hash,
        previousHash,
        timestamp: timestamp.toISOString(),
        selfDestruct: true,
        autoDeleteTimer,
      });

      console.log(`🔥 Self-destruct message sent: ${socket.username} -> ${to} (${autoDeleteTimer}s)`);
    } catch (error) {
      console.error('Send self-destruct message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Mark self-destruct message as viewed
  socket.on('message-viewed', async (data) => {
    try {
      const { messageId } = data;
      
      const result = await markMessageViewed(messageId, false);
      if (result) {
        const message = await Chat.findById(messageId).lean();
        if (message) {
          socket.emit('message-view-started', {
            messageId,
            viewTimestamp: result.viewTimestamp,
            deleteAt: result.deleteAt,
            autoDeleteTimer: result.autoDeleteTimer,
          });
          
          const senderSocketId = userSockets.get((message as any).senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('message-view-started', {
              messageId,
              viewTimestamp: result.viewTimestamp,
              deleteAt: result.deleteAt,
              autoDeleteTimer: result.autoDeleteTimer,
            });
          }
        }
      }
    } catch (error) {
      console.error('Message viewed error:', error);
    }
  });

  // Mark audio as played
  socket.on('audio-played', async (data) => {
    try {
      const { messageId } = data;
      
      const result = await markAudioPlayed(messageId);
      if (result) {
        const message = await Chat.findById(messageId).lean();
        if (message) {
          socket.emit('audio-play-started', {
            messageId,
            playTimestamp: result.playTimestamp,
            deleteAt: result.deleteAt,
            autoDeleteTimer: result.autoDeleteTimer,
          });
          
          const senderSocketId = userSockets.get((message as any).senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('audio-play-started', {
              messageId,
              playTimestamp: result.playTimestamp,
              deleteAt: result.deleteAt,
              autoDeleteTimer: result.autoDeleteTimer,
            });
          }
        }
      }
    } catch (error) {
      console.error('Audio played error:', error);
    }
  });

  // Screenshot detection alert
  socket.on('screenshot-detected', async (data) => {
    try {
      const { chatRoomId } = data;
      const [user1, user2] = chatRoomId.split('_');
      const otherUser = user1 === socket.username ? user2 : user1;
      
      const otherSocketId = userSockets.get(otherUser);
      if (otherSocketId) {
        io.to(otherSocketId).emit('screenshot-alert', {
          from: socket.username,
          chatRoomId,
          timestamp: new Date(),
        });
      }
      
      console.log(`📸 Screenshot detected by ${socket.username} in chat ${chatRoomId}`);
    } catch (error) {
      console.error('Screenshot detection error:', error);
    }
  });

  // Ghost mode messaging
  socket.on('ghost-send-message', async (data) => {
    try {
      const { sessionToken, sessionId, message, messageType = 'text' } = data;
      
      const ghostUser = await GhostUser.findOne({ username: socket.username });
      if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
        socket.emit('ghost-error', { message: 'Invalid ghost session' });
        return;
      }
      
      const session = await GhostChatSession.findOne({ sessionId, isActive: true });
      if (!session || !session.participants.includes(socket.username!)) {
        socket.emit('ghost-error', { message: 'Invalid session' });
        return;
      }
      
      const receiverId = session.participants.find(p => p !== socket.username);
      const encryptedPayload = encryptWithSessionKey(message, session.sessionKey);
      const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const ghostMessage = await GhostMessage.create({
        sessionId,
        senderId: socket.username,
        receiverId,
        encryptedPayload,
        messageType,
        autoDeleteTimer: 30,
        expireAt,
      });
      
      await GhostChatSession.findByIdAndUpdate(session._id, { lastActivity: new Date() });
      
      const recipientSocketId = userSockets.get(receiverId!);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('ghost-receive-message', {
          messageId: ghostMessage._id.toString(),
          sessionId,
          senderId: socket.username,
          content: message,
          messageType,
          autoDeleteTimer: 30,
          timestamp: ghostMessage.timestamp,
        });
      }
      
      socket.emit('ghost-message-sent', {
        messageId: ghostMessage._id.toString(),
        sessionId,
        timestamp: ghostMessage.timestamp,
      });
      
      console.log(`👻 Ghost message sent: ${socket.username} -> ${receiverId}`);
    } catch (error) {
      console.error('Ghost send message error:', error);
      socket.emit('ghost-error', { message: 'Failed to send ghost message' });
    }
  });

  // Ghost message viewed
  socket.on('ghost-message-viewed', async (data) => {
    try {
      const { sessionToken, messageId } = data;
      
      const ghostUser = await GhostUser.findOne({ username: socket.username });
      if (!ghostUser || ghostUser.ghostSessionToken !== sessionToken) {
        return;
      }
      
      const message = await GhostMessage.findById(messageId);
      if (!message || message.receiverId !== socket.username || message.viewed) {
        return;
      }
      
      const viewTimestamp = new Date();
      const deleteAt = new Date(viewTimestamp.getTime() + message.autoDeleteTimer * 1000);
      
      await GhostMessage.findByIdAndUpdate(messageId, {
        viewed: true,
        viewTimestamp,
        deleteAt,
      });
      
      const senderSocketId = userSockets.get(message.senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('ghost-message-view-started', {
          messageId,
          viewTimestamp,
          deleteAt,
          autoDeleteTimer: message.autoDeleteTimer,
        });
      }
      
      socket.emit('ghost-message-view-started', {
        messageId,
        viewTimestamp,
        deleteAt,
        autoDeleteTimer: message.autoDeleteTimer,
      });
    } catch (error) {
      console.error('Ghost message viewed error:', error);
    }
  });

  // Ghost mode activation notification (send to normal chat)
  socket.on('ghost-mode-activated', async (data) => {
    try {
      const { partnerId, pin, sessionId } = data;
      
      if (!socket.username || !partnerId) {
        return;
      }
      
      const notificationMessage = `👻 Ghost Mode activated by ${socket.username}, PIN: ${pin}`;
      
      const chatRoomId = [socket.username, partnerId].sort().join('_');
      
      const previousHash = await getPreviousMessageHash(chatRoomId);
      const hash = calculateMessageHash({
        senderId: 'LockBlip',
        receiverId: partnerId,
        content: notificationMessage,
        previousHash,
      });
      
      const { encryptedMessage, chatPublicKey, chatPrivateKey } = await encryptMessageWithChatKeys(notificationMessage, chatRoomId);
      
      const block = await addMessageBlock('LockBlip', partnerId, encryptedMessage);
      
      const chatMessage = await Chat.create({
        chatRoomId,
        senderId: 'LockBlip',
        receiverId: partnerId,
        encryptedMessage,
        hash,
        previousHash,
        messageType: 'text',
        status: 'delivered',
        blockIndex: block.index,
        chatPublicKey,
        chatPrivateKey,
        metadata: { isSystemMessage: true, isGhostModeNotification: true },
      });
      
      const recipientSocketId = userSockets.get(partnerId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('ghost-mode-invitation', {
          from: socket.username,
          pin,
          sessionId,
          timestamp: new Date(),
        });
        
        io.to(recipientSocketId).emit('receive-message', {
          id: chatMessage._id.toString(),
          senderId: 'LockBlip',
          receiverId: partnerId,
          content: notificationMessage,
          chatRoomId,
          timestamp: chatMessage.timestamp,
          encryptedMessage,
          chatPublicKey,
          chatPrivateKey,
        });
      }
      
      socket.emit('receive-message', {
        id: chatMessage._id.toString(),
        senderId: 'LockBlip',
        receiverId: partnerId,
        content: notificationMessage,
        chatRoomId,
        timestamp: chatMessage.timestamp,
        encryptedMessage,
        chatPublicKey,
        chatPrivateKey,
      });
      
      console.log(`👻 Ghost mode activation notification sent: ${socket.username} -> ${partnerId}`);
    } catch (error) {
      console.error('Ghost mode activation notification error:', error);
    }
  });

  // Ghost mode security events
  socket.on('ghost-security-event', async (data) => {
    try {
      const { sessionId, eventType, deviceType = 'desktop' } = data;
      
      if (!socket.username) return;
      
      const GhostAccessLog = (await import('./models/GhostAccessLog.js')).default;
      
      await GhostAccessLog.create({
        sessionId,
        userId: socket.username,
        eventType,
        deviceType,
        timestamp: new Date(),
      });
      
      const session = await GhostChatSession.findOne({ sessionId, isActive: true });
      if (session) {
        const partnerId = session.participants.find(p => p !== socket.username);
        if (partnerId) {
          const partnerSocketId = userSockets.get(partnerId);
          if (partnerSocketId) {
            io.to(partnerSocketId).emit('ghost-partner-security-alert', {
              from: socket.username,
              sessionId,
              eventType,
              timestamp: new Date(),
            });
          }
        }
      }
      
      console.log(`🔒 Ghost security event: ${socket.username} - ${eventType}`);
    } catch (error) {
      console.error('Ghost security event error:', error);
    }
  });

  // Ghost mode partner joined notification
  socket.on('ghost-partner-joined', async (data) => {
    try {
      const { sessionId, partnerId } = data;
      
      if (!socket.username) return;
      
      const partnerSocketId = userSockets.get(partnerId);
      if (partnerSocketId) {
        io.to(partnerSocketId).emit('ghost-session-ready', {
          sessionId,
          partner: socket.username,
          timestamp: new Date(),
        });
      }
      
      console.log(`👻 Ghost session ready: ${socket.username} <-> ${partnerId}`);
    } catch (error) {
      console.error('Ghost partner joined error:', error);
    }
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

(async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swapchat';
    await mongoose.connect(MONGODB_URI);
    console.log('✓ MongoDB connected');
    
    await initializeBlockchain();
    console.log('✓ Blockchain initialized');
    
    startDeletionWorker(io, userSockets);
    console.log('✓ Deletion worker started');
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const initialPort = parseInt(process.env.PORT || '5000', 10);
  const startServer = async (port: number) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const listenOptions: any = { port, host: '0.0.0.0' };
      if (process.platform !== 'win32') {
        listenOptions.reusePort = true;
      }
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (err: any) => {
            server.off('listening', onListening);
            reject(err);
          };
          const onListening = () => {
            server.off('error', onError);
            resolve();
          };
          server.once('error', onError);
          server.once('listening', onListening);
          server.listen(listenOptions);
        });
        process.env.PORT = String(port);
        console.log(`✓ Server running on port ${port}`);
        return;
      } catch (err: any) {
        if (err && err.code === 'EADDRINUSE') {
          console.warn(`⚠️  Port ${port} in use, trying ${port + 1}...`);
          port = port + 1;
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Unable to start server: ports ${initialPort}-${initialPort + 9} are in use`);
  };

  await startServer(initialPort);
})();

export default server;
