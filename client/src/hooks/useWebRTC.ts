import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

export interface CallState {
  isInCall: boolean;
  isRinging: boolean;
  isIncoming: boolean;
  callType: 'video' | 'audio' | null;
  remoteUser: string | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callStatus: 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
  isRecipientOnline: boolean;
}

interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

const defaultConfig: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export function useWebRTC(
  currentUsername: string,
  onCallEnded?: () => void
) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const [callState, setCallState] = useState<CallState>({
    isInCall: false,
    isRinging: false,
    isIncoming: false,
    callType: null,
    remoteUser: null,
    isMuted: false,
    isVideoOff: false,
    callStatus: 'idle',
    isRecipientOnline: false,
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const setSocket = useCallback((socket: Socket | null) => {
    socketRef.current = socket;
  }, []);

  const createPeerConnection = useCallback((remoteUser: string) => {
    const pc = new RTCPeerConnection(defaultConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('Sending ICE candidate to:', remoteUser);
        socketRef.current.emit('webrtc-ice-candidate', {
          to: remoteUser,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track');
      const [stream] = event.streams;
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        setCallState((prev) => ({ ...prev, callStatus: 'connected' }));
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  const getMediaStream = useCallback(async (callType: 'video' | 'audio') => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video' ? { facingMode: 'user', width: 1280, height: 720 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, []);

  const startCall = useCallback(async (to: string, callType: 'video' | 'audio') => {
    if (!socketRef.current) {
      console.error('Socket not available for starting call');
      return;
    }

    try {
      console.log('Starting call to:', to, 'type:', callType);
      setCallState({
        isInCall: true,
        isRinging: false,
        isIncoming: false,
        callType,
        remoteUser: to,
        isMuted: false,
        isVideoOff: false,
        callStatus: 'calling',
        isRecipientOnline: false,
      });

      const stream = await getMediaStream(callType);
      const pc = createPeerConnection(to);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('Sending call offer to:', to);
      socketRef.current.emit('webrtc-call-offer', {
        to,
        offer,
        callType,
        from: currentUsername,
      });
    } catch (error) {
      console.error('Error starting call:', error);
      endCall();
    }
  }, [currentUsername, getMediaStream, createPeerConnection]);

  const handleIncomingOffer = useCallback((from: string, callType: 'video' | 'audio') => {
    console.log('Handling incoming offer from:', from, 'type:', callType);
    
    if (callState.isInCall) {
      console.log('Already in a call, rejecting incoming offer from:', from);
      if (socketRef.current) {
        socketRef.current.emit('webrtc-call-reject', {
          to: from,
          from: currentUsername,
          reason: 'busy',
        });
      }
      return false;
    }
    
    setCallState({
      isInCall: true,
      isRinging: true,
      isIncoming: true,
      callType,
      remoteUser: from,
      isMuted: false,
      isVideoOff: false,
      callStatus: 'ringing',
      isRecipientOnline: true,
    });
    pendingCandidatesRef.current = [];
    return true;
  }, [callState.isInCall, currentUsername]);

  const acceptCall = useCallback(async (from: string, offer: RTCSessionDescriptionInit, callType: 'video' | 'audio') => {
    if (!socketRef.current) {
      console.error('Socket not available for accepting call');
      return;
    }

    try {
      console.log('Accepting call from:', from);
      setCallState((prev) => ({
        ...prev,
        callStatus: 'connecting',
        isRinging: false,
      }));

      const stream = await getMediaStream(callType);
      const pc = createPeerConnection(from);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      pendingCandidatesRef.current.forEach(async (candidate) => {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.error('Error adding buffered ICE candidate:', e);
        }
      });
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('Sending call answer to:', from);
      socketRef.current.emit('webrtc-call-answer', {
        to: from,
        answer,
        from: currentUsername,
      });
    } catch (error) {
      console.error('Error accepting call:', error);
      endCall();
    }
  }, [currentUsername, getMediaStream, createPeerConnection]);

  const handleCallAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    console.log('Handling call answer');
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setCallState((prev) => ({ ...prev, callStatus: 'connecting' }));

        pendingCandidatesRef.current.forEach(async (candidate) => {
          try {
            await peerConnectionRef.current?.addIceCandidate(candidate);
          } catch (e) {
            console.error('Error adding buffered ICE candidate:', e);
          }
        });
        pendingCandidatesRef.current = [];
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    console.log('Handling ICE candidate');
    const iceCandidate = new RTCIceCandidate(candidate);
    
    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
      try {
        await peerConnectionRef.current.addIceCandidate(iceCandidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    } else {
      console.log('Buffering ICE candidate');
      pendingCandidatesRef.current.push(iceCandidate);
    }
  }, []);

  const rejectCall = useCallback((from: string) => {
    if (socketRef.current) {
      socketRef.current.emit('webrtc-call-reject', {
        to: from,
        from: currentUsername,
      });
    }
    setCallState({
      isInCall: false,
      isRinging: false,
      isIncoming: false,
      callType: null,
      remoteUser: null,
      isMuted: false,
      isVideoOff: false,
      callStatus: 'idle',
      isRecipientOnline: false,
    });
    pendingCandidatesRef.current = [];
  }, [currentUsername]);

  const cleanupCall = useCallback(() => {
    console.log('Cleaning up call resources');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallState({
      isInCall: false,
      isRinging: false,
      isIncoming: false,
      callType: null,
      remoteUser: null,
      isMuted: false,
      isVideoOff: false,
      callStatus: 'idle',
      isRecipientOnline: false,
    });
    pendingCandidatesRef.current = [];

    onCallEnded?.();
  }, [onCallEnded]);

  const handleRecipientOnline = useCallback(() => {
    console.log('Recipient came online - transitioning to ringing state');
    setCallState((prev) => ({ 
      ...prev, 
      callStatus: 'ringing',
      isRecipientOnline: true,
    }));
  }, []);

  const handleRecipientOffline = useCallback(() => {
    console.log('Recipient is offline - staying in calling state');
    setCallState((prev) => ({ 
      ...prev, 
      callStatus: 'calling',
      isRecipientOnline: false,
    }));
  }, []);

  const cancelCall = useCallback(() => {
    console.log('Canceling call (user initiated)');
    
    const remoteUser = callState.remoteUser;
    
    if (remoteUser && socketRef.current) {
      socketRef.current.emit('webrtc-call-cancel', {
        to: remoteUser,
        from: currentUsername,
      });
    }

    cleanupCall();
  }, [currentUsername, callState.remoteUser, cleanupCall]);

  const endCall = useCallback(() => {
    console.log('Ending call (user initiated)');
    
    const remoteUser = callState.remoteUser;
    
    if (remoteUser && socketRef.current) {
      socketRef.current.emit('webrtc-call-end', {
        to: remoteUser,
        from: currentUsername,
      });
    }

    cleanupCall();
  }, [currentUsername, callState.remoteUser, cleanupCall]);

  const handleCallEnd = useCallback(() => {
    console.log('Remote ended call');
    cleanupCall();
  }, [cleanupCall]);

  const handleCallReject = useCallback(() => {
    console.log('Call was rejected');
    cleanupCall();
  }, [cleanupCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setCallState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCallState((prev) => ({ ...prev, isVideoOff: !videoTrack.enabled }));
      }
    }
  }, []);

  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current || callState.callType !== 'video') return;

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const constraints = videoTrack.getConstraints();
    const facingMode = constraints.facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      videoTrack.stop();
      localStreamRef.current.removeTrack(videoTrack);
      localStreamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  }, [callState.callType]);

  return {
    callState,
    localStream,
    remoteStream,
    setSocket,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    cancelCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    handleIncomingOffer,
    handleCallAnswer,
    handleIceCandidate,
    handleCallEnd,
    handleCallReject,
    handleRecipientOnline,
    handleRecipientOffline,
  };
}
