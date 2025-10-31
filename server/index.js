import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import blockchainRoutes from './routes/blockchain.js';
import debugRoutes from './routes/debug.js';
import { initializeBlockchain, addMessageBlock } from './lib/blockchain.js';
import { authenticateSocket } from './middleware/auth.js';
import { setupVite, serveStatic } from './vite.js';

const app = express();
const server = createServer(app);

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

// If running behind a proxy (nginx, cloudflare, etc.), trust the proxy so
// req.ip and X-Forwarded-For are handled correctly. Set to true for now;
// adjust in production to specific proxy IPs or CIDR if needed.
app.set('trust proxy', true);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✓ MongoDB connected');
  await initializeBlockchain();
  console.log('✓ Blockchain initialized');
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/debug', debugRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.use(authenticateSocket);

const userSockets = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.username}`);
  userSockets.set(socket.username, socket.id);

  socket.emit('connected', { username: socket.username });

  socket.on('send-message', async (data) => {
    try {
      const { to, encryptedPayload } = data;
      
      const block = await addMessageBlock(
        socket.username,
        to,
        encryptedPayload
      );

      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive-message', {
          from: socket.username,
          block: {
            index: block.index,
            timestamp: block.timestamp,
            hash: block.hash,
            prevHash: block.prevHash,
            payload: block.payload,
          },
        });
      }

      socket.emit('message-sent', {
        blockNumber: block.index,
        hash: block.hash,
        timestamp: block.timestamp,
      });

      console.log(`Message block #${block.index} created: ${socket.username} -> ${to}`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username}`);
    userSockets.delete(socket.username);
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

(async () => {
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port: PORT,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`✓ Server running on port ${PORT}`);
  });
})();

export default server;
