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

  makeMove(column: number): MoveResult {
    if (!this.board.isValidMove(column)) {
      throw new Error(`Invalid move: column ${column}`);
    }

    const newBoard = this.board.placeDisc(column, this.currentPlayer);
    const row = this.findRowForColumn(column, newBoard);

    const winResult = this.checkWin(row, column, this.currentPlayer, newBoard);
    if (winResult) {
      return {
        row,
        col: column,
        status: 'won',
        winner: this.currentPlayer
      };
    }

    if (newBoard.isFull()) {
      return {
        row,
        col: column,
        status: 'draw'
      };
    }

    this.board = newBoard;
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;

    return {
      row,
      col: column,
      status: 'playing'
    };
  }

  getGameStatus(): GameStatus {
    if (this.board.isFull()) {
      return 'draw';
    }
    return 'playing';
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

  private findRowForColumn(column: number, board: Board): number {
    for (let row = Board.getRows() - 1; row >= 0; row--) {
      if (board.getCell(row, column) !== 0) {
        return row;
      }
    }
    return -1;
  }

  checkDraw(): boolean {
    return this.board.isFull();
  }

  clone(): GameEngine {
    return new GameEngine(this.board, this.currentPlayer);
  }
}

