export type CellValue = 0 | 1 | 2;

export class Board {
  private static readonly ROWS = 6;
  private static readonly COLS = 7;
  private grid: CellValue[][];

  constructor(grid?: CellValue[][]) {
    if (grid) {
      this.grid = grid.map(row => [...row]);
    } else {
      this.grid = Array(Board.ROWS)
        .fill(null)
        .map(() => Array(Board.COLS).fill(0) as CellValue[]);
    }
  }

  static getRows(): number {
    return Board.ROWS;
  }

  static getCols(): number {
    return Board.COLS;
  }

  getBoard(): CellValue[][] {
    return this.grid.map(row => [...row]);
  }

  isValidMove(column: number): boolean {
    if (column < 0 || column >= Board.COLS) {
      return false;
    }
    return this.grid[0][column] === 0;
  }

  getAvailableColumns(): number[] {
    const available: number[] = [];
    for (let col = 0; col < Board.COLS; col++) {
      if (this.isValidMove(col)) {
        available.push(col);
      }
    }
    return available;
  }

  isFull(): boolean {
    for (let col = 0; col < Board.COLS; col++) {
      if (this.grid[0][col] === 0) {
        return false;
      }
    }
    return true;
  }

  getCell(row: number, col: number): CellValue {
    if (row < 0 || row >= Board.ROWS || col < 0 || col >= Board.COLS) {
      return 0;
    }
    return this.grid[row][col];
  }
}

