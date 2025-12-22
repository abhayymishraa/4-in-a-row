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
    <div style={{ marginBottom: '20px', padding: '10px', background: '#fff', borderRadius: '4px' }}>
      <div style={{ marginBottom: '5px' }}>
        <strong>Player 1:</strong> {game.player1.username} {game.player1.type === 'bot' && '(Bot)'}
      </div>
      <div style={{ marginBottom: '5px' }}>
        <strong>Player 2:</strong> {game.player2.username} {game.player2.type === 'bot' && '(Bot)'}
      </div>
      <div style={{ marginTop: '10px', fontSize: '18px', fontWeight: 'bold', color: isGameOver ? '#4caf50' : '#2196f3' }}>
        {statusMessage}
      </div>
    </div>
  );
};

export default GameStatus;

