import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ghost, Lock, Eye, EyeOff, Shield, Fingerprint } from 'lucide-react';

interface GhostModeActivatorProps {
  onActivate: (pin: string) => Promise<boolean>;
  onSetup: (pin: string) => Promise<boolean>;
  isSetUp: boolean;
  isLoading: boolean;
}

const GESTURE_CODES = {
  LONG_PRESS_DURATION: 2000,
  SHAKE_THRESHOLD: 15,
  SHAKE_COUNT: 3,
};

export function GhostModeActivator({ 
  onActivate, 
  onSetup, 
  isSetUp, 
  isLoading 
}: GhostModeActivatorProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(!isSetUp);
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shakeCountRef = useRef(0);
  const lastShakeRef = useRef(0);

  const handleLongPressStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setShowDialog(true);
      setIsSettingUp(!isSetUp);
    }, GESTURE_CODES.LONG_PRESS_DURATION);
  }, [isSetUp]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const totalAcceleration = Math.sqrt(
        (acceleration.x || 0) ** 2 +
        (acceleration.y || 0) ** 2 +
        (acceleration.z || 0) ** 2
      );

      const now = Date.now();
      if (totalAcceleration > GESTURE_CODES.SHAKE_THRESHOLD) {
        if (now - lastShakeRef.current > 500) {
          shakeCountRef.current++;
          lastShakeRef.current = now;

          if (shakeCountRef.current >= GESTURE_CODES.SHAKE_COUNT) {
            setShowDialog(true);
            setIsSettingUp(!isSetUp);
            shakeCountRef.current = 0;
          }
        }
      }

      if (now - lastShakeRef.current > 2000) {
        shakeCountRef.current = 0;
      }
    };

    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleDeviceMotion);
    }

    return () => {
      if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
    };
  }, [isSetUp]);

  const handleSubmit = async () => {
    setError('');

    if (isSettingUp) {
      if (pin.length < 4 || pin.length > 8) {
        setError('PIN must be 4-8 digits');
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
      
      const success = await onSetup(pin);
      if (success) {
        setShowDialog(false);
        setPin('');
        setConfirmPin('');
        setIsSettingUp(false);
      } else {
        setError('Failed to set up Ghost Mode');
      }
    } else {
      const success = await onActivate(pin);
      if (success) {
        setShowDialog(false);
        setPin('');
      } else {
        setError('Invalid PIN');
      }
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    setPin('');
    setConfirmPin('');
    setError('');
  };

  return (
    <>
      <div
        className="ghost-activator-trigger"
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        style={{ display: 'none' }}
      />

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="bg-gray-900 border-cyan-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <Ghost className="w-6 h-6" />
              {isSettingUp ? 'Set Up Ghost Mode' : 'Enter Ghost Mode'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center border border-cyan-500/30">
                <Shield className="w-10 h-10 text-cyan-400" />
              </div>
              <p className="text-gray-400 text-sm">
                {isSettingUp 
                  ? 'Create a secure PIN to protect your ghost conversations'
                  : 'Enter your PIN to access hidden conversations'
                }
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  placeholder="Enter PIN (4-8 digits)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="bg-gray-800 border-gray-700 text-white text-center text-xl tracking-widest pr-10"
                  maxLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {isSettingUp && (
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    placeholder="Confirm PIN"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="bg-gray-800 border-gray-700 text-white text-center text-xl tracking-widest"
                    maxLength={8}
                  />
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isLoading || pin.length < 4}
                className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isSettingUp ? 'Setting up...' : 'Verifying...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {isSettingUp ? 'Set Up Ghost Mode' : 'Enter Ghost Mode'}
                  </span>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
              <Fingerprint className="w-4 h-4" />
              <span>Biometric authentication available on supported devices</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GhostModeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 w-12 h-12 rounded-full bg-gray-900/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-gray-800 hover:border-cyan-400 transition-all duration-300 shadow-lg shadow-cyan-500/10 z-50"
      style={{ 
        opacity: 0.3,
        transition: 'opacity 0.3s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.3'}
    >
      <Ghost className="w-6 h-6" />
    </button>
  );
}

export default GhostModeActivator;
