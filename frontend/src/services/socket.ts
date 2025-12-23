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
        transports: ['websocket', 'polling']
      });

      globalSocket.on('connect', () => {
        setConnected(true);
      });

      globalSocket.on('disconnect', () => {
        setConnected(false);
      });
    }

    setSocket(globalSocket);
    setConnected(globalSocket.connected);

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    globalSocket.on('connect', handleConnect);
    globalSocket.on('disconnect', handleDisconnect);

    return () => {
      globalSocket?.off('connect', handleConnect);
      globalSocket?.off('disconnect', handleDisconnect);
    };
  }, []);

  return { socket, connected };
}

