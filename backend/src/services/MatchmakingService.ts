import { Player } from '../core/Player';
import { GameStateManager } from './GameStateManager';
import { BotService } from './BotService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

interface QueuedPlayer {
  player: Player;
  queuedAt: Date;
  botTimer?: NodeJS.Timeout;
}

export class MatchmakingService {
  private queue: QueuedPlayer[];
  private gameStateManager: GameStateManager;
  private onGameCreated?: (gameId: string, player1: Player, player2: Player) => void;
  private readonly BOT_TIMEOUT_MS = 10000;

  constructor(gameStateManager: GameStateManager) {
    this.queue = [];
    this.gameStateManager = gameStateManager;
  }

  setOnGameCreated(callback: (gameId: string, player1: Player, player2: Player) => void): void {
    this.onGameCreated = callback;
  }

  addPlayer(player: Player): void {
    const existing = this.queue.find(q => q.player.id === player.id);
    if (existing) {
      logger.debug('Player already in queue', { playerId: player.id });
      return;
    }

    const queuedPlayer: QueuedPlayer = {
      player,
      queuedAt: new Date()
    };

    this.queue.push(queuedPlayer);
    logger.info('Player added to matchmaking queue', { playerId: player.id, queueSize: this.queue.length });

    const match = this.findMatch();
    if (match) {
      this.createGame(match.player1, match.player2);
      return;
    }

    queuedPlayer.botTimer = setTimeout(() => {
      this.startBotGame(player);
    }, this.BOT_TIMEOUT_MS);
  }

  removePlayer(playerId: string): void {
    const index = this.queue.findIndex(q => q.player.id === playerId);
    if (index !== -1) {
      const queuedPlayer = this.queue[index];
      if (queuedPlayer.botTimer) {
        clearTimeout(queuedPlayer.botTimer);
      }
      this.queue.splice(index, 1);
      logger.info('Player removed from matchmaking queue', { playerId });
    }
  }

  private findMatch(): { player1: Player; player2: Player } | null {
    if (this.queue.length < 2) {
      return null;
    }

    const player1 = this.queue.shift();
    const player2 = this.queue.shift();

    if (!player1 || !player2) {
      if (player1) this.queue.unshift(player1);
      if (player2) this.queue.unshift(player2);
      return null;
    }

    if (player1.botTimer) {
      clearTimeout(player1.botTimer);
    }
    if (player2.botTimer) {
      clearTimeout(player2.botTimer);
    }

    logger.info('Match found', { player1Id: player1.player.id, player2Id: player2.player.id });
    return { player1: player1.player, player2: player2.player };
  }

  private startBotGame(player: Player): void {
    const index = this.queue.findIndex(q => q.player.id === player.id);
    if (index === -1) {
      logger.debug('Player no longer in queue for bot game', { playerId: player.id });
      return;
    }

    this.queue.splice(index, 1);
    
    const botPlayer = new Player(uuidv4(), 'Bot', 'bot');
    logger.info('Starting bot game', { playerId: player.id, botId: botPlayer.id });
    this.createGame(player, botPlayer);
  }

  private createGame(player1: Player, player2: Player): void {
    const gameId = uuidv4();
    this.gameStateManager.createGame(player1, player2, gameId);
    if (this.onGameCreated) {
      this.onGameCreated(gameId, player1, player2);
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

