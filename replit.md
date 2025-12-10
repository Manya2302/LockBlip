# Lockblip - Secure Chat Application

## Overview
Lockblip is a secure, end-to-end encrypted chat application with blockchain-backed message verification. It features military-grade encryption, WebRTC video calls, stories, and a blockchain ledger for message integrity.

**Last Updated:** December 10, 2025

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

## Recent Changes (Dec 10, 2025)
- **AI Summarize Button Fix**:
  - Fixed race condition where messages marked as "seen" prevented AI summarization button from appearing
  - Capture initial unread count before socket emits "messages_seen" event
  - Use Math.max(initialUnreadCount, unreadCount) to ensure button shows when threshold is met
  - Button properly resets state when switching between contacts

- **Live Location Error Handling**:
  - Added fallback presets (15min, 1hour, 8hours) when API fetch fails
  - Enhanced 401/403 auth error messages with actionable user feedback
  - Improved error handling in start location sharing flow

## Recent Changes (Dec 8, 2025)
- **Self-Destructing Communication System**:
  - Auto-delete timers (5s, 10s, 30s, 1m, 5m, 1h, 24h, view-once)
  - Messages auto-delete after being viewed + timer expires
  - Background deletion worker runs every 10 seconds
  - Visual countdown timers and burn effect animations
  - Media (images, videos, audio) support with view/play tracking
  - Socket-based real-time deletion notifications

- **Ghost Mode Chat System**:
  - Completely isolated encrypted chat sessions
  - System-generated 6-digit PINs (no manual PIN editing allowed)
  - Per-session AES-256 encryption keys that rotate on session start/end
  - **Mandatory Disclaimer Agreement**: Users must accept confidentiality warning before activation
  - **Auto-PIN Generation & Sharing**: System generates PIN and auto-sends message in normal chat
  - Dark neon UI with Matrix rain effect
  - All messages auto-expire after 24 hours (TTL indexes)
  - No message persistence - complete invisibility
  - Screenshot detection with privacy blur overlay
  - Session heartbeat for automatic termination
  - **No Profile Setup Required**: Ghost Mode auto-creates user record on first activation
  - **GhostChatAccess Table**: Stores {user_id, partner_id, pin_hash, created_at, expire_at, device_type}
  - **Access Logging**: Full visibility logs with disclaimer_agreed status
  - **Re-authentication**: PIN re-auth required on idle timeout or visibility change
  - **Cross-Platform Security**: Equal security on mobile and desktop (blur on window switch, auto-lock on idle)

## Recent Changes (Dec 4, 2025)
- **Missed Call Tracking System** (WhatsApp-style):
  - Per-user, per-sender, per-call-type badge counting
  - 45-second timeout for unanswered calls
  - Automatic missed call recording for offline/rejected/timeout calls
  - Red badges on voice/video call icons in ChatWindow
  - Missed Call History page (`/missed-calls`) replaces View Blockchain Ledger
  - Real-time sync across devices via Socket.io
  - Badge reset only when clicking specific call type icon (not on chat open)
  - Single system message per missed call ("Missed voice/video call")
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
3. **WebRTC Video Calls:** Peer-to-peer video/audio calls with missed call tracking
4. **Missed Call Tracking:** WhatsApp-style missed call badges with per-sender isolation
5. **Self-Destructing Messages:** Auto-delete timers with view-once support
6. **Ghost Mode:** Completely invisible encrypted chat sessions
7. **Stories:** Instagram-style stories with view tracking
8. **IP Authorization:** Device authorization system for added security
9. **OTP Verification:** Email-based one-time password verification

## Database Schema
The application uses MongoDB with Mongoose models:
- **User:** Encrypted user data with public/private key pairs
- **Chat:** Encrypted messages with blockchain references, self-destruct fields
- **Connection:** Friend connections and requests
- **Blockchain:** Message blockchain ledger
- **Story:** User stories with expiration
- **OTP:** One-time passwords for verification
- **IPAuthorization:** Authorized device tracking
- **MissedCall:** Missed call tracking with caller_id, receiver_id, call_type, is_seen
- **GhostChatSession:** Isolated ghost chat sessions with per-session encryption keys
- **GhostMessage:** Ghost mode messages with TTL indexes for auto-expiry
- **GhostUser:** PIN authentication storage for ghost mode access
- **GhostChatAccess:** PIN sharing and access control with user_id, partner_id, pin_hash, device_type, expire_at
- **GhostAccessLog:** Access event logging (no message content) for visibility and audit trails

## Known Issues
- WebGL not available in Replit environment (3D landing page falls back to 2D)
- Some TypeScript warnings for JavaScript module imports (non-critical)

## User Preferences
None documented yet.

## Notes
- The app uses an external MongoDB Atlas database (not Replit's built-in database)
- All sensitive data is encrypted at rest using AES-256-GCM
- Messages are verified using blockchain hashing for tamper detection
