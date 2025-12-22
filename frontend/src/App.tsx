import React, { useState, useEffect } from 'react';
import { useSocket } from './services/socket';
import PlayerInput from './components/PlayerInput';
import GameBoard from './components/GameBoard';
import GameStatus from './components/GameStatus';
import Leaderboard from './components/Leaderboard';

function App() {
  const { socket, connected } = useSocket();
  const [username, setUsername] = useState<string>('');
  const [game, setGame] = useState<any>(null);
  const [waiting, setWaiting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('waiting-for-opponent', () => {
      setWaiting(true);
      setError('');
    });

    socket.on('game-update', (gameData: any) => {
      setGame(gameData);
      setWaiting(false);
      setError('');
    });

    socket.on('move-made', (data: any) => {
      setGame(data.game);
      setError('');
    });

    socket.on('game-over', (data: any) => {
      setGame(data.game);
      setError('');
      fetchLeaderboard();
    });

    socket.on('player-disconnected', () => {
      setError('Opponent disconnected. Waiting for reconnection...');
    });

    socket.on('player-reconnected', () => {
      setError('');
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    return () => {
      socket.off('waiting-for-opponent');
      socket.off('game-update');
      socket.off('move-made');
      socket.off('game-over');
      socket.off('player-disconnected');
      socket.off('player-reconnected');
      socket.off('error');
    };
  }, [socket]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/leaderboard');
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard', error);
    }
  };

  const handleJoinGame = (name: string) => {
    if (!socket || !connected) {
      setError('Not connected to server');
      return;
    }
    setUsername(name);
    socket.emit('join-game', { username: name });
  };

  const handleMakeMove = (column: number) => {
    if (!socket || !game) return;
    socket.emit('make-move', { gameId: game.id, column });
  };

  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1', minWidth: '300px' }}>
        <h1>4-in-a-Row Game</h1>
        {!username ? (
          <PlayerInput onJoin={handleJoinGame} />
        ) : (
          <>
            {error && (
              <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', marginBottom: '10px', borderRadius: '4px' }}>
                {error}
              </div>
            )}
            {waiting && (
              <div style={{ padding: '10px', background: '#e3f2fd', color: '#1565c0', marginBottom: '10px', borderRadius: '4px' }}>
                Waiting for opponent...
              </div>
            )}
            {game && (
              <>
                <GameStatus game={game} currentUsername={username} />
                <GameBoard game={game} onMakeMove={handleMakeMove} currentUsername={username} />
              </>
            )}
          </>
        )}
      </div>
      <div style={{ flex: '0 0 300px' }}>
        <Leaderboard leaderboard={leaderboard} />
      </div>
    </div>
  );
}

export default App;

