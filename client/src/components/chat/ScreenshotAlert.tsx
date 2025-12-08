import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, AlertTriangle, X } from 'lucide-react';

interface ScreenshotAlertProps {
  from: string;
  timestamp?: Date;
  onDismiss: () => void;
}

export function ScreenshotAlert({ from, timestamp, onDismiss }: ScreenshotAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-full mx-4"
        >
          <div className="bg-red-900/95 border border-red-500/50 rounded-lg shadow-2xl backdrop-blur-lg overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-red-500/30 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-red-400" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h4 className="text-red-400 font-semibold text-sm">Screenshot Detected</h4>
                  </div>
                  <p className="text-white/80 text-sm">
                    <span className="font-medium text-white">{from}</span> took a screenshot of the chat
                  </p>
                  {timestamp && (
                    <p className="text-white/50 text-xs mt-1">
                      {timestamp.toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setIsVisible(false);
                    setTimeout(onDismiss, 300);
                  }}
                  className="flex-shrink-0 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
              className="h-1 bg-red-500"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ScreenshotBlocker({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const blockDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const blockSelect = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('dragstart', blockDragStart);
    document.addEventListener('selectstart', blockSelect);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('dragstart', blockDragStart);
      document.removeEventListener('selectstart', blockSelect);
    };
  }, [enabled]);

  return (
    <div 
      style={{ 
        userSelect: enabled ? 'none' : 'auto',
        WebkitUserSelect: enabled ? 'none' : 'auto',
      }}
    >
      {children}
    </div>
  );
}

export default ScreenshotAlert;
