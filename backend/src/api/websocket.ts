import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GameStateManager } from '../services/GameStateManager';
import { MatchmakingService } from '../services/MatchmakingService';
import { BotService } from '../services/BotService';
import { DatabaseService } from '../services/DatabaseService';
import { KafkaProducer } from '../services/KafkaProducer';
import { Player } from '../core/Player';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

interface SocketPlayer {
  socketId: string;
  player: Player;
  gameId?: string;
  disconnectedAt?: Date;
}

export class WebSocketHandler {
  private io: SocketIOServer;
  private gameStateManager: GameStateManager;
  private matchmakingService: MatchmakingService;
  private databaseService: DatabaseService;
  private kafkaProducer: KafkaProducer;
  private socketPlayers: Map<string, SocketPlayer>;
  private readonly RECONNECTION_TIMEOUT_MS = 30000;

  constructor(
    httpServer: HTTPServer,
    gameStateManager: GameStateManager,
    matchmakingService: MatchmakingService,
    databaseService: DatabaseService,
    kafkaProducer: KafkaProducer
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.gameStateManager = gameStateManager;
    this.matchmakingService = matchmakingService;
    this.databaseService = databaseService;
    this.kafkaProducer = kafkaProducer;
    this.socketPlayers = new Map();

    this.matchmakingService.setOnGameCreated((gameId, player1, player2) => {
      this.handleGameCreated(gameId, player1, player2);
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected', { socketId: socket.id });

      socket.on('join-game', async (data: { username: string; gameId?: string }) => {
        await this.handleJoinGame(socket, data);
      });

      socket.on('make-move', async (data: { gameId: string; column: number }) => {
        await this.handleMakeMove(socket, data);
      });

      socket.on('reconnect', async (data: { username: string; gameId?: string }) => {
        await this.handleReconnect(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleGameCreated(gameId: string, player1: Player, player2: Player): Promise<void> {
    const game = this.gameStateManager.getGame(gameId);
    if (!game) {
      return;
    }

    await this.kafkaProducer.emitGameStarted(gameId, player1.id, player2.id);

    for (const [socketId, socketPlayer] of this.socketPlayers.entries()) {
      if (socketPlayer.player.id === player1.id || socketPlayer.player.id === player2.id) {
        socketPlayer.gameId = gameId;
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(gameId);
          socket.emit('game-update', game.toJSON());
        }
      }
    }

    logger.info('Game created and players notified', { gameId, player1Id: player1.id, player2Id: player2.id });
  }

  private async handleJoinGame(socket: any, data: { username: string; gameId?: string }): Promise<void> {
    try {
      const { username, gameId } = data;

      if (!username || username.trim().length === 0) {
        socket.emit('error', { message: 'Username is required' });
        return;
      }

      if (gameId) {
        const game = this.gameStateManager.getGame(gameId);
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        const player = game.player1.username === username
          ? game.player1
          : game.player2.username === username
          ? game.player2
          : null;

        if (!player) {
          socket.emit('error', { message: 'You are not a player in this game' });
          return;
        }

        this.socketPlayers.set(socket.id, {
          socketId: socket.id,
          player,
          gameId
        });

        socket.join(gameId);
        socket.emit('game-update', game.toJSON());
        logger.info('Player rejoined existing game', { socketId: socket.id, gameId, playerId: player.id });
        return;
      }

      const playerId = uuidv4();
      const player = new Player(playerId, username.trim(), 'human');

      await this.databaseService.savePlayer(playerId, username);

      this.socketPlayers.set(socket.id, {
        socketId: socket.id,
        player
      });

      this.matchmakingService.addPlayer(player);

      socket.emit('waiting-for-opponent', { playerId: player.id });
      logger.info('Player joined matchmaking', { socketId: socket.id, playerId: player.id });
    } catch (error) {
      logger.error('Error handling join-game', { error, socketId: socket.id });
      socket.emit('error', { message: 'Failed to join game' });
    }
  }

  private async handleMakeMove(socket: any, data: { gameId: string; column: number }): Promise<void> {
    try {
      const { gameId, column } = data;
      const socketPlayer = this.socketPlayers.get(socket.id);

      if (!socketPlayer) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      const game = this.gameStateManager.getGame(gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      if (!game.isPlayerTurn(socketPlayer.player.id)) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      game.makeMove(column, socketPlayer.player.id);
      this.gameStateManager.updateGame(gameId, game);

      const board = game.getEngine().getBoard();
      const row = this.findRowForColumn(column, board);

      await this.kafkaProducer.emitMoveMade(gameId, socketPlayer.player.id, column, row);

      this.io.to(gameId).emit('move-made', {
        gameId,
        playerId: socketPlayer.player.id,
        column,
        row,
        game: game.toJSON()
      });

      if (game.getStatus() === 'won' || game.getStatus() === 'draw') {
        await this.handleGameEnd(game);
      } else if (game.getCurrentPlayer().isBot()) {
        setTimeout(() => this.handleBotMove(gameId), 500);
      }

      logger.info('Move made', { gameId, playerId: socketPlayer.player.id, column });
    } catch (error: any) {
      logger.error('Error handling make-move', { error, socketId: socket.id });
      socket.emit('error', { message: error.message || 'Failed to make move' });
    }
  }

  private async handleBotMove(gameId: string): Promise<void> {
    const game = this.gameStateManager.getGame(gameId);
    if (!game) {
      return;
    }

    const currentPlayer = game.getCurrentPlayer();
    if (!currentPlayer.isBot()) {
      return;
    }

    try {
      const botPlayerNumber = game.player1.id === currentPlayer.id ? 1 : 2;
      const botService = new BotService(botPlayerNumber);
      const engine = game.getEngine();
      const column = botService.calculateMove(engine);

      game.makeMove(column, currentPlayer.id);
      this.gameStateManager.updateGame(gameId, game);

      const board = game.getEngine().getBoard();
      const row = this.findRowForColumn(column, board);

      await this.kafkaProducer.emitMoveMade(gameId, currentPlayer.id, column, row);

      this.io.to(gameId).emit('move-made', {
        gameId,
        playerId: currentPlayer.id,
        column,
        row,
        game: game.toJSON()
      });

      if (game.getStatus() === 'won' || game.getStatus() === 'draw') {
        await this.handleGameEnd(game);
      }

      logger.info('Bot move made', { gameId, column });
    } catch (error) {
      logger.error('Error handling bot move', { error, gameId });
    }
  }

  private async handleGameEnd(game: any): Promise<void> {
    await this.databaseService.saveGame(game);
    await this.kafkaProducer.emitGameCompleted(
      game.id,
      game.getWinner()?.id || null,
      game.getStatus()
    );

    this.io.to(game.id).emit('game-over', {
      game: game.toJSON(),
      winner: game.getWinner()?.toJSON() || null
    });

    setTimeout(() => {
      this.gameStateManager.removeGame(game.id);
    }, 60000);

    logger.info('Game ended', { gameId: game.id, status: game.getStatus() });
  }

  private findRowForColumn(column: number, board: any): number {
    const boardState = board.getBoard();
    for (let row = 0; row < boardState.length; row++) {
      if (boardState[row][column] !== 0) {
        return row;
      }
    }
    return -1;
  }

  private async handleReconnect(socket: any, data: { username: string; gameId?: string }): Promise<void> {
    try {
      const { username, gameId } = data;
      let game;

      if (gameId) {
        game = this.gameStateManager.getGame(gameId);
      } else {
        const allGames = this.gameStateManager.getAllActiveGames();
        game = allGames.find(g => 
          g.player1.username === username || g.player2.username === username
        );
      }

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const player = game.player1.username === username ? game.player1 : game.player2;
      const socketPlayer = this.socketPlayers.get(socket.id);

      if (socketPlayer && socketPlayer.disconnectedAt) {
        const disconnectTime = new Date().getTime() - socketPlayer.disconnectedAt.getTime();
        if (disconnectTime > this.RECONNECTION_TIMEOUT_MS) {
          await this.handleGameForfeit(game, player.id);
          socket.emit('error', { message: 'Reconnection timeout exceeded' });
          return;
        }
      }

      this.socketPlayers.set(socket.id, {
        socketId: socket.id,
        player,
        gameId: game.id
      });

      socket.join(game.id);
      socket.emit('game-update', game.toJSON());
      this.io.to(game.id).emit('player-reconnected', { playerId: player.id });

      logger.info('Player reconnected', { socketId: socket.id, gameId: game.id, playerId: player.id });
    } catch (error) {
      logger.error('Error handling reconnect', { error, socketId: socket.id });
      socket.emit('error', { message: 'Failed to reconnect' });
    }
  }

  private handleDisconnect(socket: any): void {
    const socketPlayer = this.socketPlayers.get(socket.id);
    if (!socketPlayer) {
      return;
    }

    socketPlayer.disconnectedAt = new Date();

    if (socketPlayer.gameId) {
      const game = this.gameStateManager.getGame(socketPlayer.gameId);
      if (game) {
        this.io.to(socketPlayer.gameId).emit('player-disconnected', {
          playerId: socketPlayer.player.id
        });

        this.kafkaProducer.emitPlayerDisconnected(socketPlayer.gameId, socketPlayer.player.id);

        setTimeout(async () => {
          const stillDisconnected = this.socketPlayers.get(socket.id);
          if (stillDisconnected && stillDisconnected.disconnectedAt) {
            const disconnectTime = new Date().getTime() - stillDisconnected.disconnectedAt.getTime();
            if (disconnectTime >= this.RECONNECTION_TIMEOUT_MS) {
              await this.handleGameForfeit(game, socketPlayer.player.id);
            }
          }
        }, this.RECONNECTION_TIMEOUT_MS);
      }
    }

    this.matchmakingService.removePlayer(socketPlayer.player.id);
    logger.info('Player disconnected', { socketId: socket.id, playerId: socketPlayer.player.id });
  }

  private async handleGameForfeit(game: any, forfeitingPlayerId: string): Promise<void> {
    const winner = game.player1.id === forfeitingPlayerId ? game.player2 : game.player1;
    
    const engine = game.getEngine();
    const status = 'won';
    
    await this.databaseService.saveGame(game);
    await this.kafkaProducer.emitGameCompleted(game.id, winner.id, status);

    this.io.to(game.id).emit('game-over', {
      game: game.toJSON(),
      winner: winner.toJSON(),
      forfeit: true
    });

    this.gameStateManager.removeGame(game.id);
    logger.info('Game forfeited', { gameId: game.id, forfeitingPlayerId, winnerId: winner.id });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

