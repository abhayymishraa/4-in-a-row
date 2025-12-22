import React from 'react';
import { useGameEngine } from '../hooks/useGameEngine';

interface GameBoardProps {
  game: any;
  onMakeMove: (column: number) => void;
  currentUsername: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ game, onMakeMove, currentUsername }) => {
  const { validateMove } = useGameEngine(game);

  if (!game || !game.board) return null;

  const board = game.board;
  const isCurrentPlayerTurn = game.currentPlayer.username === currentUsername;
  const isGameOver = game.status === 'won' || game.status === 'draw';

  const handleColumnClick = (column: number) => {
    if (isGameOver) {
      return;
    }

    if (!isCurrentPlayerTurn) {
      return;
    }

    if (!validateMove(column)) {
      return;
    }

    onMakeMove(column);
  };

  const getCellColor = (cell: number): string => {
    if (cell === 0) return '#e0e0e0';
    if (cell === 1) return '#f44336';
    return '#2196f3';
  };

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${board[0].length}, 50px)`,
          gap: '5px',
          marginBottom: '5px',
          padding: '0 10px'
        }}
      >
        {board[0].map((_cell: number, col: number) => (
          <button
            key={col}
            onClick={() => handleColumnClick(col)}
            disabled={isGameOver || !isCurrentPlayerTurn}
            style={{
              width: '50px',
              height: '40px',
              padding: '0',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: isGameOver || !isCurrentPlayerTurn ? '#ccc' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isGameOver || !isCurrentPlayerTurn ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isGameOver && isCurrentPlayerTurn) {
                e.currentTarget.style.backgroundColor = '#45a049';
              }
            }}
            onMouseLeave={(e) => {
              if (!isGameOver && isCurrentPlayerTurn) {
                e.currentTarget.style.backgroundColor = '#4caf50';
              }
            }}
          >
            {col + 1}
          </button>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${board[0].length}, 50px)`,
          gap: '5px',
          padding: '10px',
          background: '#fff',
          borderRadius: '8px',
          border: '2px solid #333'
        }}
      >
        {board.map((row: number[], rowIndex: number) =>
          row.map((cell: number, colIndex: number) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: getCellColor(cell),
                border: '2px solid #333',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default GameBoard;

