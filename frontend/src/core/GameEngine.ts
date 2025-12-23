import { Board } from "./Board";

export class GameEngine {
  private board: Board;

  constructor(board?: Board) {
    this.board = board || new Board();
  }

  validateMove(column: number): boolean {
    return this.board.isValidMove(column);
  }
}
