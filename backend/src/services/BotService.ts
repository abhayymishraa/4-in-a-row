import { GameEngine } from '../core/GameEngine';
import { Board } from '../core/Board';
import { logger } from '../config/logger';

export class BotService {
  private botPlayerNumber: number;

  constructor(botPlayerNumber: number) {
    this.botPlayerNumber = botPlayerNumber;
  }

  calculateMove(engine: GameEngine): number {
    const board = engine.getBoard();
    const opponentNumber = this.botPlayerNumber === 1 ? 2 : 1;
    const availableColumns = board.getAvailableColumns();

    if (availableColumns.length === 0) {
      throw new Error('No available moves');
    }

    const clonedEngine = engine.clone();

    for (const col of availableColumns) {
      const testEngine = clonedEngine.clone();
      try {
        const result = testEngine.makeMove(col);
        if (result.status === 'won' && result.winner === this.botPlayerNumber) {
          logger.debug('Bot found winning move', { column: col });
          return col;
        }
      } catch (error) {
        continue;
      }
    }

    for (const col of availableColumns) {
      const testEngine = clonedEngine.clone();
      try {
        testEngine.makeMove(col);
        const opponentEngine = new GameEngine(
          testEngine.getBoard(),
          opponentNumber
        );
        
        for (const oppCol of board.getAvailableColumns()) {
          if (oppCol === col) continue;
          try {
            const oppResult = opponentEngine.makeMove(oppCol);
            if (oppResult.status === 'won' && oppResult.winner === opponentNumber) {
              logger.debug('Bot blocking opponent win', { column: col });
              return col;
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }

    for (const col of availableColumns) {
      const testEngine = clonedEngine.clone();
      try {
        testEngine.makeMove(col);
        const nextEngine = new GameEngine(
          testEngine.getBoard(),
          this.botPlayerNumber
        );
        
        for (const nextCol of testEngine.getBoard().getAvailableColumns()) {
          try {
            const nextResult = nextEngine.makeMove(nextCol);
            if (nextResult.status === 'won' && nextResult.winner === this.botPlayerNumber) {
              logger.debug('Bot creating winning opportunity', { column: col });
              return col;
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }

    for (const col of availableColumns) {
      const testEngine = clonedEngine.clone();
      try {
        testEngine.makeMove(col);
        const opponentEngine = new GameEngine(
          testEngine.getBoard(),
          opponentNumber
        );
        
        for (const oppCol of testEngine.getBoard().getAvailableColumns()) {
          if (oppCol === col) continue;
          try {
            const oppTestEngine = opponentEngine.clone();
            oppTestEngine.makeMove(oppCol);
            const nextOppEngine = new GameEngine(
              oppTestEngine.getBoard(),
              opponentNumber
            );
            
            for (const nextOppCol of oppTestEngine.getBoard().getAvailableColumns()) {
              try {
                const nextOppResult = nextOppEngine.makeMove(nextOppCol);
                if (nextOppResult.status === 'won' && nextOppResult.winner === opponentNumber) {
                  logger.debug('Bot blocking opponent opportunity', { column: col });
                  return col;
                }
              } catch (error) {
                continue;
              }
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        continue;
      }
    }

    const centerColumn = Math.floor(Board.getCols() / 2);
    if (availableColumns.includes(centerColumn)) {
      logger.debug('Bot using center column preference', { column: centerColumn });
      return centerColumn;
    }

    const randomColumn = availableColumns[Math.floor(Math.random() * availableColumns.length)];
    logger.debug('Bot using random move', { column: randomColumn });
    return randomColumn;
  }
}

