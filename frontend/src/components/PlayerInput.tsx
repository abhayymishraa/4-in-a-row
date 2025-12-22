import React, { useState } from 'react';

interface PlayerInputProps {
  onCreateGame: (username: string) => void;
  onJoinGame: (username: string, gameId: string) => void;
}

const PlayerInput: React.FC<PlayerInputProps> = ({ onCreateGame, onJoinGame }) => {
  const [username, setUsername] = useState<string>('');
  const [gameId, setGameId] = useState<string>('');

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem('username', username.trim());
      onCreateGame(username.trim());
    }
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && gameId.trim()) {
      localStorage.setItem('username', username.trim());
      localStorage.setItem('gameId', gameId.trim());
      onJoinGame(username.trim(), gameId.trim());
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <form onSubmit={handleCreateGame}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="username" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Username (Required):
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            style={{
              padding: '10px',
              fontSize: '16px',
              width: '100%',
              maxWidth: '400px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="gameId" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Game ID (Optional - for joining existing game):
          </label>
          <input
            id="gameId"
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Enter game ID to join"
            style={{
              padding: '10px',
              fontSize: '16px',
              width: '100%',
              maxWidth: '400px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Create Game
          </button>
          
          <button
            type="button"
            onClick={handleJoinGame}
            disabled={!username.trim() || !gameId.trim()}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: gameId.trim() ? '#2196f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: gameId.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              opacity: gameId.trim() ? 1 : 0.6
            }}
          >
            Join Game
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlayerInput;
