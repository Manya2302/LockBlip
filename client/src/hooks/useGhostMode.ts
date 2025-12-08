import { useState, useCallback, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface GhostSession {
  sessionId: string;
  participants: string[];
  sessionKey: string;
  expireAt: string;
}

interface GhostSessionStatus {
  hasSession: boolean;
  sessionId: string | null;
  ghostEnabled: boolean;
  ghostTerminated: boolean;
  hasJoined: boolean;
  isCreator: boolean;
  canEnterDirectly: boolean;
  needsPin: boolean;
  participants: string[];
  sessionKey: string | null;
}

interface GhostMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: string;
  mediaUrl: string | null;
  viewed: boolean;
  viewTimestamp: string | null;
  autoDeleteTimer: number;
  deleteAt: string | null;
  timestamp: string;
}

interface UseGhostModeOptions {
  socket: Socket | null;
  onSessionExpired?: () => void;
  onAutoLock?: () => void;
  onNewMessage?: (message: GhostMessage) => void;
}

export function useGhostMode(options: UseGhostModeOptions) {
  const { socket } = options;
  const [isGhostModeActive, setIsGhostModeActive] = useState(false);
  const [isSetUp, setIsSetUp] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<GhostSession | null>(null);
  const [messages, setMessages] = useState<GhostMessage[]>([]);
  const [sessions, setSessions] = useState<GhostSession[]>([]);
  const [autoLockTimeout, setAutoLockTimeout] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    if (isGhostModeActive && autoLockTimeout > 0) {
      idleTimerRef.current = setTimeout(() => {
        console.log('👻 Auto-locking ghost mode due to inactivity');
        logout();
        options.onAutoLock?.();
      }, autoLockTimeout * 1000);
    }
  }, [isGhostModeActive, autoLockTimeout, options]);

  const checkGhostStatus = useCallback(async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsSetUp(data.isSetUp);
        setAutoLockTimeout(data.autoLockTimeout || 30);
        return data.isSetUp;
      }
      return false;
    } catch (error) {
      console.error('Ghost status check error:', error);
      return false;
    }
  }, []);

  const setupGhostMode = useCallback(async (pin: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      });
      
      if (response.ok) {
        setIsSetUp(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ghost setup error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const authenticate = useCallback(async (pin: string, biometricToken?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin, biometricToken }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionToken(data.sessionToken);
        setAutoLockTimeout(data.autoLockTimeout || 30);
        setIsGhostModeActive(true);
        localStorage.setItem('ghostSessionToken', data.sessionToken);
        resetIdleTimer();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ghost authentication error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [resetIdleTimer]);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch('/api/ghost/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Ghost logout error:', error);
    } finally {
      setIsGhostModeActive(false);
      setSessionToken(null);
      setCurrentSession(null);
      setMessages([]);
      localStorage.removeItem('ghostSessionToken');
      
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    }
  }, []);

  const fetchSessions = useCallback(async (): Promise<GhostSession[]> => {
    if (!sessionToken) return [];
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/ghost/sessions?sessionToken=${sessionToken}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
        return data.sessions;
      }
      return [];
    } catch (error) {
      console.error('Fetch ghost sessions error:', error);
      return [];
    }
  }, [sessionToken]);

  const createSession = useCallback(async (participantUsername: string): Promise<GhostSession | null> => {
    if (!sessionToken) return null;
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionToken, participantUsername }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
        await fetchSessions();
        return data.session;
      }
      return null;
    } catch (error) {
      console.error('Create ghost session error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, fetchSessions]);

  const fetchMessages = useCallback(async (sessionId: string): Promise<GhostMessage[]> => {
    if (!sessionToken) return [];
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/ghost/messages/${sessionId}?sessionToken=${sessionToken}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        return data.messages;
      }
      return [];
    } catch (error) {
      console.error('Fetch ghost messages error:', error);
      return [];
    }
  }, [sessionToken]);

  const sendMessage = useCallback((sessionId: string, message: string, messageType: string = 'text') => {
    if (!socket || !sessionToken) return;
    
    resetIdleTimer();
    socket.emit('ghost-send-message', {
      sessionToken,
      sessionId,
      message,
      messageType,
    });
  }, [socket, sessionToken, resetIdleTimer]);

  const markMessageViewed = useCallback(async (messageId: string): Promise<void> => {
    if (!sessionToken) return;
    
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`/api/ghost/messages/${messageId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionToken }),
      });
    } catch (error) {
      console.error('Mark ghost message viewed error:', error);
    }
  }, [sessionToken]);

  const activateWithPartner = useCallback(async (partnerId: string, deviceType: string = 'desktop', disclaimerAgreed: boolean = false): Promise<{ pin: string; sessionId: string } | null> => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ partnerId, deviceType, disclaimerAgreed }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (socket) {
          socket.emit('ghost-mode-activated', {
            partnerId,
            pin: data.pin,
            sessionId: data.sessionId,
          });
        }
        
        setCurrentSession({
          sessionId: data.sessionId,
          participants: [partnerId],
          sessionKey: '',
          expireAt: data.expireAt,
        });
        setIsGhostModeActive(true);
        
        return { pin: data.pin, sessionId: data.sessionId };
      }
      
      const errorData = await response.json();
      throw new Error(errorData.error || 'Activation failed');
    } catch (error: any) {
      console.error('Ghost activate error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [socket]);

  const joinWithPin = useCallback(async (pin: string, deviceType: string = 'desktop'): Promise<boolean> => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin, deviceType }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setCurrentSession({
          sessionId: data.sessionId,
          participants: data.participants,
          sessionKey: data.sessionKey,
          expireAt: data.expireAt,
        });
        setIsGhostModeActive(true);
        
        if (socket) {
          socket.emit('ghost-partner-joined', {
            sessionId: data.sessionId,
            partnerId: data.partnerId,
          });
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ghost join error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [socket]);

  const reauthenticate = useCallback(async (sessionId: string, pin: string, deviceType: string = 'desktop'): Promise<boolean> => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/reauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, pin, deviceType }),
      });
      
      if (response.ok) {
        resetIdleTimer();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ghost reauth error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [resetIdleTimer]);

  const logSecurityEvent = useCallback(async (sessionId: string, eventType: string, deviceType: string = 'desktop') => {
    if (socket) {
      socket.emit('ghost-security-event', {
        sessionId,
        eventType,
        deviceType,
      });
    }
  }, [socket]);

  const terminateSession = useCallback(async (sessionId: string, partnerId?: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (socket && partnerId) {
          socket.emit('ghost-mode-terminated', {
            sessionId,
            partnerId: partnerId || data.partnerId,
          });
        }
        
        setCurrentSession(null);
        setMessages([]);
        setIsGhostModeActive(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ghost terminate error:', error);
      return false;
    }
  }, [socket]);

  const checkSessionStatus = useCallback(async (partnerId: string): Promise<GhostSessionStatus | null> => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/ghost/session-status/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Ghost session status error:', error);
      return null;
    }
  }, []);

  const directEnter = useCallback(async (partnerId: string, deviceType: string = 'desktop'): Promise<GhostSession | null> => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/ghost/direct-enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ partnerId, deviceType }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        const session: GhostSession = {
          sessionId: data.sessionId,
          participants: data.participants,
          sessionKey: data.sessionKey,
          expireAt: data.expireAt,
        };
        
        setCurrentSession(session);
        setIsGhostModeActive(true);
        
        if (socket) {
          socket.emit('ghost-mode-entered', {
            sessionId: data.sessionId,
            partnerId,
          });
        }
        
        return session;
      }
      return null;
    } catch (error) {
      console.error('Ghost direct enter error:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [socket]);

  useEffect(() => {
    if (!socket || !isGhostModeActive) return;

    const handleNewMessage = (data: any) => {
      const newMessage: GhostMessage = {
        id: data.messageId,
        senderId: data.senderId,
        receiverId: '',
        content: data.content,
        messageType: data.messageType,
        mediaUrl: null,
        viewed: false,
        viewTimestamp: null,
        autoDeleteTimer: data.autoDeleteTimer,
        deleteAt: null,
        timestamp: data.timestamp,
      };
      
      setMessages(prev => [...prev, newMessage]);
      options.onNewMessage?.(newMessage);
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    };

    const handleViewStarted = (data: { messageId: string; deleteAt: string }) => {
      setMessages(prev => prev.map(m => 
        m.id === data.messageId 
          ? { ...m, viewed: true, viewTimestamp: new Date().toISOString(), deleteAt: data.deleteAt }
          : m
      ));
    };

    const handleSessionTerminated = (data: { sessionId: string; terminatedBy: string }) => {
      console.log(`👻 Ghost session terminated by ${data.terminatedBy}`);
      setCurrentSession(null);
      setMessages([]);
      setIsGhostModeActive(false);
      options.onSessionExpired?.();
    };

    socket.on('ghost-receive-message', handleNewMessage);
    socket.on('ghost-message-deleted', handleMessageDeleted);
    socket.on('ghost-message-view-started', handleViewStarted);
    socket.on('ghost-session-terminated', handleSessionTerminated);

    return () => {
      socket.off('ghost-receive-message', handleNewMessage);
      socket.off('ghost-message-deleted', handleMessageDeleted);
      socket.off('ghost-message-view-started', handleViewStarted);
      socket.off('ghost-session-terminated', handleSessionTerminated);
    };
  }, [socket, isGhostModeActive, options]);

  useEffect(() => {
    if (isGhostModeActive && sessionToken) {
      heartbeatRef.current = setInterval(async () => {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch('/api/ghost/heartbeat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionToken }),
          });
          
          if (!response.ok) {
            console.log('👻 Ghost session expired');
            logout();
            options.onSessionExpired?.();
          }
        } catch (error) {
          console.error('Ghost heartbeat error:', error);
        }
      }, 60000);
    }
    
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [isGhostModeActive, sessionToken, logout, options]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  return {
    isGhostModeActive,
    isSetUp,
    isLoading,
    sessionToken,
    currentSession,
    messages,
    sessions,
    autoLockTimeout,
    checkGhostStatus,
    setupGhostMode,
    authenticate,
    logout,
    fetchSessions,
    createSession,
    fetchMessages,
    sendMessage,
    markMessageViewed,
    resetIdleTimer,
    setCurrentSession,
    activateWithPartner,
    joinWithPin,
    reauthenticate,
    logSecurityEvent,
    terminateSession,
    checkSessionStatus,
    directEnter,
    setIsGhostModeActive,
  };
}

export default useGhostMode;
