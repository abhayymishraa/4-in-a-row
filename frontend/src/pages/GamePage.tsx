import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../services/socket';
import GameBoard from '../components/GameBoard';
import GameStatus from '../components/GameStatus';

function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [game, setGame] = useState<any>(null);
  const [username, setUsername] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [botCountdown, setBotCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!socket || !gameId) return;

    const storedUsername = localStorage.getItem('username');
    const isCreator = localStorage.getItem('isGameCreator') === 'true';

    if (storedUsername) {
      setUsername(storedUsername);

      if (!isCreator) {
        socket.emit('join-game', { username: storedUsername, gameId });
      } else {
        localStorage.removeItem('isGameCreator');
        // Start countdown immediately for game creators
        setBotCountdown(10);
      }
    } else {
      navigate('/');
      return;
    }

    let countdownInterval: ReturnType<typeof setInterval> | null = null;
    const startCountdown = (seconds: number) => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      setBotCountdown(seconds);
      countdownInterval = setInterval(() => {
        setBotCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownInterval) clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };

    // Start countdown for creators immediately
    if (isCreator) {
      startCountdown(10);
    }

    socket.on('game-created', (data: { gameId: string; game?: any; waiting?: boolean; botJoinTime: number }) => {
      if (data.waiting) {
        setLoading(true);
        setError('');
        if (data.botJoinTime) {
          startCountdown(Math.floor(data.botJoinTime / 1000));
        }
      } else if (data.game) {
        setGame(data.game);
        setLoading(false);
        setError('');
        if (countdownInterval) {
          clearInterval(countdownInterval);
          setBotCountdown(null);
        }
      }
    });

    socket.on('game-update', (gameData: any) => {
      setGame(gameData);
      setLoading(false);
      setError('');
      if (countdownInterval) {
        clearInterval(countdownInterval);
        setBotCountdown(null);
      }
    });

    socket.on('move-made', (data: any) => {
      setGame(data.game);
      setError('');
    });

    socket.on('game-over', (data: any) => {
      setGame(data.game);
      setError('');
      setLoading(false);
    });

    socket.on('player-disconnected', () => {
      setError('Opponent disconnected. Waiting for reconnection...');
    });

    socket.on('player-reconnected', () => {
      setError('');
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
      if (data.message.includes('not found') || data.message.includes('not a player')) {
        setTimeout(() => navigate('/'), 2000);
      }
    });

    return () => {
      socket.off('game-created');
      socket.off('game-update');
      socket.off('move-made');
      socket.off('game-over');
      socket.off('player-disconnected');
      socket.off('player-reconnected');
      socket.off('error');
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [socket, gameId, navigate]);

  const handleMakeMove = (column: number) => {
    if (!socket || !game || !gameId) return;
    socket.emit('make-move', { gameId: gameId as string, column });
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const copyGameId = () => {
    if (gameId) {
      navigator.clipboard.writeText(gameId);
    }
  };

  if (loading) {
    return (
      <div className="p-5 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-5">Waiting for opponent...</h2>
        
        <div className="p-5 bg-blue-50 text-blue-800 mt-5 rounded-lg border border-blue-200">
          <p className="mb-3 font-bold">Share this Game ID with a friend:</p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <code className="px-4 py-2 bg-white rounded text-base font-mono border border-blue-300 select-all break-all">
              {gameId}
            </code>
            <button 
              onClick={copyGameId}
              className="px-4 py-2 bg-blue-600 text-white border-none rounded cursor-pointer text-sm hover:bg-blue-700 transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-600">
            Your friend can join by entering this ID on the home page
          </p>
        </div>

        {botCountdown !== null && botCountdown > 0 && (
          <div className="p-5 bg-blue-50 text-blue-800 mt-5 rounded-lg border border-blue-200">
            <p className="mb-3 font-semibold text-center">
               Bot Auto-Join Timer
            </p>
            <div className="w-full h-4 bg-blue-200 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000 ease-linear rounded-full relative"
                style={{ width: `${((10 - botCountdown) / 10) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
              </div>
            </div>
            <div className="mt-3 flex justify-between text-sm text-blue-700 font-medium">
              <span>0s</span>
              <span className="font-bold text-blue-900">{botCountdown}s left</span>
              <span>10s</span>
            </div>
            <p className="mt-3 text-sm text-blue-700 italic">
              If no one joins in <span className="font-bold">{botCountdown}</span> second{botCountdown !== 1 ? 's' : ''}, a bot will automatically join
            </p>
          </div>
        )}
        {botCountdown === 0 && (
          <div className="p-5 bg-green-50 text-green-800 mt-5 rounded-lg border border-green-200">
            <div className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-3 border-green-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-semibold text-lg">Bot is joining the game...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="p-5">
        <p className="mb-4">Game not found</p>
        <button 
          onClick={handleBackToHome}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="mb-5 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Game #{gameId?.slice(0, 8) || 'Unknown'}</h1>
        <button
          onClick={handleBackToHome}
          className="px-4 py-2 text-sm bg-gray-500 text-white border-none rounded cursor-pointer hover:bg-gray-600 transition-colors"
        >
          Back to Home
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 mb-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {botCountdown !== null && botCountdown > 0 && game && game.player2?.type === 'bot' && (
        <div className="p-4 bg-orange-50 text-orange-700 mb-5 rounded-lg text-center">
          <p className="mb-1 font-bold">
            Waiting for opponent...
          </p>
          <p>
            If no participant joins, a bot will automatically join in <strong>{botCountdown}</strong> second{botCountdown !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      {game && (game.status === 'won' || game.status === 'draw') && (
        <div className={`p-5 mb-5 rounded-lg text-center text-2xl font-bold ${
          game.status === 'won' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
        }`}>
          {game.status === 'won' ? (
            game.winner && game.winner.username === username ? (
              'You Won!'
            ) : (
              `${game.winner?.username || 'Opponent'} Won!`
            )
          ) : (
            "It's a Draw!"
          )}
        </div>
      )}

      <GameStatus game={game} currentUsername={username} />
      <GameBoard game={game} onMakeMove={handleMakeMove} currentUsername={username} />
    </div>
  );
}

export default GamePage;
