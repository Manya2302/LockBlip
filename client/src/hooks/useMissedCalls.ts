import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface MissedCallCounts {
  totalMissed: number;
  perUser: {
    [callerId: string]: {
      voice: number;
      video: number;
    };
  };
}

interface MissedCall {
  _id: string;
  callerId: string;
  receiverId: string;
  callType: 'voice' | 'video';
  isSeen: boolean;
  timestamp: string;
}

export function useMissedCalls(token: string | null, socketRef?: React.MutableRefObject<Socket | null>) {
  const [counts, setCounts] = useState<MissedCallCounts>({ totalMissed: 0, perUser: {} });
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const internalSocketRef = useRef<Socket | null>(null);
  
  const activeSocket = socketRef?.current || internalSocketRef.current;

  const fetchMissedCallCounts = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/missed-calls/counts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCounts(data);
      }
    } catch (error) {
      console.error('Error fetching missed call counts:', error);
    }
  }, [token]);

  const fetchMissedCalls = useCallback(async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/missed-calls', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMissedCalls(data.missedCalls);
      }
    } catch (error) {
      console.error('Error fetching missed calls:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const markCallsAsSeen = useCallback(async (callerId: string) => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/missed-calls/mark-seen', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callerId }),
      });
      
      if (response.ok) {
        setCounts(prev => {
          const newPerUser = { ...prev.perUser };
          const callerCounts = newPerUser[callerId];
          if (callerCounts) {
            const removedCount = callerCounts.voice + callerCounts.video;
            delete newPerUser[callerId];
            return {
              totalMissed: Math.max(0, prev.totalMissed - removedCount),
              perUser: newPerUser,
            };
          }
          return prev;
        });
        
        if (activeSocket) {
          activeSocket.emit('reset_missed_calls', { callerId });
        }
      }
    } catch (error) {
      console.error('Error marking missed calls as seen:', error);
    }
  }, [token, activeSocket]);

  const markCallsAsSeenByType = useCallback(async (callerId: string, callType: 'voice' | 'video') => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/missed-calls/mark-seen-by-type', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callerId, callType }),
      });
      
      if (response.ok) {
        setCounts(prev => {
          const newPerUser = { ...prev.perUser };
          const callerCounts = newPerUser[callerId];
          if (callerCounts) {
            const typeCount = callType === 'voice' ? callerCounts.voice : callerCounts.video;
            if (callType === 'voice') {
              callerCounts.voice = 0;
            } else {
              callerCounts.video = 0;
            }
            if (callerCounts.voice === 0 && callerCounts.video === 0) {
              delete newPerUser[callerId];
            }
            return {
              totalMissed: Math.max(0, prev.totalMissed - typeCount),
              perUser: newPerUser,
            };
          }
          return prev;
        });
        
        if (activeSocket) {
          activeSocket.emit('reset_missed_calls_by_type', { callerId, callType });
        }
      }
    } catch (error) {
      console.error('Error marking missed calls by type as seen:', error);
    }
  }, [token, activeSocket]);

  const markAllAsSeen = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/missed-calls/mark-all-seen', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        setCounts({ totalMissed: 0, perUser: {} });
        setMissedCalls(prev => prev.map(call => ({ ...call, isSeen: true })));
      }
    } catch (error) {
      console.error('Error marking all missed calls as seen:', error);
    }
  }, [token]);

  const getCountsForUser = useCallback((callerId: string) => {
    return counts.perUser[callerId] || { voice: 0, video: 0 };
  }, [counts.perUser]);

  useEffect(() => {
    if (token) {
      fetchMissedCallCounts();
    }
  }, [token, fetchMissedCallCounts]);

  useEffect(() => {
    const socket = activeSocket;
    if (!socket) return;

    const handleMissedCallUpdate = (data: MissedCallCounts) => {
      setCounts(data);
    };

    const handleNewMissedCall = (data: { callerId: string; callType: 'voice' | 'video' }) => {
      setCounts(prev => {
        const newPerUser = { ...prev.perUser };
        if (!newPerUser[data.callerId]) {
          newPerUser[data.callerId] = { voice: 0, video: 0 };
        }
        if (data.callType === 'voice') {
          newPerUser[data.callerId].voice++;
        } else {
          newPerUser[data.callerId].video++;
        }
        return {
          totalMissed: prev.totalMissed + 1,
          perUser: newPerUser,
        };
      });
    };

    socket.on('missed_call_update', handleMissedCallUpdate);
    socket.on('new_missed_call', handleNewMissedCall);

    return () => {
      socket.off('missed_call_update', handleMissedCallUpdate);
      socket.off('new_missed_call', handleNewMissedCall);
    };
  }, [activeSocket]);

  return {
    counts,
    missedCalls,
    isLoading,
    fetchMissedCalls,
    fetchMissedCallCounts,
    markCallsAsSeen,
    markCallsAsSeenByType,
    markAllAsSeen,
    getCountsForUser,
    totalMissed: counts.totalMissed,
  };
}

export default useMissedCalls;
