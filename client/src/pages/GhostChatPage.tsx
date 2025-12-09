import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Ghost, 
  Send, 
  ArrowLeft, 
  Shield, 
  Timer, 
  Eye,
  EyeOff,
  LogOut,
  AlertTriangle,
  Lock
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface GhostMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  messageType: string;
  viewed: boolean;
  viewTimestamp?: string;
  autoDeleteTimer: number;
  deleteAt?: string;
  timestamp: string;
  isDeleted?: boolean;
}

interface SessionInfo {
  sessionId: string;
  sessionKey: string;
  partnerId: string;
  participants: string[];
  expireAt: string;
}

export default function GhostChatPage() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sessionId = params.sessionId;

  const [user] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [token] = useState(() => localStorage.getItem('token'));
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<GhostMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const validateAndLoadSession = async () => {
      if (!sessionId || !token) {
        setError('Invalid session');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/ghost/validate-access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!data.valid) {
          setError('Session expired or access denied');
          setIsLoading(false);
          return;
        }

        setSessionInfo({
          sessionId,
          sessionKey: data.sessionKey,
          partnerId: data.partnerId,
          participants: data.participants,
          expireAt: data.expireAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

        const messagesResponse = await fetch(
          `/api/ghost/messages/${sessionId}`,
          {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          }
        );

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData.messages || []);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to validate ghost session:', err);
        setError('Failed to connect to Ghost Mode');
        setIsLoading(false);
      }
    };

    validateAndLoadSession();
  }, [sessionId, token]);

  useEffect(() => {
    if (!token || !sessionInfo) return;

    const socket = io({
      auth: { token },
      forceNew: true,
    });

    socketRef.current = socket;

    socket.emit('ghost-join-room', { sessionId: sessionInfo.sessionId });

    socket.on('ghost-receive-message', (data) => {
      console.log('👻 Received ghost message:', data);
      const newMsg: GhostMessage = {
        id: data.messageId || data.id,
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        messageType: data.messageType || 'text',
        viewed: false,
        autoDeleteTimer: data.autoDeleteTimer || 30,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
    });

    socket.on('ghost-message-deleted', (data) => {
      console.log('👻 Ghost message deleted:', data);
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    socket.on('ghost-session-terminated', (data) => {
      console.log('👻 Ghost session terminated:', data);
      setError('Session has been terminated');
      setTimeout(() => {
        setLocation('/home');
      }, 2000);
    });

    socket.on('ghost-partner-joined', (data) => {
      console.log('👻 Partner joined ghost session:', data);
      setIsPartnerOnline(true);
    });

    socket.on('ghost-partner-left', () => {
      setIsPartnerOnline(false);
    });

    socket.on('ghost-security-event', (data) => {
      console.log('👻 Security event:', data);
      if (data.eventType === 'screenshot_attempt') {
        setIsBlurred(true);
        setTimeout(() => setIsBlurred(false), 3000);
      }
    });

    return () => {
      socket.emit('ghost-leave-room', { sessionId: sessionInfo.sessionId });
      socket.disconnect();
      socket.removeAllListeners();
      socketRef.current = null;
    };
  }, [token, sessionInfo, setLocation]);

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
        lastActivityRef.current = Date.now();
      }
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const idleCheck = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime > 60000) {
        setIsBlurred(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(idleCheck);
    };
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !sessionInfo) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const response = await fetch('/api/ghost/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: sessionInfo.sessionId,
          message: messageContent,
          messageType: 'text',
        }),
      });

      const data = await response.json();

      if (data.success) {
        const newMsg: GhostMessage = {
          id: data.message.id,
          senderId: user.username,
          receiverId: sessionInfo.partnerId,
          content: messageContent,
          messageType: 'text',
          viewed: false,
          autoDeleteTimer: data.message.autoDeleteTimer,
          timestamp: data.message.timestamp,
        };
        setMessages((prev) => [...prev, newMsg]);

        if (socketRef.current) {
          socketRef.current.emit('ghost-send-message', {
            sessionId: sessionInfo.sessionId,
            messageId: data.message.id,
            senderId: user.username,
            receiverId: sessionInfo.partnerId,
            content: messageContent,
            messageType: 'text',
            autoDeleteTimer: data.message.autoDeleteTimer,
            timestamp: data.message.timestamp,
          });
        }
      }
    } catch (err) {
      console.error('Failed to send ghost message:', err);
    }
  };

  const handleTerminateSession = async () => {
    if (!sessionInfo) return;

    try {
      const response = await fetch('/api/ghost/terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: sessionInfo.sessionId,
          deviceType: 'desktop',
        }),
      });

      if (response.ok) {
        if (socketRef.current) {
          socketRef.current.emit('ghost-session-terminate', {
            sessionId: sessionInfo.sessionId,
          });
        }
        setLocation('/home');
      }
    } catch (err) {
      console.error('Failed to terminate ghost session:', err);
    }
  };

  const handleLeaveSession = () => {
    setLocation('/home');
  };

  const handleMarkViewed = async (messageId: string) => {
    try {
      await fetch(`/api/ghost/messages/${messageId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, viewed: true, viewTimestamp: new Date().toISOString() } : m
        )
      );
    } catch (err) {
      console.error('Failed to mark message viewed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <Ghost className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-pulse" />
          <p className="text-purple-400 text-lg">Entering Ghost Mode...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button
            onClick={() => setLocation('/home')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Return to Chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black transition-all duration-300 ${isBlurred ? 'blur-lg' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-pink-900/20" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute text-purple-500/20 text-xs font-mono animate-fall"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          >
            {String.fromCharCode(0x30A0 + Math.random() * 96)}
          </div>
        ))}
      </div>

      <div className="relative z-10 h-full flex flex-col">
        <header className="bg-black/80 border-b border-purple-500/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLeaveSession}
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10 border-2 border-purple-500">
                    <AvatarFallback className="bg-purple-900 text-purple-300">
                      <Ghost className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  {isPartnerOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-white font-medium">
                      {sessionInfo?.partnerId || 'Ghost Chat'}
                    </h1>
                    <Ghost className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-purple-400">
                    <Shield className="w-3 h-3" />
                    <span>End-to-End Encrypted</span>
                    <span className="text-purple-600">|</span>
                    <Lock className="w-3 h-3" />
                    <span>Ghost Mode Active</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTerminateDialog(true)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
              >
                <LogOut className="w-4 h-4 mr-2" />
                End Session
              </Button>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 bg-purple-900/50 px-4 py-2 rounded-full border border-purple-500/30">
                <Ghost className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 text-sm">
                  Messages in Ghost Mode are encrypted and auto-delete
                </span>
              </div>
            </div>

            {messages.map((message) => {
              const isSender = message.senderId === user.username;
              return (
                <div
                  key={message.id}
                  className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                  onClick={() => !isSender && !message.viewed && handleMarkViewed(message.id)}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      isSender
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gray-800/80 text-gray-100 border border-purple-500/30'
                    }`}
                  >
                    <p className="break-words">{message.content}</p>
                    <div className={`flex items-center gap-2 mt-2 text-xs ${isSender ? 'text-purple-200' : 'text-gray-500'}`}>
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {!isSender && (
                        <>
                          <span className="text-purple-500">|</span>
                          {message.viewed ? (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Viewed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <EyeOff className="w-3 h-3" />
                              Tap to view
                            </span>
                          )}
                        </>
                      )}
                      {message.autoDeleteTimer && (
                        <>
                          <span className="text-purple-500">|</span>
                          <Timer className="w-3 h-3" />
                          <span>{message.autoDeleteTimer}s</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <footer className="bg-black/80 border-t border-purple-500/30 p-4 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Type a ghost message..."
                className="flex-1 bg-gray-900/50 border-purple-500/30 text-white placeholder:text-gray-500 focus:border-purple-500"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </footer>
      </div>

      <AlertDialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <AlertDialogContent className="bg-gray-900 border border-purple-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Terminate Ghost Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently delete all messages in this Ghost Mode session. 
              Both you and your partner will lose access immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminateSession}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Terminate Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }
      `}</style>
    </div>
  );
}
