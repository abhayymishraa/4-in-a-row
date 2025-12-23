import { Board } from './Board';

export class GameEngine {
  private board: Board;

  constructor(board?: Board) {
    this.board = board || new Board();
  }

  getBoard(): Board {
    return this.board;
  }

  validateMove(column: number): boolean {
    return this.board.isValidMove(column);
  }
}

