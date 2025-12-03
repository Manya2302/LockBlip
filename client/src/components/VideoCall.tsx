import { useRef, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CallState } from '@/hooks/useWebRTC';

interface VideoCallProps {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onCancel: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
}

export default function VideoCall({
  callState,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
  onCancel,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
}: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const initials = callState.remoteUser
    ? callState.remoteUser.slice(0, 2).toUpperCase()
    : '??';

  const getStatusText = () => {
    switch (callState.callStatus) {
      case 'calling':
        return callState.isRecipientOnline ? 'Ringing...' : 'Calling...';
      case 'ringing':
        return 'Incoming call';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      default:
        return '';
    }
  };

  const handleEndOrCancel = () => {
    if (callState.callStatus === 'calling' || callState.callStatus === 'ringing') {
      if (!callState.isIncoming) {
        onCancel();
      } else {
        onReject();
      }
    } else {
      onEnd();
    }
  };

  if (!callState.isInCall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {callState.isRinging && callState.isIncoming ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="animate-pulse mb-8">
            <Avatar className="h-32 w-32">
              <AvatarFallback className="bg-primary text-4xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="text-2xl font-semibold mb-2">{callState.remoteUser}</h2>
          <p className="text-gray-400 mb-2">{callState.callType === 'video' ? 'Video call' : 'Voice call'}</p>
          <p className="text-primary animate-pulse">{getStatusText()}</p>

          <div className="mt-16 flex gap-8">
            <Button
              size="lg"
              variant="destructive"
              className="rounded-full h-16 w-16"
              onClick={onReject}
            >
              <PhoneOff className="h-8 w-8" />
            </Button>
            <Button
              size="lg"
              className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600"
              onClick={onAccept}
            >
              <Phone className="h-8 w-8" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1">
            {callState.callType === 'video' && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white">
                <Avatar className="h-32 w-32 mb-6">
                  <AvatarFallback className="bg-primary/20 text-4xl font-bold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-2xl font-semibold">{callState.remoteUser}</h2>
                <p className="text-gray-400 mt-2">{getStatusText()}</p>
              </div>
            )}

            {callState.callType === 'video' && localStream && (
              <div className="absolute top-4 right-4 w-32 h-44 rounded-lg overflow-hidden shadow-lg border-2 border-primary/50">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {callState.isVideoOff && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <VideoOff className="h-8 w-8 text-white/50" />
                  </div>
                )}
              </div>
            )}

            {!callState.isRinging && callState.callStatus !== 'connected' && (
              <div className="absolute top-4 left-4 text-white">
                <p className="text-sm text-gray-400">{getStatusText()}</p>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 py-8 px-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                variant={callState.isMuted ? 'destructive' : 'secondary'}
                className="rounded-full h-14 w-14"
                onClick={onToggleMute}
              >
                {callState.isMuted ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>

              {callState.callType === 'video' && (
                <>
                  <Button
                    size="lg"
                    variant={callState.isVideoOff ? 'destructive' : 'secondary'}
                    className="rounded-full h-14 w-14"
                    onClick={onToggleVideo}
                  >
                    {callState.isVideoOff ? (
                      <VideoOff className="h-6 w-6" />
                    ) : (
                      <Video className="h-6 w-6" />
                    )}
                  </Button>

                  <Button
                    size="lg"
                    variant="secondary"
                    className="rounded-full h-14 w-14"
                    onClick={onSwitchCamera}
                  >
                    <SwitchCamera className="h-6 w-6" />
                  </Button>
                </>
              )}

              <Button
                size="lg"
                variant="destructive"
                className="rounded-full h-14 w-14"
                onClick={handleEndOrCancel}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
