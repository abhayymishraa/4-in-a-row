import { Board } from "./Board";

export class WinChecker {
  private static readonly WIN_LENGTH = 4;
  private static readonly DIRECTIONS = [
    { deltaRow: 0, deltaCol: 1 },
    { deltaRow: 1, deltaCol: 0 },
    { deltaRow: 1, deltaCol: 1 },
    { deltaRow: 1, deltaCol: -1 },
  ];

  static checkWin(
    row: number,
    col: number,
    player: number,
    board: Board,
  ): boolean {
    if (
      row < 0 ||
      row >= Board.getRows() ||
      col < 0 ||
      col >= Board.getCols()
    ) {
      return false;
    }

    const cellValue = board.getCell(row, col);
    if (cellValue !== player) {
      return false;
    }

    for (const direction of WinChecker.DIRECTIONS) {
      const count = WinChecker.countInDirection(
        row,
        col,
        player,
        direction.deltaRow,
        direction.deltaCol,
        board,
      );
      if (count >= WinChecker.WIN_LENGTH) {
        return true;
      }
    }

    return false;
  }

  static countInDirection(
    startRow: number,
    startCol: number,
    player: number,
    deltaRow: number,
    deltaCol: number,
    board: Board,
  ): number {
    let count = 1;

    for (let i = 1; i < WinChecker.WIN_LENGTH; i++) {
      const newRow = startRow + deltaRow * i;
      const newCol = startCol + deltaCol * i;

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

    for (let i = 1; i < WinChecker.WIN_LENGTH; i++) {
      const newRow = startRow - deltaRow * i;
      const newCol = startCol - deltaCol * i;

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

    return count;
  }

  static findWinner(board: Board): number | null {
    for (let row = 0; row < Board.getRows(); row++) {
      for (let col = 0; col < Board.getCols(); col++) {
        const cell = board.getCell(row, col);
        if (cell !== 0) {
          if (WinChecker.checkWin(row, col, cell, board)) {
            return cell;
          }
        }
      }
    }
    return null;
  }
}
