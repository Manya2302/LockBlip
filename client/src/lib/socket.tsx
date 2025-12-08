import React, { createContext, useContext, useRef, useCallback, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';

interface SocketContextValue {
  socket: Socket | null;
  setSocket: (socket: Socket | null) => void;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  setSocket: () => {},
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const setSocket = useCallback((socket: Socket | null) => {
    socketRef.current = socket;
    setIsConnected(!!socket);
    
    if (socket) {
      socket.on('connect', () => setIsConnected(true));
      socket.on('disconnect', () => setIsConnected(false));
    }
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, setSocket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  return context;
}

export function useSocketRef() {
  const socketRef = useRef<Socket | null>(null);
  
  const setSocket = useCallback((socket: Socket | null) => {
    socketRef.current = socket;
  }, []);
  
  return { socketRef, setSocket };
}

export default SocketContext;
