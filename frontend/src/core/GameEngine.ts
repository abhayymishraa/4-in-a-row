import { Board, CellValue } from './Board';

export type GameStatus = 'playing' | 'won' | 'draw';

export interface MoveResult {
  row: number;
  col: number;
  status: GameStatus;
  winner?: number;
}

export class GameEngine {
  private board: Board;
  private currentPlayer: number;

  constructor(board?: Board, currentPlayer: number = 1) {
    this.board = board || new Board();
    this.currentPlayer = currentPlayer;
  }

  getBoard(): Board {
    return this.board;
  }

  getCurrentPlayer(): number {
    return this.currentPlayer;
  }

  validateMove(column: number): boolean {
    return this.board.isValidMove(column);
  }

  checkWin(row: number, col: number, player: number, board?: Board): boolean {
    const boardToCheck = board || this.board;
    return (
      this.checkDirection(row, col, player, 0, 1, boardToCheck) ||
      this.checkDirection(row, col, player, 1, 0, boardToCheck) ||
      this.checkDirection(row, col, player, 1, 1, boardToCheck) ||
      this.checkDirection(row, col, player, 1, -1, boardToCheck)
    );
  }

  private checkDirection(
    row: number,
    col: number,
    player: number,
    deltaRow: number,
    deltaCol: number,
    board: Board
  ): boolean {
    let count = 1;

    for (let i = 1; i < 4; i++) {
      const newRow = row + deltaRow * i;
      const newCol = col + deltaCol * i;
      if (
        newRow >= 0 &&
        newRow < Board.getRows() &&
        newCol >= 0 &&
        newCol < Board.getCols() &&
        board.getCell(newRow, newCol) === player
      ) {
        count++;
      } else {
        break;
      }
    }

    for (let i = 1; i < 4; i++) {
      const newRow = row - deltaRow * i;
      const newCol = col - deltaCol * i;
      if (
        newRow >= 0 &&
        newRow < Board.getRows() &&
        newCol >= 0 &&
        newCol < Board.getCols() &&
        board.getCell(newRow, newCol) === player
      ) {
        count++;
      } else {
        break;
      }
    }

    return count >= 4;
  }

  checkDraw(): boolean {
    return this.board.isFull();
  }

  getGameStatus(): GameStatus {
    if (this.board.isFull()) {
      return 'draw';
    }
    return 'playing';
  }

  updateFromServer(boardState: CellValue[][], currentPlayer: number): void {
    this.board = new Board(boardState);
    this.currentPlayer = currentPlayer;
  }
}

