import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ghost, Lock, ArrowRight, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GhostPinJoinFormProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (pin: string) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
  partnerName: string;
}

export default function GhostPinJoinForm({ isOpen, onClose, onJoin, partnerName }: GhostPinJoinFormProps) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await onJoin(pin);
      if (result.success) {
        setPin('');
        onClose();
      } else {
        setError(result.error || 'Invalid PIN');
      }
    } catch (err) {
      setError('Failed to join Ghost Mode');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border border-purple-500/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Ghost className="w-5 h-5 text-purple-500" />
            Join Ghost Mode
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            <span className="font-medium text-purple-400">{partnerName}</span> has invited you to a private Ghost Mode session.
            Enter the 6-digit PIN they shared with you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={handlePinChange}
                placeholder="Enter 6-digit PIN"
                className="pl-10 bg-gray-800 border-purple-500/30 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-gray-500 placeholder:tracking-normal placeholder:text-base focus:border-purple-500"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <X className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>

          <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-3">
            <p className="text-purple-300 text-xs">
              Ghost Mode messages are end-to-end encrypted and auto-delete after viewing. 
              All messages will be permanently erased when the session ends.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pin.length !== 6 || isLoading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Enter Ghost Mode
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
