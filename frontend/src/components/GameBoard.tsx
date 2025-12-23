import { useGameEngine } from '../hooks/useGameEngine';

interface GameBoardProps {
  game: any;
  onMakeMove: (column: number) => void;
  currentUsername: string;
}

const GameBoard = ({ game, onMakeMove, currentUsername }: GameBoardProps) => {
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
    if (cell === 0) return 'bg-gray-300';
    if (cell === 1) return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <div className="mt-5 flex flex-col items-center">
      <div
        className="grid gap-1.5 mb-1.5 px-2.5"
        style={{ gridTemplateColumns: `repeat(${board[0].length}, 50px)` }}
      >
        {board[0].map((_cell: number, col: number) => (
          <button
            key={col}
            onClick={() => handleColumnClick(col)}
            disabled={isGameOver || !isCurrentPlayerTurn}
            className={`w-[50px] h-10 p-0 text-base font-bold text-white rounded border-none transition-colors ${
              isGameOver || !isCurrentPlayerTurn
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 cursor-pointer'
            }`}
          >
            {col + 1}
          </button>
        ))}
      </div>
      <div
        className="grid gap-1.5 p-2.5 bg-white rounded-lg border-2 border-gray-800"
        style={{ gridTemplateColumns: `repeat(${board[0].length}, 50px)` }}
      >
        {board.map((row: number[], rowIndex: number) =>
          row.map((cell: number, colIndex: number) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`w-[50px] h-[50px] rounded-full border-2 border-gray-800 flex items-center justify-center ${getCellColor(cell)}`}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default GameBoard;
