import { GameEngine } from "../core/GameEngine";
import { Board } from "../core/Board";
import { logger } from "../config/logger";

interface MoveScore {
  column: number;
  score: number;
}

export class BotService {
  private botPlayerNumber: number;
  private opponentNumber: number;
  private readonly MAX_DEPTH = 6;
  private readonly WIN_SCORE = 100000;
  private readonly LOSE_SCORE = -100000;

  constructor(botPlayerNumber: number) {
    this.botPlayerNumber = botPlayerNumber;
    this.opponentNumber = botPlayerNumber === 1 ? 2 : 1;
  }

  calculateMove(engine: GameEngine): number {
    const board = engine.getBoard();
    const availableColumns = board.getAvailableColumns();

    if (availableColumns.length === 0) {
      throw new Error("No available moves");
    }

    const winningMove = this.findWinningMove(engine, this.botPlayerNumber);
    if (winningMove !== -1) {
      logger.debug("Bot found winning move", { column: winningMove });
      return winningMove;
    }

    const blockingMove = this.findWinningMove(engine, this.opponentNumber);
    if (blockingMove !== -1) {
      logger.debug("Bot blocking opponent win", { column: blockingMove });
      return blockingMove;
    }

    const trapMove = this.findTrapMove(engine);
    if (trapMove !== -1) {
      logger.debug("Bot creating trap", { column: trapMove });
      return trapMove;
    }

    const blockTrapMove = this.findOpponentTrap(engine);
    if (blockTrapMove !== -1) {
      logger.debug("Bot blocking opponent trap", { column: blockTrapMove });
      return blockTrapMove;
    }

    const bestMove = this.minimax(
      engine,
      this.MAX_DEPTH,
      true,
      -Infinity,
      Infinity,
    );
    logger.debug("Bot using minimax result", {
      column: bestMove.column,
      score: bestMove.score,
    });

    return bestMove.column;
  }

  private findWinningMove(engine: GameEngine, player: number): number {
    const board = engine.getBoard();
    const availableColumns = board.getAvailableColumns();

    for (const col of this.getColumnOrder(availableColumns)) {
      const testEngine = engine.clone();
      try {
        const currentPlayer = testEngine.getCurrentPlayer();
        if (currentPlayer !== player) continue;

        const result = testEngine.makeMove(col);
        if (result.status === "won" && result.winner === player) {
          return col;
        }
      } catch {
        continue;
      }
    }
    return -1;
  }

  private findTrapMove(engine: GameEngine): number {
    const board = engine.getBoard();
    const availableColumns = board.getAvailableColumns();

    for (const col of this.getColumnOrder(availableColumns)) {
      const testEngine = engine.clone();
      try {
        testEngine.makeMove(col);

        let winningThreats = 0;
        const testBoard = testEngine.getBoard();
        const nextAvailable = testBoard.getAvailableColumns();

        for (const nextCol of nextAvailable) {
          const nextEngine = new GameEngine(testBoard, this.botPlayerNumber);
          try {
            const result = nextEngine.makeMove(nextCol);
            if (
              result.status === "won" &&
              result.winner === this.botPlayerNumber
            ) {
              winningThreats++;
            }
          } catch {
            continue;
          }
        }

        if (winningThreats >= 2) {
          return col;
        }
      } catch {
        continue;
      }
    }
    return -1;
  }

  private findOpponentTrap(engine: GameEngine): number {
    const board = engine.getBoard();
    const availableColumns = board.getAvailableColumns();

    for (const col of this.getColumnOrder(availableColumns)) {
      const opponentEngine = new GameEngine(board, this.opponentNumber);
      try {
        opponentEngine.makeMove(col);

        let opponentThreats = 0;
        const testBoard = opponentEngine.getBoard();
        const nextAvailable = testBoard.getAvailableColumns();

        for (const nextCol of nextAvailable) {
          const nextEngine = new GameEngine(testBoard, this.opponentNumber);
          try {
            const result = nextEngine.makeMove(nextCol);
            if (
              result.status === "won" &&
              result.winner === this.opponentNumber
            ) {
              opponentThreats++;
            }
          } catch {
            continue;
          }
        }

        if (opponentThreats >= 2) {
          if (board.isValidMove(col)) {
            return col;
          }
        }
      } catch {
        continue;
      }
    }
    return -1;
  }

