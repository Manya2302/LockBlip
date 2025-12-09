import LiveLocation from '../models/LiveLocation.js';
import { decryptField } from '../lib/encryption.js';

let locationWorkerInterval = null;
let io = null;
let userSockets = null;

export function initializeLocationWorker(socketIo, userSocketsMap) {
  io = socketIo;
  userSockets = userSocketsMap;
}

export function startLocationExpiryWorker(intervalMs = 30000) {
  if (locationWorkerInterval) {
    console.log('Location expiry worker already running');
    return;
  }

  console.log('✓ Location expiry worker started');

  locationWorkerInterval = setInterval(async () => {
    try {
      await processExpiredSessions();
      await processStationaryAlerts();
    } catch (error) {
      console.error('Location expiry worker error:', error);
    }
  }, intervalMs);
}

export function stopLocationExpiryWorker() {
  if (locationWorkerInterval) {
    clearInterval(locationWorkerInterval);
    locationWorkerInterval = null;
    console.log('Location expiry worker stopped');
  }
}

async function processExpiredSessions() {
  const now = new Date();
  
  const expiredSessions = await LiveLocation.find({
    status: 'active',
    expiryAt: { $lte: now },
  });

  for (const session of expiredSessions) {
    try {
      session.status = 'expired';
      session.stoppedAt = now;
      session.stoppedReason = 'expired';
      await session.save();

      console.log(`📍 Location session ${session.sessionId} expired`);

      if (io && userSockets) {
        try {
          const username = decryptField(session.username);
          const sharerSocketId = userSockets.get(username);
          if (sharerSocketId) {
            io.to(sharerSocketId).emit('live-location-expired', {
              sessionId: session.sessionId,
            });
          }

          for (const viewer of session.viewers) {
            try {
              const viewerUsername = decryptField(viewer);
              const viewerSocketId = userSockets.get(viewerUsername);
              if (viewerSocketId) {
                io.to(viewerSocketId).emit('live-location-ended', {
                  sessionId: session.sessionId,
                  sharer: username,
                  reason: 'expired',
                });
              }
            } catch (e) {
              console.warn('Failed to notify viewer of expired session');
            }
          }
        } catch (e) {
          console.warn('Failed to send expiry notifications');
        }
      }

      setTimeout(async () => {
        try {
          await LiveLocation.findByIdAndDelete(session._id);
          console.log(`📍 Cleaned up expired session ${session.sessionId}`);
        } catch (e) {
          console.warn('Failed to cleanup expired session:', e);
        }
      }, 60000);

    } catch (error) {
      console.error(`Error processing expired session ${session.sessionId}:`, error);
    }
  }
}

async function processStationaryAlerts() {
  const activeSessions = await LiveLocation.find({
    status: 'active',
    stationaryAlertSent: false,
  });

  const now = new Date();

  for (const session of activeSessions) {
    try {
      const timeSinceMovement = now.getTime() - new Date(session.lastMovementTime).getTime();
      
      if (timeSinceMovement >= session.stationaryThreshold) {
        console.log(`📍 Stationary alert for session ${session.sessionId}`);

        session.stationaryAlertSent = true;
        await session.save();

        if (io && userSockets) {
          try {
            const username = decryptField(session.username);
            const sharerSocketId = userSockets.get(username);
            if (sharerSocketId) {
              io.to(sharerSocketId).emit('stationary-detected', {
                sessionId: session.sessionId,
                duration: timeSinceMovement,
                lastLocation: session.getCurrentLocation(),
              });
            }

            for (const viewer of session.viewers) {
              try {
                const viewerUsername = decryptField(viewer);
                const viewerSocketId = userSockets.get(viewerUsername);
                if (viewerSocketId) {
                  io.to(viewerSocketId).emit('sharer-stationary', {
                    sessionId: session.sessionId,
                    sharer: username,
                    duration: timeSinceMovement,
                    lastLocation: session.getCurrentLocation(),
                  });
                }
              } catch (e) {
                console.warn('Failed to notify viewer of stationary status');
              }
            }

            for (const contact of session.emergencyContacts) {
              try {
                const contactUsername = decryptField(contact);
                const contactSocketId = userSockets.get(contactUsername);
                if (contactSocketId) {
                  io.to(contactSocketId).emit('emergency-stationary-alert', {
                    sessionId: session.sessionId,
                    sharer: username,
                    duration: timeSinceMovement,
                    lastLocation: session.getCurrentLocation(),
                    message: `⚠️ ${username} has been stationary for an extended period`,
                  });
                }
              } catch (e) {
                console.warn('Failed to notify emergency contact');
              }
            }
          } catch (e) {
            console.warn('Failed to process stationary notifications');
          }
        }
      }
    } catch (error) {
      console.error(`Error processing stationary check for session ${session.sessionId}:`, error);
    }
  }
}

export async function cleanupOldSessions(retentionDays = 1) {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const result = await LiveLocation.deleteMany({
    status: { $in: ['expired', 'stopped'] },
    stoppedAt: { $lte: cutoffDate },
  });

  console.log(`📍 Cleaned up ${result.deletedCount} old location sessions`);
  return result.deletedCount;
}
