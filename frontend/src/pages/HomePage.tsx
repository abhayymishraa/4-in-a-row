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
      console.log('Game created:', data.gameId);
      localStorage.setItem('gameId', data.gameId);
      localStorage.setItem('isGameCreator', 'true');
      navigate(`/game/${data.gameId}`);
    };

    const handleGameUpdate = (gameData: any) => {
      console.log('Game update:', gameData.id);
      navigate(`/game/${gameData.id}`);
    };

    const handleUsernameTaken = (data: { requestedUsername: string; assignedUsername: string; message: string }) => {
      console.warn('Username taken:', data.message);
      localStorage.setItem('username', data.assignedUsername);
      setError(data.message);
      setTimeout(() => setError(''), 5000);
    };

    const handleError = (data: { message: string }) => {
      console.error('Socket error:', data.message);
      setError(data.message || 'An error occurred. Please try again.');
    };

    socket.on('game-created', handleGameCreated);
    socket.on('game-update', handleGameUpdate);
    socket.on('username-taken', handleUsernameTaken);
    socket.on('error', handleError);
    
    socket.on('game-over', () => {
      fetchLeaderboard();
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setError('');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setError('Connection lost. Please refresh the page.');
    });

    return () => {
      socket.off('game-created', handleGameCreated);
      socket.off('game-update', handleGameUpdate);
      socket.off('username-taken', handleUsernameTaken);
      socket.off('error', handleError);
      socket.off('game-over');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket, navigate]);

  useEffect(() => {
    fetchLeaderboard();
    
    const interval = setInterval(() => {
      fetchLeaderboard();
    }, 5000);
    
    return () => clearInterval(interval);
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
    console.log('Creating game with username:', username);
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
    console.log('Joining game:', gameId, 'with username:', username);
    socket.emit('join-game', { username: username.trim(), gameId: gameId.trim() });
  };

  return (
    <div className="flex gap-5 flex-wrap p-5">
      <div className="flex-1 min-w-[300px]">
        <h1 className="text-4xl font-bold mb-6 text-gray-800">4-in-a-Row Game</h1>
        {error && (
          <div className="p-3 bg-red-50 text-red-700 mb-4 rounded-lg border border-red-200">
            {error}
          </div>
        )}
        <PlayerInput onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />
        <div className="mt-5 p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
          <p className="mb-2"><strong>Create Game:</strong> Enter your username and click "Create Game" to start a new game room.</p>
          <p className="mb-2"><strong>Join Game:</strong> Enter your username and a game ID to join an existing game.</p>
          <p>If no opponent joins within 10 seconds, a bot will automatically join your game.</p>
        </div>
      </div>
      <div className="flex-none w-[300px]">
        <Leaderboard leaderboard={leaderboard} onRefresh={fetchLeaderboard} />
      </div>
    </div>
  );
}

export default HomePage;
