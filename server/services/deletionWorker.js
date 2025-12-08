import Chat from '../models/Chat.js';
import GhostMessage from '../models/GhostMessage.js';
import fs from 'fs';
import path from 'path';

const DELETION_INTERVAL = 10000;
const BATCH_SIZE = 100;

let deletionWorkerRunning = false;
let deletionInterval = null;
let ioInstance = null;
let userSocketsRef = null;

async function deleteMediaFile(mediaUrl) {
  if (!mediaUrl) return;
  
  try {
    if (mediaUrl.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), mediaUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted media file: ${filePath}`);
      }
    }
  } catch (error) {
    console.error('Error deleting media file:', error);
  }
}

async function processSelfDestructMessages() {
  try {
    const now = new Date();
    
    const messagesToDelete = await Chat.find({
      selfDestruct: true,
      viewed: true,
      deleteAt: { $lte: now },
      isDeleted: false,
    }).limit(BATCH_SIZE).lean();
    
    for (const message of messagesToDelete) {
      try {
        if (message.mediaUrl) {
          await deleteMediaFile(message.mediaUrl);
        }
        
        await Chat.findByIdAndUpdate(message._id, {
          isDeleted: true,
          encryptedMessage: '[Message deleted]',
          mediaUrl: null,
        });
        
        if (ioInstance && userSocketsRef) {
          const senderSocketId = userSocketsRef.get(message.senderId);
          const receiverSocketId = userSocketsRef.get(message.receiverId);
          
          const deleteEvent = {
            messageId: message._id.toString(),
            chatRoomId: message.chatRoomId,
            reason: 'self_destruct',
          };
          
          if (senderSocketId) {
            ioInstance.to(senderSocketId).emit('message-self-destructed', deleteEvent);
          }
          if (receiverSocketId) {
            ioInstance.to(receiverSocketId).emit('message-self-destructed', deleteEvent);
          }
        }
        
        console.log(`🔥 Self-destructed message: ${message._id}`);
      } catch (error) {
        console.error(`Error deleting message ${message._id}:`, error);
      }
    }
    
    return messagesToDelete.length;
  } catch (error) {
    console.error('Error processing self-destruct messages:', error);
    return 0;
  }
}

async function processGhostMessages() {
  try {
    const now = new Date();
    
    const messagesToDelete = await GhostMessage.find({
      viewed: true,
      deleteAt: { $lte: now },
      isDeleted: false,
    }).limit(BATCH_SIZE).lean();
    
    for (const message of messagesToDelete) {
      try {
        if (message.encryptedMediaUrl) {
          await deleteMediaFile(message.encryptedMediaUrl);
        }
        
        await GhostMessage.findByIdAndUpdate(message._id, {
          isDeleted: true,
          encryptedPayload: '[Ghost message deleted]',
          encryptedMediaUrl: null,
        });
        
        if (ioInstance && userSocketsRef) {
          const senderSocketId = userSocketsRef.get(message.senderId);
          const receiverSocketId = userSocketsRef.get(message.receiverId);
          
          const deleteEvent = {
            messageId: message._id.toString(),
            sessionId: message.sessionId,
            reason: 'ghost_auto_delete',
          };
          
          if (senderSocketId) {
            ioInstance.to(senderSocketId).emit('ghost-message-deleted', deleteEvent);
          }
          if (receiverSocketId) {
            ioInstance.to(receiverSocketId).emit('ghost-message-deleted', deleteEvent);
          }
        }
        
        console.log(`👻 Ghost message deleted: ${message._id}`);
      } catch (error) {
        console.error(`Error deleting ghost message ${message._id}:`, error);
      }
    }
    
    return messagesToDelete.length;
  } catch (error) {
    console.error('Error processing ghost messages:', error);
    return 0;
  }
}

async function processAudioPlayback() {
  try {
    const now = new Date();
    
    const audioMessages = await Chat.find({
      messageType: 'audio',
      selfDestruct: true,
      playTimestamp: { $ne: null },
      deleteAt: null,
      isDeleted: false,
    }).limit(BATCH_SIZE);
    
    for (const message of audioMessages) {
      const playTime = new Date(message.playTimestamp);
      const deleteTime = new Date(playTime.getTime() + (message.autoDeleteTimer || 30) * 1000);
      
      if (deleteTime <= now) {
        if (message.mediaUrl) {
          await deleteMediaFile(message.mediaUrl);
        }
        
        await Chat.findByIdAndUpdate(message._id, {
          isDeleted: true,
          encryptedMessage: '[Audio deleted]',
          mediaUrl: null,
        });
        
        if (ioInstance && userSocketsRef) {
          const senderSocketId = userSocketsRef.get(message.senderId);
          const receiverSocketId = userSocketsRef.get(message.receiverId);
          
          const deleteEvent = {
            messageId: message._id.toString(),
            chatRoomId: message.chatRoomId,
            reason: 'audio_playback_complete',
          };
          
          if (senderSocketId) {
            ioInstance.to(senderSocketId).emit('message-self-destructed', deleteEvent);
          }
          if (receiverSocketId) {
            ioInstance.to(receiverSocketId).emit('message-self-destructed', deleteEvent);
          }
        }
        
        console.log(`🎵 Audio message deleted after playback: ${message._id}`);
      }
    }
  } catch (error) {
    console.error('Error processing audio playback deletions:', error);
  }
}

async function runDeletionWorker() {
  if (!deletionWorkerRunning) return;
  
  try {
    const regularDeleted = await processSelfDestructMessages();
    const ghostDeleted = await processGhostMessages();
    await processAudioPlayback();
    
    if (regularDeleted > 0 || ghostDeleted > 0) {
      console.log(`🗑️ Deletion worker: ${regularDeleted} regular, ${ghostDeleted} ghost messages processed`);
    }
  } catch (error) {
    console.error('Deletion worker error:', error);
  }
}

export function startDeletionWorker(io, userSockets) {
  if (deletionWorkerRunning) {
    console.log('Deletion worker already running');
    return;
  }
  
  ioInstance = io;
  userSocketsRef = userSockets;
  deletionWorkerRunning = true;
  
  deletionInterval = setInterval(runDeletionWorker, DELETION_INTERVAL);
  
  console.log('🗑️ Deletion worker started');
}

export function stopDeletionWorker() {
  if (deletionInterval) {
    clearInterval(deletionInterval);
    deletionInterval = null;
  }
  deletionWorkerRunning = false;
  console.log('🗑️ Deletion worker stopped');
}

export async function scheduleMessageDeletion(messageId, deleteAfterSeconds) {
  try {
    const deleteAt = new Date(Date.now() + deleteAfterSeconds * 1000);
    await Chat.findByIdAndUpdate(messageId, {
      deleteAt,
      selfDestruct: true,
    });
    console.log(`⏱️ Message ${messageId} scheduled for deletion at ${deleteAt}`);
    return true;
  } catch (error) {
    console.error('Error scheduling message deletion:', error);
    return false;
  }
}

export async function markMessageViewed(messageId, isGhost = false) {
  try {
    const Model = isGhost ? GhostMessage : Chat;
    const message = await Model.findById(messageId);
    
    if (!message || message.viewed) return null;
    
    const viewTimestamp = new Date();
    const autoDeleteTimer = message.autoDeleteTimer || 30;
    const deleteAt = new Date(viewTimestamp.getTime() + autoDeleteTimer * 1000);
    
    await Model.findByIdAndUpdate(messageId, {
      viewed: true,
      viewTimestamp,
      deleteAt,
    });
    
    console.log(`👁️ Message ${messageId} marked as viewed, deleting at ${deleteAt}`);
    
    return {
      viewTimestamp,
      deleteAt,
      autoDeleteTimer,
    };
  } catch (error) {
    console.error('Error marking message as viewed:', error);
    return null;
  }
}

export async function markAudioPlayed(messageId) {
  try {
    const message = await Chat.findById(messageId);
    
    if (!message || message.playTimestamp) return null;
    
    const playTimestamp = new Date();
    const autoDeleteTimer = message.autoDeleteTimer || 30;
    const deleteAt = new Date(playTimestamp.getTime() + autoDeleteTimer * 1000);
    
    await Chat.findByIdAndUpdate(messageId, {
      playTimestamp,
      deleteAt,
    });
    
    console.log(`🎵 Audio ${messageId} started playing, deleting at ${deleteAt}`);
    
    return {
      playTimestamp,
      deleteAt,
      autoDeleteTimer,
    };
  } catch (error) {
    console.error('Error marking audio as played:', error);
    return null;
  }
}

export default {
  startDeletionWorker,
  stopDeletionWorker,
  scheduleMessageDeletion,
  markMessageViewed,
  markAudioPlayed,
};
