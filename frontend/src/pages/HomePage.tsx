import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../services/socket';
import PlayerInput from '../components/PlayerInput';
import Leaderboard from '../components/Leaderboard';

function HomePage() {
  const { socket, connected } = useSocket();
  const [error, setError] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket) {
      setError('Not connected to server. Please refresh the page.');
      return;
    }

    const handleGameCreated = (data: { gameId: string; game: any; botJoinTime: number }) => {
      localStorage.setItem('gameId', data.gameId);
      localStorage.setItem('isGameCreator', 'true');
      navigate(`/game/${data.gameId}`);
    };

    const handleGameUpdate = (gameData: any) => {
      navigate(`/game/${gameData.id}`);
    };

    const handleUsernameTaken = (data: { requestedUsername: string; assignedUsername: string; message: string }) => {
      localStorage.setItem('username', data.assignedUsername);
      setError(data.message);
      setTimeout(() => setError(''), 5000);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message || 'An error occurred. Please try again.');
    };

    socket.on('game-created', handleGameCreated);
    socket.on('game-update', handleGameUpdate);
    socket.on('username-taken', handleUsernameTaken);
    socket.on('error', handleError);

    socket.on('connect', () => {
      setError('');
    });

    socket.on('disconnect', () => {
      setError('Connection lost. Please refresh the page.');
    });

    return () => {
      socket.off('game-created', handleGameCreated);
      socket.off('game-update', handleGameUpdate);
      socket.off('username-taken', handleUsernameTaken);
      socket.off('error', handleError);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket, navigate]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/leaderboard');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard);
      } else {
        setLeaderboard([]);
      }
    } catch (error) {
      setLeaderboard([]);
    }
  };

  const handleCreateGame = (username: string) => {
    if (!socket) {
      setError('Not connected to server. Please refresh the page.');
      return;
    }

    if (!connected) {
      setError('Connecting to server... Please wait.');
      return;
    }

    if (!username || username.trim().length === 0) {
      setError('Please enter a valid username');
      return;
    }

    setError('');
    socket.emit('create-game', { username: username.trim() });
  };

  const handleJoinGame = (username: string, gameId: string) => {
    if (!socket) {
      setError('Not connected to server. Please refresh the page.');
      return;
    }

    if (!connected) {
      setError('Connecting to server... Please wait.');
      return;
    }

    if (!username || username.trim().length === 0) {
      setError('Please enter a valid username');
      return;
    }

    if (!gameId || gameId.trim().length === 0) {
      setError('Please enter a game ID to join');
      return;
    }

    setError('');
    socket.emit('join-game', { username: username.trim(), gameId: gameId.trim() });
  };

  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '20px' }}>
      <div style={{ flex: '1', minWidth: '300px' }}>
        <h1>4-in-a-Row Game</h1>
        {error && (
          <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', marginBottom: '10px', borderRadius: '4px' }}>
            {error}
          </div>
        )}
        <PlayerInput onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />
        <div style={{ marginTop: '20px', padding: '10px', background: '#e3f2fd', color: '#1565c0', borderRadius: '4px' }}>
          <p><strong>Create Game:</strong> Enter your username and click "Create Game" to start a new game room.</p>
          <p><strong>Join Game:</strong> Enter your username and a game ID to join an existing game.</p>
          <p>If no opponent joins within 10 seconds, a bot will automatically join your game.</p>
        </div>
      </div>
      <div style={{ flex: '0 0 300px' }}>
        <Leaderboard leaderboard={leaderboard} />
      </div>
    </div>
  );
}

export default HomePage;
