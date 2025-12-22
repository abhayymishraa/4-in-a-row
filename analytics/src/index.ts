import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import winston from 'winston';
import path from 'path';
import fs from 'fs';

dotenv.config();

const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'analytics.log')
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      )
    })
  ]
});

interface GameEvent {
  type: string;
  gameId: string;
  playerId?: string;
  timestamp: string;
  data?: any;
}

interface GameMetrics {
  gameId: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  player1Id?: string;
  player2Id?: string;
  winnerId?: string;
  moveCount: number;
  status?: string;
}

interface UserMetrics {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalMoves: number;
  averageGameDuration: number;
}

class AnalyticsService {
  private activeGames: Map<string, GameMetrics>;
  private userMetrics: Map<string, UserMetrics>;
  private dailyGames: Map<string, number>;
  private hourlyGames: Map<string, number>;

  constructor() {
    this.activeGames = new Map();
    this.userMetrics = new Map();
    this.dailyGames = new Map();
    this.hourlyGames = new Map();
  }

  processEvent(event: GameEvent): void {
    try {
      switch (event.type) {
        case 'game.started':
          this.handleGameStarted(event);
          break;
        case 'move.made':
          this.handleMoveMade(event);
          break;
        case 'game.completed':
          this.handleGameCompleted(event);
          break;
        case 'player.disconnected':
          this.handlePlayerDisconnected(event);
          break;
        default:
          logger.debug('Unknown event type', { eventType: event.type });
      }
    } catch (error) {
      logger.error('Error processing event', { error, event });
    }
  }

  private handleGameStarted(event: GameEvent): void {
    const gameMetrics: GameMetrics = {
      gameId: event.gameId,
      startTime: new Date(event.timestamp),
      moveCount: 0,
      player1Id: event.data?.player1Id,
      player2Id: event.data?.player2Id
    };

    this.activeGames.set(event.gameId, gameMetrics);

    const dateKey = new Date(event.timestamp).toISOString().split('T')[0];
    const hourKey = new Date(event.timestamp).toISOString().slice(0, 13);

    this.dailyGames.set(dateKey, (this.dailyGames.get(dateKey) || 0) + 1);
    this.hourlyGames.set(hourKey, (this.hourlyGames.get(hourKey) || 0) + 1);

    logger.info('Game started', { gameId: event.gameId });
  }

  private handleMoveMade(event: GameEvent): void {
    const gameMetrics = this.activeGames.get(event.gameId);
    if (gameMetrics) {
      gameMetrics.moveCount++;
    }

    if (event.playerId) {
      const userMetrics = this.userMetrics.get(event.playerId) || {
        userId: event.playerId,
        gamesPlayed: 0,
        gamesWon: 0,
        totalMoves: 0,
        averageGameDuration: 0
      };
      userMetrics.totalMoves++;
      this.userMetrics.set(event.playerId, userMetrics);
    }
  }

  private handleGameCompleted(event: GameEvent): void {
    const gameMetrics = this.activeGames.get(event.gameId);
    if (!gameMetrics) {
      logger.warn('Game completed but not found in active games', { gameId: event.gameId });
      return;
    }

    gameMetrics.endTime = new Date(event.timestamp);
    gameMetrics.duration = gameMetrics.endTime.getTime() - (gameMetrics.startTime?.getTime() || 0);
    gameMetrics.winnerId = event.data?.winnerId || null;
    gameMetrics.status = event.data?.status;

    if (gameMetrics.player1Id) {
      this.updateUserMetrics(gameMetrics.player1Id, gameMetrics);
    }
    if (gameMetrics.player2Id) {
      this.updateUserMetrics(gameMetrics.player2Id, gameMetrics);
    }

    this.logGameMetrics(gameMetrics);
    this.activeGames.delete(event.gameId);
  }

  private updateUserMetrics(userId: string, gameMetrics: GameMetrics): void {
    const userMetrics = this.userMetrics.get(userId) || {
      userId,
      gamesPlayed: 0,
      gamesWon: 0,
      totalMoves: 0,
      averageGameDuration: 0
    };

    userMetrics.gamesPlayed++;
    if (gameMetrics.winnerId === userId) {
      userMetrics.gamesWon++;
    }

    const totalDuration = userMetrics.averageGameDuration * (userMetrics.gamesPlayed - 1) + (gameMetrics.duration || 0);
    userMetrics.averageGameDuration = totalDuration / userMetrics.gamesPlayed;

    this.userMetrics.set(userId, userMetrics);
  }

  private handlePlayerDisconnected(event: GameEvent): void {
    logger.info('Player disconnected', { gameId: event.gameId, playerId: event.playerId });
  }

  private logGameMetrics(gameMetrics: GameMetrics): void {
    logger.info('Game completed metrics', {
      gameId: gameMetrics.gameId,
      duration: gameMetrics.duration,
      moveCount: gameMetrics.moveCount,
      winnerId: gameMetrics.winnerId,
      status: gameMetrics.status
    });
  }

  logAggregateMetrics(): void {
    const totalGames = Array.from(this.activeGames.values()).length + 
                      Array.from(this.userMetrics.values()).reduce((sum, u) => sum + u.gamesPlayed, 0);
    
    const totalDuration = Array.from(this.userMetrics.values())
      .reduce((sum, u) => sum + (u.averageGameDuration * u.gamesPlayed), 0);
    const avgDuration = totalGames > 0 ? totalDuration / totalGames : 0;

    const topWinners = Array.from(this.userMetrics.values())
      .sort((a, b) => b.gamesWon - a.gamesWon)
      .slice(0, 5);

    logger.info('Aggregate metrics', {
      totalGames,
      averageGameDuration: avgDuration,
      topWinners: topWinners.map(u => ({ userId: u.userId, gamesWon: u.gamesWon })),
      dailyGames: Object.fromEntries(this.dailyGames),
      hourlyGames: Object.fromEntries(this.hourlyGames)
    });
  }
}

async function startConsumer() {
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
  const clientId = process.env.KAFKA_CLIENT_ID || 'emittr-game-analytics';
  const groupId = process.env.KAFKA_GROUP_ID || 'analytics-consumer-group';

  const kafka = new Kafka({
    clientId,
    brokers
  });

  const consumer = kafka.consumer({ groupId });
  const analyticsService = new AnalyticsService();

  const maxRetries = 5;
  const retryDelay = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await consumer.connect();
      logger.info('Kafka consumer connected');

      await consumer.subscribe({ topic: 'game-events', fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const event: GameEvent = JSON.parse(message.value?.toString() || '{}');
            analyticsService.processEvent(event);
          } catch (error) {
            logger.error('Error processing message', { error, topic, partition });
          }
        }
      });

      setInterval(() => {
        analyticsService.logAggregateMetrics();
      }, 60000);

      process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        await consumer.disconnect();
        process.exit(0);
      });

      return;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error('Failed to start consumer after retries', { error, attempts: maxRetries });
        logger.warn('Analytics service will exit. Please ensure Kafka is running.');
        process.exit(1);
      } else {
        logger.warn(`Kafka connection attempt ${attempt}/${maxRetries} failed, retrying...`, { error });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

startConsumer();

