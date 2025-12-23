import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../config/api';

const SOCKET_URL: string = getApiUrl();

let globalSocket: Socket | null = null;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
      });

      globalSocket.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
      });

      globalSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setConnected(false);
        if (reason === 'io server disconnect') {
          globalSocket?.connect();
        }
      });

      globalSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        setConnected(true);
      });
    }

    const currentSocket = globalSocket;
    if (currentSocket) {
      setSocket(currentSocket);
      setConnected(currentSocket.connected);

      const handleConnect = () => {
        console.log('Socket connected (handler)');
        setConnected(true);
      };
      const handleDisconnect = () => {
        console.log('Socket disconnected (handler)');
        setConnected(false);
      };

      currentSocket.on('connect', handleConnect);
      currentSocket.on('disconnect', handleDisconnect);

      return () => {
        currentSocket.off('connect', handleConnect);
        currentSocket.off('disconnect', handleDisconnect);
      };
    }
  }, []);

  return { socket, connected };
}

