import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Flame, Eye, Volume2 } from 'lucide-react';

interface SelfDestructMessageProps {
  messageId: string;
  content: string;
  messageType: 'text' | 'audio' | 'image' | 'video';
  mediaUrl?: string | null;
  isOwn: boolean;
  autoDeleteTimer: number;
  viewed: boolean;
  viewTimestamp: string | null;
  deleteAt: string | null;
  timestamp: string;
  onView: () => void;
  onAudioPlay?: () => void;
}

export function SelfDestructMessage({
  messageId,
  content,
  messageType,
  mediaUrl,
  isOwn,
  autoDeleteTimer,
  viewed,
  viewTimestamp,
  deleteAt,
  timestamp,
  onView,
  onAudioPlay,
}: SelfDestructMessageProps) {
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(viewed);
  const [isDeleted, setIsDeleted] = useState(false);

  useEffect(() => {
    if (deleteAt) {
      const updateTimer = () => {
        const now = Date.now();
        const deleteTime = new Date(deleteAt).getTime();
        const remaining = Math.max(0, Math.ceil((deleteTime - now) / 1000));
        setRemainingTime(remaining);
        
        if (remaining === 0) {
          setIsDeleted(true);
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [deleteAt]);

  const handleReveal = () => {
    if (!isOwn && !isRevealed) {
      setIsRevealed(true);
      onView();
    }
  };

  const handleAudioPlay = () => {
    if (onAudioPlay && messageType === 'audio') {
      onAudioPlay();
    }
  };

  if (isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0.8, height: 0 }}
        transition={{ duration: 0.5 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
      />
    );
  }

  const getTimerColor = () => {
    if (remainingTime === null) return 'text-gray-400';
    if (remainingTime <= 5) return 'text-red-500';
    if (remainingTime <= 15) return 'text-orange-500';
    return 'text-yellow-500';
  };

  const getProgressWidth = () => {
    if (remainingTime === null || !deleteAt) return '100%';
    return `${(remainingTime / autoDeleteTimer) * 100}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={`relative max-w-[80%] rounded-2xl overflow-hidden ${
          isOwn
            ? 'bg-gradient-to-br from-orange-600/90 to-red-600/90'
            : 'bg-gray-800/90 border border-orange-500/30'
        }`}
      >
        {remainingTime !== null && (
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000"
            style={{ width: getProgressWidth() }}
          />
        )}

        <div
          onClick={handleReveal}
          className="relative px-4 py-2 cursor-pointer"
        >
          {!isOwn && !isRevealed && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10"
            >
              <div className="flex items-center gap-2 text-orange-400">
                <Flame className="w-4 h-4 animate-pulse" />
                <span className="text-sm font-medium">Self-destruct message</span>
                <Eye className="w-4 h-4" />
              </div>
            </motion.div>
          )}

          {messageType === 'text' && (
            <p className="text-white text-sm relative z-0">{content}</p>
          )}

          {messageType === 'audio' && mediaUrl && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleAudioPlay}
                className="w-10 h-10 rounded-full bg-orange-500/30 flex items-center justify-center hover:bg-orange-500/50 transition-colors"
              >
                <Volume2 className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <div className="h-1 bg-white/20 rounded-full">
                  <div className="h-1 bg-white/60 rounded-full w-0" />
                </div>
              </div>
            </div>
          )}

          {(messageType === 'image' || messageType === 'video') && mediaUrl && (
            <div className="relative">
              {messageType === 'image' ? (
                <img 
                  src={mediaUrl} 
                  alt="Self-destruct media" 
                  className="max-w-full rounded-lg"
                />
              ) : (
                <video 
                  src={mediaUrl} 
                  controls 
                  className="max-w-full rounded-lg"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-1 text-xs">
            <span className="text-white/60">
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            <div className="flex items-center gap-2">
              {remainingTime !== null && (
                <motion.span
                  key={remainingTime}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className={`flex items-center gap-1 ${getTimerColor()}`}
                >
                  <Clock className="w-3 h-3" />
                  {remainingTime}s
                </motion.span>
              )}
              
              {!viewed && !isOwn && (
                <span className="text-orange-400 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {remainingTime !== null && remainingTime <= 5 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-red-600/30 to-transparent animate-pulse" />
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 0, opacity: 1 }}
                  animate={{ y: -20, opacity: 0 }}
                  transition={{
                    duration: 1,
                    delay: i * 0.2,
                    repeat: Infinity,
                  }}
                  className="absolute bottom-0"
                  style={{ left: `${20 + i * 15}%` }}
                >
                  <Flame className="w-4 h-4 text-orange-500" />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function SelfDestructToggle({
  enabled,
  timer,
  onToggle,
  onTimerChange,
}: {
  enabled: boolean;
  timer: number;
  onToggle: () => void;
  onTimerChange: (seconds: number) => void;
}) {
  const timerOptions = [5, 10, 30, 60, 300];

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg">
      <button
        onClick={onToggle}
        className={`p-2 rounded-lg transition-colors ${
          enabled 
            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' 
            : 'bg-gray-700/50 text-gray-400 hover:text-orange-400'
        }`}
      >
        <Flame className="w-5 h-5" />
      </button>
      
      {enabled && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          className="flex items-center gap-1"
        >
          {timerOptions.map((t) => (
            <button
              key={t}
              onClick={() => onTimerChange(t)}
              className={`px-2 py-1 text-xs rounded ${
                timer === t
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {t >= 60 ? `${t / 60}m` : `${t}s`}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default SelfDestructMessage;
