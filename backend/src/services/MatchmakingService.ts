import { Player } from '../core/Player';
import { GameStateManager } from './GameStateManager';
import { BotService } from './BotService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';


interface QueuedPlayerWithGame {
  player: Player;
  queuedAt: Date;
  gameId?: string;
  onMatch?: (matchedPlayer: Player) => void;
  botTimer?: NodeJS.Timeout;
}

export class MatchmakingService {
  private queue: QueuedPlayerWithGame[];
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

  addPlayer(player: Player, gameId?: string, onMatch?: (matchedPlayer: Player) => void): void {
    const existing = this.queue.find(q => q.player.id === player.id);
    if (existing) {
      logger.debug('Player already in queue', { playerId: player.id });
      return;
    }

    const queuedPlayer: QueuedPlayerWithGame = {
      player,
      queuedAt: new Date(),
      gameId,
      onMatch
    };

    this.queue.push(queuedPlayer);
    logger.info('Player added to matchmaking queue', { playerId: player.id, queueSize: this.queue.length, gameId });

    const match = this.findMatch();
    if (match) {
      if (match.player1Queued.gameId && match.player1Queued.onMatch) {
        match.player1Queued.onMatch(match.player2);
      } else if (match.player2Queued.gameId && match.player2Queued.onMatch) {
        match.player2Queued.onMatch(match.player1);
      } else {
        this.createGame(match.player1, match.player2);
      }
      return;
    }

    if (!gameId) {
      queuedPlayer.botTimer = setTimeout(() => {
        this.startBotGame(player);
      }, this.BOT_TIMEOUT_MS);
    }
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

  private findMatch(): { player1: Player; player2: Player; player1Queued: QueuedPlayerWithGame; player2Queued: QueuedPlayerWithGame } | null {
    if (this.queue.length < 2) {
      return null;
    }

    const player1Queued = this.queue.shift();
    const player2Queued = this.queue.shift();

    if (!player1Queued || !player2Queued) {
      if (player1Queued) this.queue.unshift(player1Queued);
      if (player2Queued) this.queue.unshift(player2Queued);
      return null;
    }

    if (player1Queued.botTimer) {
      clearTimeout(player1Queued.botTimer);
    }
    if (player2Queued.botTimer) {
      clearTimeout(player2Queued.botTimer);
    }

    logger.info('Match found', { player1Id: player1Queued.player.id, player2Id: player2Queued.player.id });
    return { 
      player1: player1Queued.player, 
      player2: player2Queued.player,
      player1Queued,
      player2Queued
    };
  }

  private startBotGame(player: Player): void {
    const index = this.queue.findIndex(q => q.player.id === player.id);
    if (index === -1) {
      logger.debug('Player no longer in queue for bot game', { playerId: player.id });
      return;
    }

    const queuedPlayer = this.queue[index];
    this.queue.splice(index, 1);
    
    const botPlayer = new Player(uuidv4(), 'Bot', 'bot');
    const gameId = queuedPlayer.gameId || uuidv4();
    
    logger.info('Starting bot game', { playerId: player.id, botId: botPlayer.id, gameId });
    this.createGame(player, botPlayer, gameId);
  }

  private createGame(player1: Player, player2: Player, gameId?: string): void {
    const finalGameId = gameId || uuidv4();
    this.gameStateManager.createGame(player1, player2, finalGameId);
    if (this.onGameCreated) {
      this.onGameCreated(finalGameId, player1, player2);
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  findWaitingGameByGameId(gameId: string): QueuedPlayerWithGame | undefined {
    return this.queue.find(q => q.gameId === gameId);
  }

  joinWaitingGame(gameId: string, joiningPlayer: Player): { success: boolean; hostPlayer?: Player } {
    const waitingPlayerIndex = this.queue.findIndex(q => q.gameId === gameId);
    
    if (waitingPlayerIndex === -1) {
      return { success: false };
    }

    const waitingPlayerQueued = this.queue[waitingPlayerIndex];
    this.queue.splice(waitingPlayerIndex, 1);

    if (waitingPlayerQueued.botTimer) {
      clearTimeout(waitingPlayerQueued.botTimer);
    }

    logger.info('Player joining waiting game', { 
      gameId, 
      hostPlayerId: waitingPlayerQueued.player.id,
      joiningPlayerId: joiningPlayer.id 
    });

    if (waitingPlayerQueued.onMatch) {
      waitingPlayerQueued.onMatch(joiningPlayer);
    } else {
      this.gameStateManager.createGame(waitingPlayerQueued.player, joiningPlayer, gameId);
      if (this.onGameCreated) {
        this.onGameCreated(gameId, waitingPlayerQueued.player, joiningPlayer);
      }
    }

    return { success: true, hostPlayer: waitingPlayerQueued.player };
  }
}

