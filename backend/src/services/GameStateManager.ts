import { Game } from '../core/Game';
import { Player } from '../core/Player';
import { logger } from '../config/logger';

export class GameStateManager {
  private games: Map<string, Game>;
  private playerGameMap: Map<string, string>;

  constructor() {
    this.games = new Map();
    this.playerGameMap = new Map();
  }

  createGame(player1: Player, player2: Player, gameId: string): Game {
    const game = new Game(gameId, player1, player2);
    this.games.set(gameId, game);
    this.playerGameMap.set(player1.id, gameId);
    this.playerGameMap.set(player2.id, gameId);
    
    logger.info('Game created', { gameId, player1Id: player1.id, player2Id: player2.id });
    return game;
  }

  getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  updateGame(gameId: string, game: Game): void {
    this.games.set(gameId, game);
    logger.debug('Game updated', { gameId });
  }

  removeGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      this.playerGameMap.delete(game.player1.id);
      this.playerGameMap.delete(game.player2.id);
      this.games.delete(gameId);
      logger.info('Game removed', { gameId });
    }
  }

  findGameByPlayer(playerId: string): Game | undefined {
    const gameId = this.playerGameMap.get(playerId);
    if (!gameId) {
      return undefined;
    }
    return this.games.get(gameId);
  }

  getAllActiveGames(): Game[] {
    return Array.from(this.games.values());
  }

  cleanupStaleGames(maxAgeMinutes: number = 60): void {
    const now = new Date();
    const staleGames: string[] = [];

    for (const [gameId, game] of this.games.entries()) {
      const ageMinutes = (now.getTime() - game.lastMoveAt.getTime()) / (1000 * 60);
      if (ageMinutes > maxAgeMinutes && game.getStatus() === 'playing') {
        staleGames.push(gameId);
      }
    }

    for (const gameId of staleGames) {
      this.removeGame(gameId);
      logger.info('Stale game cleaned up', { gameId });
    }
  }
}

