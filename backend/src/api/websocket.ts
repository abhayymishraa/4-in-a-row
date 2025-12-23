import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { GameStateManager } from "../services/GameStateManager";
import { MatchmakingService } from "../services/MatchmakingService";
import { BotService } from "../services/BotService";
import { DatabaseService } from "../services/DatabaseService";
import { Player } from "../core/Player";
import { logger } from "../config/logger";
import { v4 as uuidv4 } from "uuid";

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
  private socketPlayers: Map<string, SocketPlayer>;
  private activeUsernames: Map<string, string>; // username -> socketId
  private readonly RECONNECTION_TIMEOUT_MS = 30000;

  constructor(
    httpServer: HTTPServer,
    gameStateManager: GameStateManager,
    matchmakingService: MatchmakingService,
    databaseService: DatabaseService,
  ) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.gameStateManager = gameStateManager;
    this.matchmakingService = matchmakingService;
    this.databaseService = databaseService;
    this.socketPlayers = new Map();
    this.activeUsernames = new Map();

    this.matchmakingService.setOnGameCreated((gameId, player1, player2) => {
      this.handleGameCreated(gameId, player1, player2);
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket) => {
      logger.info("Client connected", { socketId: socket.id });

      socket.on(
        "join-game",
        async (data: { username: string; gameId?: string }) => {
          await this.handleJoinGame(socket, data);
        },
      );

      socket.on("create-game", async (data: { username: string }) => {
        await this.handleCreateGame(socket, data);
      });

      socket.on(
        "make-move",
        async (data: { gameId: string; column: number }) => {
          await this.handleMakeMove(socket, data);
        },
      );

      socket.on(
        "reconnect",
        async (data: { username: string; gameId?: string }) => {
          await this.handleReconnect(socket, data);
        },
      );

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleGameCreated(
    gameId: string,
    player1: Player,
    player2: Player,
  ): Promise<void> {
    const game = this.gameStateManager.getGame(gameId);
    if (!game) {
      logger.error("Game not found in handleGameCreated", {
        gameId,
        player1Id: player1.id,
        player2Id: player2.id,
      });
      return;
    }

    let playersFound = 0;
    for (const [socketId, socketPlayer] of this.socketPlayers.entries()) {
      if (
        socketPlayer.player.id === player1.id ||
        socketPlayer.player.id === player2.id
      ) {
        socketPlayer.gameId = gameId;
        playersFound++;
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(gameId);
          socket.emit("game-update", game.toJSON());
          logger.debug("Player notified of game creation", {
            socketId,
            gameId,
            playerId: socketPlayer.player.id,
            username: socketPlayer.player.username,
          });
        } else {
          logger.warn("Socket not found for player in game creation", {
            socketId,
            playerId: socketPlayer.player.id,
          });
        }
      }
    }

    if (playersFound < 2) {
      logger.warn("Not all players found when creating game", {
        gameId,
        player1Id: player1.id,
        player2Id: player2.id,
        playersFound,
        allSocketPlayers: Array.from(this.socketPlayers.entries()).map(
          ([sid, sp]) => ({
            socketId: sid,
            playerId: sp.player.id,
            username: sp.player.username,
            gameId: sp.gameId,
          }),
        ),
      });
    }

    logger.info("Game created and players notified", {
      gameId,
      player1Id: player1.id,
      player2Id: player2.id,
      playersFound,
    });
  }

  private async handleJoinGame(
    socket: any,
    data: { username: string; gameId?: string },
  ): Promise<void> {
    try {
      const { username, gameId } = data;

      if (!username || username.trim().length === 0) {
        socket.emit("error", { message: "Username is required" });
        return;
      }

      if (gameId) {
        let game = this.gameStateManager.getGame(gameId);

        if (!game) {
          logger.warn(
            "Game not found immediately, checking matchmaking queue",
            {
              gameId,
              username,
              socketId: socket.id,
            },
          );

          const waitingGame =
            this.matchmakingService.findWaitingGameByGameId(gameId);

          if (waitingGame) {
            const trimmedUsername = username.trim();

            if (this.isUsernameTaken(trimmedUsername, socket.id)) {
              const availableUsername =
                this.generateUniqueUsername(trimmedUsername);
              socket.emit("username-taken", {
                requestedUsername: trimmedUsername,
                assignedUsername: availableUsername,
                message: `Username "${trimmedUsername}" is already taken. Using "${availableUsername}" instead.`,
              });

              const joiningPlayer = new Player(
                uuidv4(),
                availableUsername,
                "human",
              );
              this.activeUsernames.set(availableUsername, socket.id);

              try {
                await this.databaseService.savePlayer(
                  joiningPlayer.id,
                  availableUsername,
                );
              } catch (dbError) {
                logger.warn("Failed to save joining player to database", {
                  error: dbError,
                });
              }

              this.socketPlayers.set(socket.id, {
                socketId: socket.id,
                player: joiningPlayer,
                gameId,
              });

              socket.join(gameId);
              this.matchmakingService.joinWaitingGame(gameId, joiningPlayer);
              return;
            }

            const joiningPlayer = new Player(
              uuidv4(),
              trimmedUsername,
              "human",
            );
            this.activeUsernames.set(trimmedUsername, socket.id);

            try {
              await this.databaseService.savePlayer(
                joiningPlayer.id,
                trimmedUsername,
              );
            } catch (dbError) {
              logger.warn("Failed to save joining player to database", {
                error: dbError,
              });
            }

            this.socketPlayers.set(socket.id, {
              socketId: socket.id,
              player: joiningPlayer,
              gameId,
            });

            socket.join(gameId);
            this.matchmakingService.joinWaitingGame(gameId, joiningPlayer);

            logger.info("Player joined waiting game", {
              gameId,
              joiningPlayerId: joiningPlayer.id,
              username: trimmedUsername,
            });
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
          game = this.gameStateManager.getGame(gameId);
        }

        if (!game) {
          logger.error("Game not found when joining with gameId after retry", {
            gameId,
            username,
            socketId: socket.id,
            activeGameIds: Array.from(
              this.gameStateManager.getAllActiveGames().map((g) => g.id),
            ),
          });
          socket.emit("error", {
            message: "Game not found. It may have expired or does not exist.",
          });
          return;
        }

        let player =
          game.player1.username === username
            ? game.player1
            : game.player2.username === username
              ? game.player2
              : null;

        if (!player) {
          logger.warn("Player not found in game when joining", {
            gameId,
            username,
            socketId: socket.id,
            player1Username: game.player1.username,
            player2Username: game.player2.username,
          });
          socket.emit("error", {
            message: "You are not a player in this game",
          });
          return;
        }

        const trimmedUsername = username.trim();
        if (
          this.isUsernameTaken(trimmedUsername, socket.id) &&
          player.username === trimmedUsername
        ) {
          const availableUsername =
            this.generateUniqueUsername(trimmedUsername);
          logger.warn("Username conflict when rejoining game", {
            requested: trimmedUsername,
            assigned: availableUsername,
            gameId,
            socketId: socket.id,
          });
          socket.emit("username-taken", {
            requestedUsername: trimmedUsername,
            assignedUsername: availableUsername,
            message: `Username "${trimmedUsername}" is already taken. Using "${availableUsername}" instead.`,
          });
          player = new Player(player.id, availableUsername, player.type);
        }

        if (!this.isUsernameTaken(player.username, socket.id)) {
          this.activeUsernames.set(player.username, socket.id);
        }

        const existingSocketPlayer = this.socketPlayers.get(socket.id);
        const socketPlayerData: SocketPlayer = {
          socketId: socket.id,
          player,
          gameId,
        };

        if (existingSocketPlayer) {
          if (
            existingSocketPlayer.player &&
            existingSocketPlayer.player.username
          ) {
            const oldUsername = existingSocketPlayer.player.username;
            const existingSocketId = this.activeUsernames.get(oldUsername);
            if (existingSocketId === socket.id) {
              this.activeUsernames.delete(oldUsername);
            }
          }
          socketPlayerData.disconnectedAt = existingSocketPlayer.disconnectedAt;
        }

        this.socketPlayers.set(socket.id, socketPlayerData);

        socket.join(gameId);
        socket.emit("game-update", game.toJSON());
        logger.info("Player joined/rejoined game", {
          socketId: socket.id,
          gameId,
          playerId: player.id,
          username: player.username,
          wasExistingPlayer: !!existingSocketPlayer,
        });
        return;
      }

      const trimmedUsername = username.trim();

      if (this.isUsernameTaken(trimmedUsername, socket.id)) {
        const availableUsername = this.generateUniqueUsername(trimmedUsername);
        socket.emit("username-taken", {
          requestedUsername: trimmedUsername,
          assignedUsername: availableUsername,
          message: `Username "${trimmedUsername}" is already taken. Using "${availableUsername}" instead.`,
        });
        logger.info("Username already taken, assigned alternative", {
          requested: trimmedUsername,
          assigned: availableUsername,
          socketId: socket.id,
        });
      }

      const finalUsername = this.isUsernameTaken(trimmedUsername, socket.id)
        ? this.generateUniqueUsername(trimmedUsername)
        : trimmedUsername;

      const playerId = uuidv4();
      const player = new Player(playerId, finalUsername, "human");

      this.activeUsernames.set(finalUsername, socket.id);

      try {
        await this.databaseService.savePlayer(playerId, finalUsername);
      } catch (dbError) {
        logger.warn("Failed to save player to database, continuing anyway", {
          error: dbError,
          playerId,
          username: finalUsername,
        });
      }

      this.socketPlayers.set(socket.id, {
        socketId: socket.id,
        player,
      });

      this.matchmakingService.addPlayer(player);

      socket.emit("waiting-for-opponent", {
        playerId: player.id,
        username: finalUsername,
      });
      logger.info("Player joined matchmaking", {
        socketId: socket.id,
        playerId: player.id,
        username: finalUsername,
      });
    } catch (error: any) {
      logger.error("Error handling join-game", {
        error,
        socketId: socket.id,
        errorMessage: error?.message,
      });
      socket.emit("error", {
        message: error?.message || "Failed to join game. Please try again.",
      });
    }
  }

  private async handleCreateGame(
    socket: any,
    data: { username: string },
  ): Promise<void> {
    try {
      const { username } = data;

      if (!username || username.trim().length === 0) {
        socket.emit("error", { message: "Username is required" });
        return;
      }

      const trimmedUsername = username.trim();

      if (this.isUsernameTaken(trimmedUsername, socket.id)) {
        const availableUsername = this.generateUniqueUsername(trimmedUsername);
        socket.emit("username-taken", {
          requestedUsername: trimmedUsername,
          assignedUsername: availableUsername,
          message: `Username "${trimmedUsername}" is already taken. Using "${availableUsername}" instead.`,
        });
        logger.info("Username already taken, assigned alternative", {
          requested: trimmedUsername,
          assigned: availableUsername,
          socketId: socket.id,
        });
      }

      const finalUsername = this.isUsernameTaken(trimmedUsername, socket.id)
        ? this.generateUniqueUsername(trimmedUsername)
        : trimmedUsername;

      const playerId = uuidv4();
      const player = new Player(playerId, finalUsername, "human");

      this.activeUsernames.set(finalUsername, socket.id);

      try {
        await this.databaseService.savePlayer(playerId, finalUsername);
      } catch (dbError) {
        logger.warn("Failed to save player to database, continuing anyway", {
          error: dbError,
          playerId,
          username: finalUsername,
        });
      }

      this.socketPlayers.set(socket.id, {
        socketId: socket.id,
        player,
      });

      const gameId = uuidv4();
      this.socketPlayers.get(socket.id)!.gameId = gameId;
      socket.join(gameId);

      socket.emit("game-created", {
        gameId,
        waiting: true,
        botJoinTime: 10000,
      });

      logger.info("Game room created, waiting for opponent", {
        gameId,
        playerId: player.id,
        username: finalUsername,
      });

      const createBotGame = async () => {
        const existingGame = this.gameStateManager.getGame(gameId);
        if (existingGame) {
          logger.debug("Game already created, skipping bot", { gameId });
          return;
        }

        const botPlayer = new Player(uuidv4(), "Bot", "bot");
        const game = this.gameStateManager.createGame(
          player,
          botPlayer,
          gameId,
        );

        this.io.to(gameId).emit("game-update", game.toJSON());
        logger.info("Bot joined game after timeout", {
          gameId,
          playerId: player.id,
        });
      };

      const botTimer = setTimeout(createBotGame, 10000);

      this.matchmakingService.addPlayer(
        player,
        gameId,
        async (matchedPlayer: Player) => {
          clearTimeout(botTimer);

          const existingGame = this.gameStateManager.getGame(gameId);
          if (existingGame) {
            logger.debug("Game already created, skipping match", { gameId });
            return;
          }

          const game = this.gameStateManager.createGame(
            player,
            matchedPlayer,
            gameId,
          );
          this.io.to(gameId).emit("game-update", game.toJSON());
          logger.info("Human opponent matched", {
            gameId,
            player1Id: player.id,
            player2Id: matchedPlayer.id,
          });
        },
      );
    } catch (error: any) {
      logger.error("Error handling create-game", {
        error,
        socketId: socket.id,
        errorMessage: error?.message,
      });
      socket.emit("error", {
        message: error?.message || "Failed to create game. Please try again.",
      });
    }
  }

  private async handleMakeMove(
    socket: any,
    data: { gameId: string; column: number },
  ): Promise<void> {
    try {
      let { gameId, column } = data;
      const socketPlayer = this.socketPlayers.get(socket.id);

      if (!socketPlayer) {
        logger.warn("Make move attempted without authentication", {
          socketId: socket.id,
          gameId,
        });
        socket.emit("error", { message: "Not authenticated" });
        return;
      }

      let game = this.gameStateManager.getGame(gameId);

      if (!game && socketPlayer.gameId) {
        logger.warn(
          "Game not found with provided gameId, trying socketPlayer gameId",
          {
            providedGameId: gameId,
            socketPlayerGameId: socketPlayer.gameId,
            socketId: socket.id,
          },
        );
        gameId = socketPlayer.gameId;
        game = this.gameStateManager.getGame(gameId);
      }

      logger.debug("Make move request", {
        socketId: socket.id,
        gameId,
        column,
        playerId: socketPlayer.player.id,
        socketPlayerGameId: socketPlayer.gameId,
        allGameIds: Array.from(
          this.gameStateManager.getAllActiveGames().map((g) => g.id),
        ),
      });

      if (!game) {
        logger.warn("Game not found by gameId, trying to find by player", {
          gameId,
          socketId: socket.id,
          playerId: socketPlayer.player.id,
          socketPlayerGameId: socketPlayer.gameId,
        });

        const playerGame = this.gameStateManager.findGameByPlayer(
          socketPlayer.player.id,
        );
        if (playerGame) {
          game = playerGame;
          gameId = playerGame.id;
          socketPlayer.gameId = gameId;
          logger.info("Found game by player ID", {
            gameId,
            playerId: socketPlayer.player.id,
          });
        }
      }

      if (!game) {
        logger.error("Game not found when making move after all fallbacks", {
          gameId,
          socketId: socket.id,
          playerId: socketPlayer.player.id,
          socketPlayerGameId: socketPlayer.gameId,
          activeGameIds: Array.from(
            this.gameStateManager.getAllActiveGames().map((g) => g.id),
          ),
        });
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (!game.isPlayerTurn(socketPlayer.player.id)) {
        socket.emit("error", { message: "Not your turn" });
        return;
      }

      game.makeMove(column, socketPlayer.player.id);
      this.gameStateManager.updateGame(gameId, game);

      const board = game.getEngine().getBoard();
      const row = this.findRowForColumn(column, board);

      const gameStatus = game.getStatus();
      const gameData = game.toJSON();

      logger.debug("Move processed", {
        gameId,
        playerId: socketPlayer.player.id,
        column,
        row,
        status: gameStatus,
        winnerId: game.getWinner()?.id || null,
        boardState: JSON.stringify(gameData.board),
      });

      this.io.to(gameId).emit("move-made", {
        gameId,
        playerId: socketPlayer.player.id,
        column,
        row,
        game: gameData,
      });

      if (gameStatus === "won" || gameStatus === "draw") {
        logger.info("Game ended after move", {
          gameId,
          status: gameStatus,
          winner: game.getWinner()?.username || null,
        });
        setTimeout(async () => {
          await this.handleGameEnd(game);
        }, 200);
      } else {
        const nextPlayer = game.getCurrentPlayer();
        if (nextPlayer.isBot()) {
          setTimeout(() => this.handleBotMove(gameId), 500);
        }
      }

      logger.info("Move made", {
        gameId,
        playerId: socketPlayer.player.id,
        column,
        status: gameStatus,
      });
    } catch (error: any) {
      logger.error("Error handling make-move", { error, socketId: socket.id });
      socket.emit("error", { message: error.message || "Failed to make move" });
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

      const gameStatus = game.getStatus();
      const gameData = game.toJSON();

      this.io.to(gameId).emit("move-made", {
        gameId,
        playerId: currentPlayer.id,
        column,
        row,
        game: gameData,
      });

      if (gameStatus === "won" || gameStatus === "draw") {
        setTimeout(async () => {
          await this.handleGameEnd(game);
        }, 200);
      } else {
        const nextPlayer = game.getCurrentPlayer();
        if (nextPlayer.isBot()) {
          setTimeout(() => this.handleBotMove(gameId), 500);
        }
      }

      logger.info("Bot move made", { gameId, column, status: gameStatus });
    } catch (error: any) {
      logger.error("Error handling bot move", {
        error,
        gameId,
        errorMessage: error?.message,
      });
      const game = this.gameStateManager.getGame(gameId);
      if (game && game.getStatus() === "playing") {
        const currentPlayer = game.getCurrentPlayer();
        if (currentPlayer.isBot()) {
          logger.warn("Bot move failed, trying fallback move", { gameId });
          try {
            const availableColumns = game
              .getEngine()
              .getBoard()
              .getAvailableColumns();
            if (availableColumns.length > 0) {
              const fallbackColumn =
                availableColumns[
                  Math.floor(Math.random() * availableColumns.length)
                ];
              game.makeMove(fallbackColumn, currentPlayer.id);
              this.gameStateManager.updateGame(gameId, game);
              const board = game.getEngine().getBoard();
              const row = this.findRowForColumn(fallbackColumn, board);
              this.io.to(gameId).emit("move-made", {
                gameId,
                playerId: currentPlayer.id,
                column: fallbackColumn,
                row,
                game: game.toJSON(),
              });
              if (game.getStatus() === "won" || game.getStatus() === "draw") {
                setTimeout(async () => {
                  await this.handleGameEnd(game);
                }, 100);
              }
            }
          } catch (fallbackError) {
            logger.error("Fallback bot move also failed", {
              error: fallbackError,
              gameId,
            });
          }
        }
      }
    }
  }

  private async handleGameEnd(game: any): Promise<void> {
    const gameData = game.toJSON();
    const winnerData = game.getWinner()?.toJSON() || null;
    const gameStatus = game.getStatus();

    this.io.to(game.id).emit("game-over", {
      game: gameData,
      winner: winnerData,
      status: gameStatus,
    });

    logger.info("Game ended - result sent to players", {
      gameId: game.id,
      status: gameStatus,
      winner: winnerData?.username || "draw",
    });

    try {
      await this.databaseService.saveGame(game);
      logger.info("Game saved to database successfully", {
        gameId: game.id,
        status: gameStatus,
        winner: winnerData?.username || null,
      });
    } catch (error) {
      logger.error("Error saving game data", { error, gameId: game.id });
    }

    setTimeout(() => {
      this.gameStateManager.removeGame(game.id);
      logger.debug("Game removed after delay", { gameId: game.id });
    }, 300000);
  }

  private findRowForColumn(column: number, board: any): number {
    const boardState = board.getBoard();
    // Find the topmost non-empty cell (the disc that was just placed)
    // Discs stack from bottom to top visually, but in the array:
    // - Row 0 is top (visually highest)
    // - Row 5 is bottom (visually lowest)
    // - New discs are placed at the lowest available row number (highest position)
    // - So searching from top (row 0) finds the newest disc first
    for (let row = 0; row < boardState.length; row++) {
      if (boardState[row][column] !== 0) {
        return row;
      }
    }
    return -1;
  }

  private async handleReconnect(
    socket: any,
    data: { username: string; gameId?: string },
  ): Promise<void> {
    try {
      const { username, gameId } = data;
      let game;

      if (gameId) {
        game = this.gameStateManager.getGame(gameId);
      } else {
        const allGames = this.gameStateManager.getAllActiveGames();
        game = allGames.find(
          (g) =>
            g.player1.username === username || g.player2.username === username,
        );
      }

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      const player =
        game.player1.username === username ? game.player1 : game.player2;
      const socketPlayer = this.socketPlayers.get(socket.id);

      if (socketPlayer && socketPlayer.disconnectedAt) {
        const disconnectTime =
          new Date().getTime() - socketPlayer.disconnectedAt.getTime();
        if (disconnectTime > this.RECONNECTION_TIMEOUT_MS) {
          await this.handleGameForfeit(game, player.id);
          socket.emit("error", { message: "Reconnection timeout exceeded" });
          return;
        }
      }

      this.socketPlayers.set(socket.id, {
        socketId: socket.id,
        player,
        gameId: game.id,
      });

      socket.join(game.id);
      socket.emit("game-update", game.toJSON());
      this.io.to(game.id).emit("player-reconnected", { playerId: player.id });

      logger.info("Player reconnected", {
        socketId: socket.id,
        gameId: game.id,
        playerId: player.id,
      });
    } catch (error) {
      logger.error("Error handling reconnect", { error, socketId: socket.id });
      socket.emit("error", { message: "Failed to reconnect" });
    }
  }

  private handleDisconnect(socket: any): void {
    const socketPlayer = this.socketPlayers.get(socket.id);
    if (!socketPlayer) {
      return;
    }

    socketPlayer.disconnectedAt = new Date();

    if (socketPlayer.player && socketPlayer.player.username) {
      const username = socketPlayer.player.username;
      const existingSocketId = this.activeUsernames.get(username);
      if (existingSocketId === socket.id) {
        this.activeUsernames.delete(username);
        logger.debug("Username freed on disconnect", {
          username,
          socketId: socket.id,
        });
      }
    }

    if (socketPlayer.gameId) {
      const game = this.gameStateManager.getGame(socketPlayer.gameId);
      if (game) {
        this.io.to(socketPlayer.gameId).emit("player-disconnected", {
          playerId: socketPlayer.player.id,
        });

        setTimeout(async () => {
          const stillDisconnected = this.socketPlayers.get(socket.id);
          if (stillDisconnected && stillDisconnected.disconnectedAt) {
            const disconnectTime =
              new Date().getTime() - stillDisconnected.disconnectedAt.getTime();
            if (disconnectTime >= this.RECONNECTION_TIMEOUT_MS) {
              await this.handleGameForfeit(game, socketPlayer.player.id);
            }
          }
        }, this.RECONNECTION_TIMEOUT_MS);
      }
    }

    this.matchmakingService.removePlayer(socketPlayer.player.id);
    logger.info("Player disconnected", {
      socketId: socket.id,
      playerId: socketPlayer.player.id,
      username: socketPlayer.player.username,
    });
  }

  private async handleGameForfeit(
    game: any,
    forfeitingPlayerId: string,
  ): Promise<void> {
    const winner =
      game.player1.id === forfeitingPlayerId ? game.player2 : game.player1;

    try {
      await this.databaseService.saveGame(game);
      logger.info("Forfeited game saved to database", {
        gameId: game.id,
        winnerId: winner.id,
      });
    } catch (error: any) {
      logger.error("Failed to save forfeited game to database", {
        error: error?.message || error,
        gameId: game.id,
      });
    }

    this.io.to(game.id).emit("game-over", {
      game: game.toJSON(),
      winner: winner.toJSON(),
      forfeit: true,
    });

    this.gameStateManager.removeGame(game.id);
    logger.info("Game forfeited", {
      gameId: game.id,
      forfeitingPlayerId,
      winnerId: winner.id,
    });
  }

  private isUsernameTaken(username: string, excludeSocketId?: string): boolean {
    const existingSocketId = this.activeUsernames.get(username);
    if (!existingSocketId) {
      return false;
    }
    if (excludeSocketId && existingSocketId === excludeSocketId) {
      return false;
    }
    const existingPlayer = this.socketPlayers.get(existingSocketId);
    if (!existingPlayer || existingPlayer.disconnectedAt) {
      this.activeUsernames.delete(username);
      return false;
    }
    return true;
  }

  private generateUniqueUsername(baseUsername: string): string {
    let counter = 1;
    let uniqueUsername = `${baseUsername}${counter}`;

    while (this.isUsernameTaken(uniqueUsername)) {
      counter++;
      uniqueUsername = `${baseUsername}${counter}`;
    }

    return uniqueUsername;
  }
}
