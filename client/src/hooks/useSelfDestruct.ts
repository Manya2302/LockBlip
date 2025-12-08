import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface SelfDestructMessage {
  messageId: string;
  viewTimestamp: Date | null;
  deleteAt: Date | null;
  autoDeleteTimer: number;
  remainingTime: number;
}

interface UseSelfDestructOptions {
  socket: Socket | null;
  onMessageDeleted?: (messageId: string) => void;
  onScreenshotAlert?: (from: string) => void;
}

export function useSelfDestruct(options: UseSelfDestructOptions) {
  const { socket } = options;
  const [activeTimers, setActiveTimers] = useState<Map<string, SelfDestructMessage>>(new Map());
  const intervalRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const sendSelfDestructMessage = useCallback((
    to: string,
    message: string,
    autoDeleteTimer: number = 30,
    messageType: string = 'text',
    mediaUrl: string | null = null
  ) => {
    if (!socket) return;
    
    socket.emit('send-self-destruct-message', {
      to,
      message,
      messageType,
      mediaUrl,
      autoDeleteTimer,
    });
  }, [socket]);

  const markMessageViewed = useCallback((messageId: string) => {
    if (!socket) return;
    socket.emit('message-viewed', { messageId });
  }, [socket]);

  const markAudioPlayed = useCallback((messageId: string) => {
    if (!socket) return;
    socket.emit('audio-played', { messageId });
  }, [socket]);

  const reportScreenshot = useCallback((chatRoomId: string) => {
    if (!socket) return;
    socket.emit('screenshot-detected', { chatRoomId });
  }, [socket]);

  const startTimer = useCallback((messageId: string, deleteAt: Date, autoDeleteTimer: number) => {
    const existingInterval = intervalRefs.current.get(messageId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const deleteTime = new Date(deleteAt).getTime();
      const remaining = Math.max(0, Math.ceil((deleteTime - now) / 1000));

      if (remaining <= 0) {
        const interval = intervalRefs.current.get(messageId);
        if (interval) {
          clearInterval(interval);
          intervalRefs.current.delete(messageId);
        }
        setActiveTimers(prev => {
          const newMap = new Map(prev);
          newMap.delete(messageId);
          return newMap;
        });
        options.onMessageDeleted?.(messageId);
      } else {
        setActiveTimers(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(messageId);
          if (existing) {
            newMap.set(messageId, { ...existing, remainingTime: remaining });
          }
          return newMap;
        });
      }
    };

    setActiveTimers(prev => {
      const newMap = new Map(prev);
      newMap.set(messageId, {
        messageId,
        viewTimestamp: new Date(),
        deleteAt,
        autoDeleteTimer,
        remainingTime: autoDeleteTimer,
      });
      return newMap;
    });

    const interval = setInterval(updateTimer, 1000);
    intervalRefs.current.set(messageId, interval);
    updateTimer();
  }, [options]);

  useEffect(() => {
    if (!socket) return;

    const handleViewStarted = (data: { 
      messageId: string; 
      viewTimestamp: string; 
      deleteAt: string; 
      autoDeleteTimer: number;
    }) => {
      startTimer(data.messageId, new Date(data.deleteAt), data.autoDeleteTimer);
    };

    const handleAudioPlayStarted = (data: { 
      messageId: string; 
      playTimestamp: string; 
      deleteAt: string; 
      autoDeleteTimer: number;
    }) => {
      startTimer(data.messageId, new Date(data.deleteAt), data.autoDeleteTimer);
    };

    const handleMessageDeleted = (data: { messageId: string; reason: string }) => {
      const interval = intervalRefs.current.get(data.messageId);
      if (interval) {
        clearInterval(interval);
        intervalRefs.current.delete(data.messageId);
      }
      setActiveTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.messageId);
        return newMap;
      });
      options.onMessageDeleted?.(data.messageId);
    };

    const handleScreenshotAlert = (data: { from: string; chatRoomId: string; timestamp: string }) => {
      options.onScreenshotAlert?.(data.from);
    };

    socket.on('message-view-started', handleViewStarted);
    socket.on('audio-play-started', handleAudioPlayStarted);
    socket.on('message-self-destructed', handleMessageDeleted);
    socket.on('screenshot-alert', handleScreenshotAlert);

    return () => {
      socket.off('message-view-started', handleViewStarted);
      socket.off('audio-play-started', handleAudioPlayStarted);
      socket.off('message-self-destructed', handleMessageDeleted);
      socket.off('screenshot-alert', handleScreenshotAlert);
    };
  }, [socket, startTimer, options]);

  useEffect(() => {
    return () => {
      intervalRefs.current.forEach(interval => clearInterval(interval));
      intervalRefs.current.clear();
    };
  }, []);

  const getTimerForMessage = useCallback((messageId: string) => {
    return activeTimers.get(messageId);
  }, [activeTimers]);

  return {
    sendSelfDestructMessage,
    markMessageViewed,
    markAudioPlayed,
    reportScreenshot,
    activeTimers,
    getTimerForMessage,
  };
}

export default useSelfDestruct;
