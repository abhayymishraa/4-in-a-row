import { GameEngine, GameStatus } from './GameEngine';
import { Player } from './Player';

export class Game {
  public readonly id: string;
  public readonly player1: Player;
  public readonly player2: Player;
  private engine: GameEngine;
  public readonly createdAt: Date;
  public lastMoveAt: Date;
  private winnerId: string | null = null;

  constructor(id: string, player1: Player, player2: Player, engine?: GameEngine) {
    this.id = id;
    this.player1 = player1;
    this.player2 = player2;
    this.engine = engine || new GameEngine();
    this.createdAt = new Date();
    this.lastMoveAt = new Date();
  }

  getCurrentPlayer(): Player {
    const currentPlayerNumber = this.engine.getCurrentPlayer();
    return currentPlayerNumber === 1 ? this.player1 : this.player2;
  }

  getStatus(): GameStatus {
    if (this.winnerId) {
      return 'won';
    }
    const engineStatus = this.engine.getGameStatus();
    return engineStatus;
  }

  isPlayerTurn(playerId: string): boolean {
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer.id === playerId;
  }

  makeMove(column: number, playerId: string): void {
    if (!this.isPlayerTurn(playerId)) {
      throw new Error(`Not player's turn. Current player: ${this.getCurrentPlayer().id}`);
    }

    const moveResult = this.engine.makeMove(column);
    this.lastMoveAt = new Date();

    if (moveResult.status === 'won' && moveResult.winner) {
      const winner = moveResult.winner === 1 ? this.player1 : this.player2;
      this.winnerId = winner.id;
      
      const engineWinner = this.engine.getWinner();
      if (engineWinner !== moveResult.winner) {
        throw new Error(`Win detection mismatch: moveResult.winner=${moveResult.winner}, engine.getWinner()=${engineWinner}`);
      }
    } else if (moveResult.status === 'draw') {
      this.winnerId = null;
      if (this.engine.getGameStatus() !== 'draw') {
        throw new Error(`Draw detection mismatch: moveResult.status=draw but engine.getGameStatus()=${this.engine.getGameStatus()}`);
      }
    }
  }

  getWinner(): Player | null {
    if (!this.winnerId) {
      return null;
    }
    return this.winnerId === this.player1.id ? this.player1 : this.player2;
  }

  getEngine(): GameEngine {
    return this.engine;
  }

  toJSON() {
    return {
      id: this.id,
      player1: this.player1.toJSON(),
      player2: this.player2.toJSON(),
      currentPlayer: this.getCurrentPlayer().toJSON(),
      status: this.getStatus(),
      board: this.engine.getBoard().getBoard(),
      winner: this.getWinner()?.toJSON() || null,
      createdAt: this.createdAt.toISOString(),
      lastMoveAt: this.lastMoveAt.toISOString()
    };
  }
}

