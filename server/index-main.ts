
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
import { initializeBlockchain, addMessageBlock } from './lib/blockchain.js';
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.use(authenticateSocket);

const userSockets = new Map<string, string>();

io.on('connection', (socket: AuthenticatedSocket) => {
  console.log(`User connected: ${socket.username}`);
  if (socket.username) {
    userSockets.set(socket.username, socket.id);
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
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: any = { port: PORT, host: "0.0.0.0" };
  // reusePort isn't supported on some Windows builds / environments. Only enable it on non-Windows.
  if (process.platform !== 'win32') {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    console.log(`✓ Server running on port ${PORT}`);
  });
})();

export default server;
