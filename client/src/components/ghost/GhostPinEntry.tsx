import React, { useState, useRef, useEffect } from 'react';
import { Ghost, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GhostPinEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<boolean>;
  title?: string;
  description?: string;
  isReauth?: boolean;
}

export function GhostPinEntry({
  isOpen,
  onClose,
  onSubmit,
  title = 'Enter Ghost PIN',
  description = 'Enter your 6-digit PIN to access Ghost Mode',
  isReauth = false,
}: GhostPinEntryProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    if (newPin.every(d => d !== '') && index === 5) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newPin = pastedData.split('');
      setPin(newPin);
      inputRefs.current[5]?.focus();
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (pinValue: string) => {
    if (pinValue.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onSubmit(pinValue);
      if (!success) {
        setError('Invalid PIN');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPin(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-purple-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-400">
            {isReauth ? <ShieldCheck className="h-5 w-5" /> : <Ghost className="h-5 w-5" />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div 
            className={`flex justify-center gap-2 ${shake ? 'animate-shake' : ''}`}
            onPaste={handlePaste}
          >
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type={showPin ? 'text' : 'password'}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-mono bg-gray-800 border-2 border-purple-500/30 rounded-lg 
                         focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20
                         transition-all duration-200"
                maxLength={1}
                disabled={loading}
              />
            ))}
          </div>

          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPin ? 'Hide PIN' : 'Show PIN'}
            </button>
          </div>

          <div className="flex gap-2 mt-6">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-gray-600"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(pin.join(''))}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
              disabled={loading || pin.some(d => d === '')}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GhostPinEntry;
