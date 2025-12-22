import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { GameStateManager } from './services/GameStateManager';
import { MatchmakingService } from './services/MatchmakingService';
import { DatabaseService } from './services/DatabaseService';
import { KafkaProducer } from './services/KafkaProducer';
import { WebSocketHandler } from './api/websocket';
import { createRoutes } from './api/routes';
import { logger } from './config/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.static('public'));

const gameStateManager = new GameStateManager();
const databaseService = new DatabaseService();
const matchmakingService = new MatchmakingService(gameStateManager);
const kafkaProducer = new KafkaProducer();

const websocketHandler = new WebSocketHandler(
  httpServer,
  gameStateManager,
  matchmakingService,
  databaseService,
  kafkaProducer
);

app.use('/api', createRoutes(databaseService));

async function startServer() {
  try {
    await databaseService.initialize();
    logger.info('Database initialized');

    await kafkaProducer.connect();
    logger.info('Kafka producer connected');

    const port = process.env.PORT || 3000;
    httpServer.listen(port, () => {
      logger.info(`Server started on port ${port}`);
    });

    setInterval(() => {
      gameStateManager.cleanupStaleGames(60);
    }, 60000);

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await kafkaProducer.disconnect();
      await databaseService.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

