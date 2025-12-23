import React from 'react';

interface GameStatusProps {
  game: any;
  currentUsername: string;
}

const GameStatus: React.FC<GameStatusProps> = ({ game, currentUsername }) => {
  if (!game) return null;

  const isCurrentPlayerTurn = game.currentPlayer.username === currentUsername;
  const isGameOver = game.status === 'won' || game.status === 'draw';

  let statusMessage = '';
  if (game.status === 'won') {
    if (game.winner && game.winner.username === currentUsername) {
      statusMessage = 'You won!';
    } else {
      statusMessage = `${game.winner?.username || 'Opponent'} won!`;
    }
  } else if (game.status === 'draw') {
    statusMessage = "It's a draw!";
  } else {
    statusMessage = isCurrentPlayerTurn ? 'Your turn' : "Opponent's turn";
  }

  return (
    <div className="mb-5 p-3 bg-white rounded-lg shadow-sm">
      <div className="mb-2">
        <strong>Player 1:</strong> {game.player1.username} {game.player1.type === 'bot' && '(Bot)'}
      </div>
      <div className="mb-2">
        <strong>Player 2:</strong> {game.player2.username} {game.player2.type === 'bot' && '(Bot)'}
      </div>
      <div className={`mt-3 text-lg font-bold ${isGameOver ? 'text-green-500' : 'text-blue-500'}`}>
        {statusMessage}
      </div>
    </div>
  );
};

export default GameStatus;
