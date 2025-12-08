import React, { useState } from 'react';
import { Ghost, Lock, Unlock, Eye, EyeOff, Copy, Check, AlertTriangle, Shield } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';

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

interface GhostModeButtonProps {
  partnerId: string;
  partnerName?: string;
  onActivate: (partnerId: string, deviceType: string, disclaimerAgreed: boolean) => Promise<{ pin: string; sessionId: string } | null>;
  onJoin: (pin: string, deviceType: string) => Promise<boolean>;
  onDirectEnter?: (partnerId: string, deviceType: string) => Promise<any>;
  onCheckStatus?: (partnerId: string) => Promise<GhostSessionStatus | null>;
  onSendMessage?: (message: string) => void;
  onEnterGhostMode?: () => void;
  className?: string;
}

export function GhostModeButton({
  partnerId,
  partnerName,
  onActivate,
  onJoin,
  onDirectEnter,
  onCheckStatus,
  onSendMessage,
  onEnterGhostMode,
  className = '',
}: GhostModeButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'loading' | 'choose' | 'disclaimer' | 'success' | 'join'>('loading');
  const [pin, setPin] = useState('');
  const [generatedPin, setGeneratedPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [disclaimerAgreed, setDisclaimerAgreed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<GhostSessionStatus | null>(null);

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

  const handleGeneratePin = async () => {
    if (!disclaimerAgreed) {
      setError('You must agree to the disclaimer to continue');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const deviceType = detectDeviceType();
      const result = await onActivate(partnerId, deviceType, true);
      
      if (result) {
        setGeneratedPin(result.pin);
        setMode('success');
        
        if (onSendMessage) {
          const username = localStorage.getItem('username') || 'User';
          onSendMessage(`Ghost Mode activated by ${username}, Ghost PIN: ${result.pin}`);
        }
        
        onEnterGhostMode?.();
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
        onEnterGhostMode?.();
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
    setMode('loading');
    setPin('');
    setGeneratedPin('');
    setError('');
    setShowPin(false);
    setDisclaimerAgreed(false);
    setCopied(false);
    setSessionStatus(null);
  };

  const checkStatus = async () => {
    if (!onCheckStatus) {
      setMode('choose');
      return;
    }
    
    setMode('loading');
    try {
      const status = await onCheckStatus(partnerId);
      setSessionStatus(status);
      setMode('choose');
    } catch (err) {
      console.error('Failed to check ghost status:', err);
      setMode('choose');
    }
  };

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open) {
      await checkStatus();
    } else {
      resetState();
    }
  };

  const handleDirectEnter = async () => {
    if (!onDirectEnter) {
      setError('Direct enter not available');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const deviceType = detectDeviceType();
      const result = await onDirectEnter(partnerId, deviceType);
      
      if (result) {
        setIsOpen(false);
        resetState();
        onEnterGhostMode?.();
      } else {
        setError('Failed to enter Ghost Mode');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enter Ghost Mode');
    } finally {
      setLoading(false);
    }
  };

  const copyPin = async () => {
    await navigator.clipboard.writeText(generatedPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            {mode === 'disclaimer' && 'Please read and accept the disclaimer to continue'}
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

          {mode === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          )}

          {mode === 'choose' && (
            <div className="space-y-3">
              {sessionStatus?.canEnterDirectly ? (
                <Button
                  onClick={handleDirectEnter}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={loading}
                >
                  <Ghost className="h-4 w-4 mr-2" />
                  {loading ? 'Entering...' : 'Enter Ghost Mode'}
                </Button>
              ) : sessionStatus?.needsPin ? (
                <Button
                  onClick={() => setMode('join')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Join Ghost Mode using PIN
                </Button>
              ) : (
                <Button
                  onClick={() => setMode('disclaimer')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Start Ghost Session with {partnerName || partnerId}
                </Button>
              )}
              
              {!sessionStatus?.canEnterDirectly && !sessionStatus?.needsPin && (
                <Button
                  onClick={() => setMode('join')}
                  variant="outline"
                  className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/20"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Join with PIN
                </Button>
              )}
              
              {sessionStatus?.canEnterDirectly && (
                <p className="text-xs text-green-400 text-center mt-2">
                  You have an active Ghost Mode session. Click above to enter directly.
                </p>
              )}
              
              {sessionStatus?.needsPin && (
                <p className="text-xs text-purple-400 text-center mt-2">
                  Your partner activated Ghost Mode. Enter the PIN they shared to join.
                </p>
              )}
              
              <p className="text-xs text-gray-500 text-center mt-4">
                Ghost Mode messages are end-to-end encrypted, auto-expire in 24 hours,
                and are hidden from your main chat history.
              </p>
            </div>
          )}

          {mode === 'disclaimer' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-amber-400">Confidentiality Warning</h4>
                    <p className="text-sm text-gray-300">
                      Ghost Mode provides completely invisible encrypted chat sessions. By activating Ghost Mode:
                    </p>
                    <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
                      <li>All conversations are strictly confidential</li>
                      <li>You agree NOT to share, screenshot, or disclose any Ghost Mode content to anyone</li>
                      <li>Messages auto-expire and cannot be recovered</li>
                      <li>The system generates a secure PIN that will be shared in your normal chat</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-300">
                    A secure 6-digit PIN will be auto-generated and sent as a message in your normal chat with <strong className="text-purple-400">{partnerName || partnerId}</strong>. You cannot edit this PIN - only regenerate it.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-800/50 rounded-lg">
                <Checkbox
                  id="disclaimer"
                  checked={disclaimerAgreed}
                  onCheckedChange={(checked) => setDisclaimerAgreed(checked === true)}
                  className="mt-0.5 border-purple-500 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                />
                <label
                  htmlFor="disclaimer"
                  className="text-sm text-gray-300 cursor-pointer leading-relaxed"
                >
                  I understand and agree that Ghost Mode conversations are strictly confidential and must NOT be shared or disclosed to anyone. I accept responsibility for maintaining the privacy of these communications.
                </label>
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
                  onClick={handleGeneratePin}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  disabled={loading || !disclaimerAgreed}
                >
                  {loading ? 'Generating...' : 'Generate Ghost PIN'}
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
                <div className="flex items-center justify-center gap-2 text-green-400 text-sm mb-3">
                  <Check className="h-4 w-4" />
                  Ghost Mode Activated
                </div>
                <div className="relative">
                  <div className="text-4xl font-mono tracking-[0.3em] text-white bg-gray-800/50 py-4 rounded-lg flex items-center justify-center gap-3">
                    <span>{showPin ? generatedPin : '******'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                      <button
                        type="button"
                        onClick={copyPin}
                        className="text-gray-400 hover:text-white p-1"
                      >
                        {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  This PIN has been automatically sent to your chat with {partnerName || partnerId}.
                  The PIN expires in 1 hour.
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <p className="text-xs text-gray-400 text-center">
                  Your partner can now join using this PIN by clicking the Ghost Mode button in their chat and selecting "Join with PIN".
                </p>
              </div>
              <Button
                onClick={() => setIsOpen(false)}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GhostModeButton;
