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
      }
    } else {
      navigate('/');
      return;
    }

    let countdownInterval: ReturnType<typeof setInterval> | null = null;
    const startCountdown = (seconds: number) => {
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
      <div style={{ padding: '20px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h2>Waiting for opponent...</h2>
        
        <div style={{ 
          padding: '20px', 
          background: '#e3f2fd', 
          color: '#1565c0',
          marginTop: '20px', 
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Share this Game ID with a friend:</p>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '10px',
            marginTop: '10px'
          }}>
            <code style={{ 
              padding: '10px 15px', 
              background: '#fff', 
              borderRadius: '4px',
              fontSize: '16px',
              fontFamily: 'monospace',
              border: '1px solid #90caf9',
              userSelect: 'all',
              wordBreak: 'break-all'
            }}>
              {gameId}
            </code>
            <button 
              onClick={copyGameId}
              style={{
                padding: '10px 15px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Copy
            </button>
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#666' }}>
            Your friend can join by entering this ID on the home page
          </p>
        </div>

        {botCountdown !== null && botCountdown > 0 && (
          <div style={{ 
            padding: '20px', 
            background: '#fff3e0', 
            color: '#e65100',
            marginTop: '20px', 
            borderRadius: '8px',
            fontSize: '16px'
          }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>
              If no participant joins, a bot will automatically join in <strong>{botCountdown}</strong> second{botCountdown !== 1 ? 's' : ''}.
            </p>
            <div style={{ 
              width: '100%', 
              height: '10px', 
              background: '#ffcc80', 
              borderRadius: '5px',
              overflow: 'hidden',
              marginTop: '10px'
            }}>
              <div style={{ 
                width: `${((10 - botCountdown) / 10) * 100}%`, 
                height: '100%', 
                background: '#ff9800',
                transition: 'width 1s linear'
              }} />
            </div>
          </div>
        )}
        {botCountdown === 0 && (
          <div style={{ 
            padding: '20px', 
            background: '#e8f5e9', 
            color: '#2e7d32',
            marginTop: '20px', 
            borderRadius: '8px',
            fontSize: '16px'
          }}>
            <p>Bot is joining the game...</p>
          </div>
        )}
      </div>
    );
  }

  if (!game) {
    return (
      <div style={{ padding: '20px' }}>
        <p>Game not found</p>
        <button onClick={handleBackToHome}>Back to Home</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Game #{gameId?.slice(0, 8) || 'Unknown'}</h1>
        <button
          onClick={handleBackToHome}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            backgroundColor: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Home
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', marginBottom: '10px', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {botCountdown !== null && botCountdown > 0 && game && game.player2?.type === 'bot' && (
        <div style={{ 
          padding: '15px', 
          background: '#fff3e0', 
          color: '#e65100',
          marginBottom: '20px', 
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '16px'
        }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
            Waiting for opponent...
          </p>
          <p style={{ margin: 0 }}>
            If no participant joins, a bot will automatically join in <strong>{botCountdown}</strong> second{botCountdown !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      {game && (game.status === 'won' || game.status === 'draw') && (
        <div style={{ 
          padding: '20px', 
          background: game.status === 'won' ? '#e8f5e9' : '#fff3e0', 
          color: game.status === 'won' ? '#2e7d32' : '#e65100',
          marginBottom: '20px', 
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
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

