export type CellValue = 0 | 1 | 2;

export class Board {
  private static readonly ROWS = 6;
  private static readonly COLS = 7;
  private grid: CellValue[][];

  constructor(grid?: CellValue[][]) {
    if (grid) {
      this.grid = grid.map((row) => [...row]);
    } else {
      this.grid = Array(Board.ROWS)
        .fill(null)
        .map(() => Array(Board.COLS).fill(0) as CellValue[]);
    }
  }

  isValidMove(column: number): boolean {
    if (column < 0 || column >= Board.COLS) {
      return false;
    }
    return this.grid[0][column] === 0;
  }
}