  private minimax(
    engine: GameEngine,
    depth: number,
    isMaximizing: boolean,
    alpha: number,
    beta: number,
  ): MoveScore {
    const board = engine.getBoard();
    const availableColumns = board.getAvailableColumns();

    if (depth === 0 || availableColumns.length === 0) {
      return { column: -1, score: this.evaluateBoard(board) };
    }

    const status = engine.getGameStatus();
    if (status === "won") {
      const winner = engine.getWinner();
      if (winner === this.botPlayerNumber) {
        return { column: -1, score: this.WIN_SCORE + depth };
      } else {
        return { column: -1, score: this.LOSE_SCORE - depth };
      }
    }
    if (status === "draw") {
      return { column: -1, score: 0 };
    }

    const orderedColumns = this.getColumnOrder(availableColumns);

    if (isMaximizing) {
      let bestScore = -Infinity;
      let bestColumn = orderedColumns[0];

      for (const col of orderedColumns) {
        const testEngine = engine.clone();
        try {
          testEngine.makeMove(col);
          const result = this.minimax(
            testEngine,
            depth - 1,
            false,
            alpha,
            beta,
          );

          if (result.score > bestScore) {
            bestScore = result.score;
            bestColumn = col;
          }

          alpha = Math.max(alpha, bestScore);
          if (beta <= alpha) {
            break;
          }
        } catch {
          continue;
        }
      }

      return { column: bestColumn, score: bestScore };
    } else {
      let bestScore = Infinity;
      let bestColumn = orderedColumns[0];

      for (const col of orderedColumns) {
        const testEngine = engine.clone();
        try {
          testEngine.makeMove(col);
          const result = this.minimax(testEngine, depth - 1, true, alpha, beta);

          if (result.score < bestScore) {
            bestScore = result.score;
            bestColumn = col;
          }

          beta = Math.min(beta, bestScore);
          if (beta <= alpha) {
            break;
          }
        } catch {
          continue;
        }
      }

      return { column: bestColumn, score: bestScore };
    }
  }

  private evaluateBoard(board: Board): number {
    let score = 0;

    const rows = Board.getRows();
    const cols = Board.getCols();
    const grid = board.getBoard();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col <= cols - 4; col++) {
        const window = [
          grid[row][col],
          grid[row][col + 1],
          grid[row][col + 2],
          grid[row][col + 3],
        ];
        score += this.evaluateWindow(window);
      }
    }

    for (let row = 0; row <= rows - 4; row++) {
      for (let col = 0; col < cols; col++) {
        const window = [
          grid[row][col],
          grid[row + 1][col],
          grid[row + 2][col],
          grid[row + 3][col],
        ];
        score += this.evaluateWindow(window);
      }
    }

    for (let row = 3; row < rows; row++) {
      for (let col = 0; col <= cols - 4; col++) {
        const window = [
          grid[row][col],
          grid[row - 1][col + 1],
          grid[row - 2][col + 2],
          grid[row - 3][col + 3],
        ];
        score += this.evaluateWindow(window);
      }
    }

    for (let row = 0; row <= rows - 4; row++) {
      for (let col = 0; col <= cols - 4; col++) {
        const window = [
          grid[row][col],
          grid[row + 1][col + 1],
          grid[row + 2][col + 2],
          grid[row + 3][col + 3],
        ];
        score += this.evaluateWindow(window);
      }
    }

    const centerCol = Math.floor(cols / 2);
    let centerCount = 0;
    for (let row = 0; row < rows; row++) {
      if (grid[row][centerCol] === this.botPlayerNumber) {
        centerCount++;
      }
    }
    score += centerCount * 6;

    return score;
  }

  private evaluateWindow(window: number[]): number {
    const botCount = window.filter(
      (cell) => cell === this.botPlayerNumber,
    ).length;
    const opponentCount = window.filter(
      (cell) => cell === this.opponentNumber,
    ).length;
    const emptyCount = window.filter((cell) => cell === 0).length;

    if (botCount > 0 && opponentCount > 0) {
      return 0;
    }

    if (botCount === 4) {
      return 1000;
    } else if (botCount === 3 && emptyCount === 1) {
      return 50;
    } else if (botCount === 2 && emptyCount === 2) {
      return 10;
    } else if (botCount === 1 && emptyCount === 3) {
      return 1;
    }

    if (opponentCount === 4) {
      return -1000;
    } else if (opponentCount === 3 && emptyCount === 1) {
      return -80;
    } else if (opponentCount === 2 && emptyCount === 2) {
      return -15;
    } else if (opponentCount === 1 && emptyCount === 3) {
      return -1;
    }

    return 0;
  }

  private getColumnOrder(availableColumns: number[]): number[] {
    const centerCol = Math.floor(Board.getCols() / 2);

    return [...availableColumns].sort((a, b) => {
      const distA = Math.abs(a - centerCol);
      const distB = Math.abs(b - centerCol);
      return distA - distB;
    });
  }
}
