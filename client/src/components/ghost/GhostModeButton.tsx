import React, { useState } from 'react';
import { Ghost, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';

interface GhostModeButtonProps {
  partnerId: string;
  partnerName?: string;
  onActivate: (partnerId: string, deviceType: string) => Promise<{ pin: string; sessionId: string } | null>;
  onJoin: (pin: string, deviceType: string) => Promise<boolean>;
  isGhostModeSetup: boolean;
  onSetupRequired: () => void;
  className?: string;
}

export function GhostModeButton({
  partnerId,
  partnerName,
  onActivate,
  onJoin,
  isGhostModeSetup,
  onSetupRequired,
  className = '',
}: GhostModeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'activate' | 'join' | 'success'>('choose');
  const [pin, setPin] = useState('');
  const [generatedPin, setGeneratedPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  const detectDeviceType = (): 'mobile' | 'desktop' | 'tablet' => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  };

  const handleActivate = async () => {
    if (!isGhostModeSetup) {
      onSetupRequired();
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const deviceType = detectDeviceType();
      const result = await onActivate(partnerId, deviceType);
      
      if (result) {
        setGeneratedPin(result.pin);
        setMode('success');
      } else {
        setError('Failed to activate Ghost Mode');
      }
    } catch (err: any) {
      setError(err.message || 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (pin.length !== 6) {
      setError('Please enter a valid 6-digit PIN');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const deviceType = detectDeviceType();
      const success = await onJoin(pin, deviceType);
      
      if (success) {
        setIsOpen(false);
        resetState();
      } else {
        setError('Invalid PIN or expired invitation');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setMode('choose');
    setPin('');
    setGeneratedPin('');
    setError('');
    setShowPin(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetState();
    }
  };

  const copyPin = () => {
    navigator.clipboard.writeText(generatedPin);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`relative hover:bg-purple-500/20 transition-colors ${className}`}
              >
                <Ghost className="h-5 w-5 text-purple-500" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Ghost Mode - Secret Chat</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md bg-gray-900 border-purple-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-400">
            <Ghost className="h-5 w-5" />
            Ghost Mode
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {mode === 'choose' && 'Start a completely invisible encrypted chat session'}
            {mode === 'activate' && 'Activating ghost mode will generate a PIN to share'}
            {mode === 'join' && 'Enter the PIN shared with you to join the session'}
            {mode === 'success' && 'Share this PIN with your partner to connect'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {mode === 'choose' && (
            <div className="space-y-3">
              <Button
                onClick={() => setMode('activate')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Lock className="h-4 w-4 mr-2" />
                Start Ghost Session with {partnerName || partnerId}
              </Button>
              <Button
                onClick={() => setMode('join')}
                variant="outline"
                className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
              >
                <Unlock className="h-4 w-4 mr-2" />
                Join with PIN
              </Button>
              <p className="text-xs text-gray-500 text-center mt-4">
                Ghost Mode messages are end-to-end encrypted, auto-expire in 24 hours,
                and are hidden from your main chat history.
              </p>
            </div>
          )}

          {mode === 'activate' && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <p className="text-sm text-gray-300">
                  This will create a secret chat session with <strong className="text-purple-400">{partnerName || partnerId}</strong>.
                  A 6-digit PIN will be generated for them to join.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setMode('choose')}
                  variant="outline"
                  className="flex-1 border-gray-600"
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleActivate}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={loading}
                >
                  {loading ? 'Activating...' : 'Generate PIN'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'join' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Enter 6-digit PIN</label>
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="bg-gray-800 border-purple-500/30 text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setMode('choose')}
                  variant="outline"
                  className="flex-1 border-gray-600"
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleJoin}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={loading || pin.length !== 6}
                >
                  {loading ? 'Joining...' : 'Join Session'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'success' && (
            <div className="space-y-4">
              <div className="p-6 bg-green-500/10 rounded-lg border border-green-500/30 text-center">
                <div className="text-green-400 text-sm mb-2">Ghost Session PIN</div>
                <div className="relative">
                  <div className="text-4xl font-mono tracking-[0.3em] text-white bg-gray-800/50 py-4 rounded-lg">
                    {showPin ? generatedPin : '******'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Share this PIN with {partnerName || partnerId} so they can join.
                  The PIN expires in 1 hour.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={copyPin}
                  variant="outline"
                  className="flex-1 border-purple-500/50"
                >
                  Copy PIN
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GhostModeButton;
