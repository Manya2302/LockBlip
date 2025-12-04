# Lockblip - Secure Chat Application

## Overview
Lockblip is a secure, end-to-end encrypted chat application with blockchain-backed message verification. It features military-grade encryption, WebRTC video calls, stories, and a blockchain ledger for message integrity.

**Last Updated:** December 4, 2025

## Tech Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Express.js + Socket.io + TypeScript
- **Database:** MongoDB (Mongoose)
- **Real-time:** Socket.io for messaging, WebRTC for video calls
- **Security:** End-to-end encryption with TweetNaCl, blockchain message verification

## Project Structure
```
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities
│   └── index.html
├── server/              # Express backend
│   ├── routes/          # API routes
│   ├── models/          # Mongoose models
│   ├── lib/             # Server utilities (encryption, blockchain)
│   └── middleware/      # Auth middleware
├── shared/              # Shared types and schemas
└── uploads/             # User uploaded files
```

## Recent Changes (Dec 4, 2025)
- Migrated project to Replit environment
- Configured environment variables in Replit secrets
- Moved `cross-env` to dependencies for production compatibility
- Set up workflow for development server on port 5000
- Configured deployment settings for autoscale deployment
- Vite configured with host 0.0.0.0:5000 for Replit proxy compatibility

## Environment Setup

### Required Environment Variables
All environment variables are configured in Replit's shared environment:
- `MONGODB_URI` - MongoDB connection string (external MongoDB Atlas)
- `JWT_SECRET` - Secret for JWT token generation
- `ENCRYPTION_MASTER_KEY` - Master key for field encryption
- `HCAPTCHA_SECRET_KEY` - hCaptcha server-side secret
- `VITE_HCAPTCHA_SITE_KEY` - hCaptcha client-side site key
- `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASSWORD` - Email configuration for OTP
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` - SMTP settings
- `NODE_ENV` - Environment mode (development/production)

### Replit-Managed Environment Variables
These are automatically provided by Replit:
- `REPLIT_DEV_DOMAIN` - Used for CORS and WebSocket origin validation
- `PORT` - Server port (defaults to 5000 if not set)
- `SESSION_SECRET`, `REPLIT_DOMAINS`, `REPL_ID` - Replit infrastructure variables

### Development Workflow
The application runs a combined frontend + backend server:
- **Command:** `npm run dev`
- **Port:** 5000 (both frontend and backend)
- **Process:** Vite dev server with Express backend integration

### Deployment Configuration
- **Target:** Autoscale (stateless web application)
- **Build:** `npm run build` (Vite build + esbuild for server)
- **Run:** `npm start` (production mode)
- **Output:** `dist/public` for frontend, `dist/index.js` for server

## Key Features
1. **End-to-End Encryption:** Messages encrypted with TweetNaCl before storage
2. **Blockchain Verification:** Each message is recorded in a blockchain ledger
3. **WebRTC Video Calls:** Peer-to-peer video/audio calls
4. **Stories:** Instagram-style stories with view tracking
5. **IP Authorization:** Device authorization system for added security
6. **OTP Verification:** Email-based one-time password verification

## Database Schema
The application uses MongoDB with Mongoose models:
- **User:** Encrypted user data with public/private key pairs
- **Chat:** Encrypted messages with blockchain references
- **Connection:** Friend connections and requests
- **Blockchain:** Message blockchain ledger
- **Story:** User stories with expiration
- **OTP:** One-time passwords for verification
- **IPAuthorization:** Authorized device tracking

## Known Issues
- WebGL not available in Replit environment (3D landing page falls back to 2D)
- Some TypeScript warnings for JavaScript module imports (non-critical)

## User Preferences
None documented yet.

## Notes
- The app uses an external MongoDB Atlas database (not Replit's built-in database)
- All sensitive data is encrypted at rest using AES-256-GCM
- Messages are verified using blockchain hashing for tamper detection
