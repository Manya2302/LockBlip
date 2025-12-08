import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Ghost, Send, Lock, ArrowLeft, Plus, Clock, Shield, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GhostMessage {
  id: string;
  senderId: string;
  content: string;
  messageType: string;
  viewed: boolean;
  viewTimestamp: string | null;
  autoDeleteTimer: number;
  deleteAt: string | null;
  timestamp: string;
}

interface GhostSession {
  sessionId: string;
  participants: string[];
}

interface GhostChatUIProps {
  isActive: boolean;
  currentUsername: string;
  sessions: GhostSession[];
  currentSession: GhostSession | null;
  messages: GhostMessage[];
  onSendMessage: (sessionId: string, message: string) => void;
  onSelectSession: (session: GhostSession) => void;
  onCreateSession: (participantUsername: string) => Promise<void>;
  onMarkViewed: (messageId: string) => void;
  onClose: () => void;
  onBack: () => void;
  autoLockTimeout: number;
  onActivity: () => void;
}

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const chars = '01アイウエオカキクケコ';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ffff20';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 opacity-30 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function GhostMessageBubble({ 
  message, 
  isOwn,
  onView,
}: { 
  message: GhostMessage; 
  isOwn: boolean;
  onView: () => void;
}) {
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isViewing, setIsViewing] = useState(false);

  useEffect(() => {
    if (message.deleteAt) {
      const updateTimer = () => {
        const now = Date.now();
        const deleteTime = new Date(message.deleteAt!).getTime();
        const remaining = Math.max(0, Math.ceil((deleteTime - now) / 1000));
        setRemainingTime(remaining);
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [message.deleteAt]);

  const handleView = () => {
    if (!isOwn && !message.viewed) {
      setIsViewing(true);
      onView();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: remainingTime === 0 ? 0 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        onClick={handleView}
        className={`max-w-[80%] rounded-2xl px-4 py-2 relative cursor-pointer ${
          isOwn
            ? 'bg-gradient-to-br from-cyan-600/80 to-purple-600/80 text-white'
            : 'bg-gray-800/80 text-gray-100 border border-cyan-500/20'
        }`}
      >
        {!isOwn && !message.viewed && (
          <div className="absolute inset-0 bg-gray-900/90 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <div className="flex items-center gap-2 text-cyan-400">
              <Eye className="w-4 h-4" />
              <span className="text-sm">Tap to view</span>
            </div>
          </div>
        )}
        
        <p className="text-sm">{message.content}</p>
        
        <div className="flex items-center justify-between mt-1 text-xs opacity-70">
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
          {remainingTime !== null && remainingTime > 0 && (
            <span className="flex items-center gap-1 text-orange-400">
              <Clock className="w-3 h-3" />
              {remainingTime}s
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function GhostChatUI({
  isActive,
  currentUsername,
  sessions,
  currentSession,
  messages,
  onSendMessage,
  onSelectSession,
  onCreateSession,
  onMarkViewed,
  onClose,
  onBack,
  autoLockTimeout,
  onActivity,
}: GhostChatUIProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [newParticipant, setNewParticipant] = useState('');
  const [showNewSession, setShowNewSession] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputMessage.trim() || !currentSession) return;
    onActivity();
    onSendMessage(currentSession.sessionId, inputMessage.trim());
    setInputMessage('');
  };

  const handleCreateSession = async () => {
    if (!newParticipant.trim()) return;
    onActivity();
    await onCreateSession(newParticipant.trim());
    setNewParticipant('');
    setShowNewSession(false);
  };

  if (!isActive) return null;

  const otherParticipant = currentSession?.participants.find(p => p !== currentUsername);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-gray-950"
      onClick={onActivity}
    >
      <MatrixRain />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-gray-900/80 backdrop-blur">
          <div className="flex items-center gap-3">
            {currentSession ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { onActivity(); onBack(); }}
                className="text-cyan-400 hover:text-cyan-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : null}
            
            <Ghost className="w-6 h-6 text-cyan-400" />
            <div>
              <h1 className="text-lg font-bold text-cyan-400">
                {currentSession ? otherParticipant : 'Ghost Mode'}
              </h1>
              <p className="text-xs text-gray-500">
                {currentSession ? 'End-to-end encrypted' : 'Hidden conversations'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Lock className="w-3 h-3" />
              <span>Auto-lock: {autoLockTimeout}s</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-red-400 hover:text-red-300"
            >
              Exit
            </Button>
          </div>
        </div>

        {!currentSession ? (
          <div className="flex-1 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-gray-400">Conversations</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewSession(!showNewSession)}
                className="text-cyan-400"
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>

            {showNewSession && (
              <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-cyan-500/20">
                <Input
                  placeholder="Enter username..."
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white mb-2"
                />
                <Button
                  onClick={handleCreateSession}
                  className="w-full bg-cyan-600 hover:bg-cyan-500"
                >
                  Start Ghost Chat
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {sessions.map((session) => {
                const other = session.participants.find(p => p !== currentUsername);
                return (
                  <motion.div
                    key={session.sessionId}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { onActivity(); onSelectSession(session); }}
                    className="p-4 bg-gray-800/50 rounded-lg border border-cyan-500/20 cursor-pointer hover:border-cyan-400/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
                        <Ghost className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{other}</p>
                        <p className="text-xs text-gray-500">Ghost conversation</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {sessions.length === 0 && !showNewSession && (
                <div className="text-center py-12 text-gray-500">
                  <Ghost className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>No ghost conversations yet</p>
                  <p className="text-sm mt-1">Start a new hidden chat</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <AnimatePresence>
                {messages.map((msg) => (
                  <GhostMessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === currentUsername}
                    onView={() => onMarkViewed(msg.id)}
                  />
                ))}
              </AnimatePresence>

              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Messages are encrypted and auto-delete</p>
                  <p className="text-sm mt-1">Start your secure conversation</p>
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t border-cyan-500/20 bg-gray-900/80 backdrop-blur">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a ghost message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputMessage.trim()}
                  className="bg-gradient-to-r from-cyan-600 to-purple-600"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default GhostChatUI;
