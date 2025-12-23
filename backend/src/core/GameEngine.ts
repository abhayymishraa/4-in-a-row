import { Board } from "./Board";
import { WinChecker } from "./WinChecker";

export type GameStatus = "playing" | "won" | "draw";

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

    if (row < 0) {
      throw new Error(`Failed to find row for column ${column}`);
    }

    const placedPlayer = newBoard.getCell(row, column);
    if (placedPlayer !== this.currentPlayer) {
      throw new Error(
        `Disc placement mismatch: expected ${this.currentPlayer}, got ${placedPlayer}`,
      );
    }

    const winResult = WinChecker.checkWin(
      row,
      column,
      this.currentPlayer,
      newBoard,
    );
    if (winResult) {
      this.board = newBoard;
      return {
        row,
        col: column,
        status: "won",
        winner: this.currentPlayer,
      };
    }

    if (newBoard.isFull()) {
      this.board = newBoard;
      return {
        row,
        col: column,
        status: "draw",
      };
    }

    this.board = newBoard;
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;

    return {
      row,
      col: column,
      status: "playing",
    };
  }

  getGameStatus(): GameStatus {
    const winner = WinChecker.findWinner(this.board);
    if (winner) {
      return "won";
    }
    if (this.board.isFull()) {
      return "draw";
    }
    return "playing";
  }

  getWinner(): number | null {
    return WinChecker.findWinner(this.board);
  }

  private findRowForColumn(column: number, board: Board): number {
    // Find the topmost non-empty cell (the disc that was just placed)
    // Discs stack from bottom to top visually, but in the array:
    // - Row 0 is top (visually highest)
    // - Row 5 is bottom (visually lowest)
    // - New discs are placed at the lowest available row number (highest position)
    // - So searching from top (row 0) finds the newest disc first
    for (let row = 0; row < Board.getRows(); row++) {
      if (board.getCell(row, column) !== 0) {
        return row;
      }
    }
    return -1;
  }

  clone(): GameEngine {
    return new GameEngine(this.board, this.currentPlayer);
  }
}
