# LockBlip - Blockchain Messaging Platform

## Overview

LockBlip is a secure messaging application that leverages blockchain technology to create an immutable, verifiable message ledger. Every message sent through the platform becomes a block in a cryptographic chain, ensuring message integrity and providing end-to-end encryption. The platform combines traditional secure messaging features with blockchain-based verification, offering users a unique trust model where message history is cryptographically provable.

The application uses MongoDB for data persistence, Socket.IO for real-time bidirectional communication, and implements both blockchain-based message integrity and end-to-end encryption using NaCl (TweetNaCl).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- TanStack Query (React Query) for server state management and caching
- Wouter for lightweight client-side routing
- Tailwind CSS with shadcn/ui components for consistent design system

**Design System:**
- Dark-mode first approach with blockchain-themed aesthetics
- Custom color palette emphasizing trust and security (Swapgreen primary, Coral secondary)
- Inter font for UI/body text, JetBrains Mono for technical/blockchain data
- Component library from shadcn/ui (Radix UI primitives)

**State Management Pattern:**
- React Query for server state with aggressive caching strategies
- Local state with React hooks for UI-specific state
- LocalStorage for authentication tokens and user data persistence
- Real-time updates via Socket.IO event listeners

**Key Frontend Features:**
- Real-time messaging with Socket.IO client
- Blockchain ledger visualization
- Stories feature (24-hour ephemeral content)
- Friend/connection management system
- Profile management with image uploads
- Multi-media message support (images, videos, audio, documents, location, contacts, polls)

### Backend Architecture

**Technology Stack:**
- Node.js with Express framework
- TypeScript for type safety (though some legacy .js files exist)
- MongoDB with Mongoose ODM for data modeling
- Socket.IO for WebSocket-based real-time communication
- JWT for authentication with cookie-based session management

**Authentication & Security:**
- Multi-factor authentication with email OTP verification
- IP-based authorization system requiring email confirmation for new IPs
- Google OAuth integration as alternative authentication method
- Password hashing with bcrypt
- Field-level encryption using AES (CryptoJS) for sensitive data
- JWT tokens stored in HTTP-only cookies

**Blockchain Implementation:**
- Custom blockchain implementation for message verification
- Each message creates a new block with SHA-256 hashing
- Blocks contain: index, timestamp, sender, receiver, encrypted payload, previous hash, current hash
- Genesis block initialization on first application start
- Chain validation ensures message integrity

**Encryption Strategy:**
- **Field-level encryption**: Sensitive user data (email, phone, username, etc.) encrypted at rest using AES
- **Chat encryption**: Per-chat-room key pairs using NaCl (Curve25519) for end-to-end encryption
- **Message encryption**: Messages encrypted with chat-specific keys before blockchain insertion
- **Key management**: Chat key pairs stored encrypted in database, decrypted server-side when needed

**Real-time Communication:**
- Socket.IO for bidirectional event-based communication
- Authenticated socket connections with JWT verification
- Real-time message delivery with delivery/read receipts
- Online/offline status tracking
- Typing indicators support

**API Structure:**
- RESTful endpoints under `/api` prefix
- Rate limiting (100 requests per 15 minutes)
- CORS configuration for cross-origin requests
- Proxy-aware IP handling for proper client identification

**Routes:**
- `/api/auth` - Authentication (login, register, OTP, IP authorization, Google OAuth)
- `/api/users` - User management (profile, contacts, search)
- `/api/blockchain` - Blockchain operations (ledger retrieval, validation)
- `/api/stories` - Stories CRUD operations
- `/api/connections` - Friend requests and connection management
- `/api/chats` - Message retrieval and chat operations
- `/api/uploads` - File upload handling

### Database Design

**MongoDB Collections:**
- **users**: User profiles with encrypted PII, public/private keys, authorized IPs
- **blocks**: Blockchain ledger with encrypted message payloads
- **chats**: Message history with chat-room-based encryption
- **chatkeypairs**: Encryption key pairs per chat room
- **connections**: Friend/connection relationships with status tracking
- **otps**: Temporary OTP codes for email verification
- **ipauthorizations**: Pending IP authorization requests
- **stories**: 24-hour ephemeral content with TTL indexes
- **storyviews**: Story view tracking with viewer information

**Data Encryption Pattern:**
- Mongoose getter/setter functions for automatic field encryption/decryption
- Master encryption key from environment variable
- Encrypted fields transparent to application logic layer

**Indexing Strategy:**
- Unique indexes on critical fields (username, block hash, chat room ID)
- Compound indexes for query optimization (sender/receiver pairs)
- TTL indexes for automatic document expiration (OTPs, stories)

## External Dependencies

### Third-Party Services

**Google OAuth:**
- OAuth 2.0 authentication integration
- Client ID and secret stored in Replit Secrets
- Authorized domains must be configured in Google Cloud Console
- Used for social login alternative to traditional email/password

**Email Service:**
- Nodemailer for transactional emails
- Supports both SMTP and Gmail service configurations
- OTP delivery for email verification
- IP authorization confirmation emails
- Graceful fallback in development when SMTP not configured

### Database

**MongoDB:**
- Primary data store using Mongoose ODM
- Connection via `MONGODB_URI` environment variable
- Currently not using PostgreSQL despite Drizzle config presence
- Collections manually created via migration scripts

### Key NPM Packages

**Security & Cryptography:**
- `bcryptjs` - Password hashing
- `tweetnacl` / `tweetnacl-util` - End-to-end encryption (NaCl)
- `crypto-js` - Field-level AES encryption
- `jsonwebtoken` - JWT token generation/validation
- `helmet` - HTTP security headers

**Backend Framework:**
- `express` - Web framework
- `socket.io` - WebSocket server
- `mongoose` - MongoDB ODM
- `multer` - File upload handling
- `express-rate-limit` - API rate limiting
- `cookie-parser` - Cookie handling
- `cors` - CORS middleware

**Frontend Libraries:**
- `@tanstack/react-query` - Server state management
- `wouter` - Routing
- `socket.io-client` - WebSocket client
- `@react-oauth/google` - Google OAuth components
- `@radix-ui/*` - UI primitives (via shadcn/ui)
- `date-fns` - Date formatting

**Development Tools:**
- `vite` - Build tool and dev server
- `typescript` - Type checking
- `tsx` - TypeScript execution
- `tailwindcss` - Utility-first CSS
- `drizzle-kit` - Database migration tool (configured but not actively used)

### Environment Variables Required

**Essential:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT signing
- `ENCRYPTION_MASTER_KEY` - Master key for field encryption (min 32 chars)

**OAuth:**
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `VITE_GOOGLE_CLIENT_ID` - Client-side Google client ID

**Email (Optional):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - SMTP configuration
- OR `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASSWORD` - Gmail configuration

**Deployment:**
- `REPLIT_DEV_DOMAIN` - Replit deployment domain (auto-set on Replit)
- `DATABASE_URL` - PostgreSQL URL (Drizzle config, not currently used)