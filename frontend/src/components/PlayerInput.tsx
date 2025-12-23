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
    <div className="mt-5">
      <form onSubmit={handleCreateGame}>
        <div className="mb-4">
          <label htmlFor="username" className="block mb-2 font-semibold text-gray-700">
            Username (Required):
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            className="w-full max-w-md px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="gameId" className="block mb-2 font-semibold text-gray-700">
            Game ID (Optional - for joining existing game):
          </label>
          <input
            id="gameId"
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Enter game ID to join"
            className="w-full max-w-md px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="submit"
            className="px-5 py-2 text-base font-semibold text-white bg-green-500 rounded-lg cursor-pointer hover:bg-green-600 transition-colors"
          >
            Create Game
          </button>
          
          <button
            type="button"
            onClick={handleJoinGame}
            disabled={!username.trim() || !gameId.trim()}
            className={`px-5 py-2 text-base font-semibold text-white rounded-lg transition-colors ${
              gameId.trim() 
                ? 'bg-blue-500 hover:bg-blue-600 cursor-pointer' 
                : 'bg-gray-400 cursor-not-allowed opacity-60'
            }`}
          >
            Join Game
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlayerInput;
