import React, { useState } from 'react';

interface PlayerInputProps {
  onJoin: (username: string) => void;
}

const PlayerInput: React.FC<PlayerInputProps> = ({ onJoin }) => {
  const [username, setUsername] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onJoin(username.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="username" style={{ display: 'block', marginBottom: '5px' }}>
          Enter your username:
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          style={{
            padding: '8px',
            fontSize: '16px',
            width: '200px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>
      <button
        type="submit"
        style={{
          padding: '8px 16px',
          fontSize: '16px',
          backgroundColor: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Join Game
      </button>
    </form>
  );
};

export default PlayerInput;

