import { Kafka } from 'kafkajs';
import { logger } from '../config/logger';

export interface GameEvent {
  type: 'game.started' | 'move.made' | 'game.completed' | 'player.disconnected';
  gameId: string;
  playerId?: string;
  timestamp: string;
  data?: any;
}

export class KafkaProducer {
  private producer: any;
  private kafka: Kafka;
  private isConnected: boolean = false;

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    const clientId = process.env.KAFKA_CLIENT_ID || 'emittr-game-backend';

    this.kafka = new Kafka({
      clientId,
      brokers
    });

    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    const maxRetries = 3;
    const retryDelay = 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await Promise.race([
          this.producer.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
          )
        ]);
        this.isConnected = true;
        logger.info('Kafka producer connected');
        return;
      } catch (error: any) {
        if (attempt === maxRetries) {
          logger.warn('Kafka producer not connected after retries. Server will continue without analytics.', { 
            attempts: maxRetries,
            error: error.message || error
          });
          this.isConnected = false;
        } else {
          logger.debug(`Kafka connection attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  }

  async emit(event: GameEvent): Promise<void> {
    if (!this.isConnected) {
      logger.warn('Kafka producer not connected, skipping event', { eventType: event.type });
      return;
    }

    try {
      const topic = this.getTopicForEventType(event.type);
      const message = {
        key: event.gameId,
        value: JSON.stringify(event)
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      logger.debug('Event emitted to Kafka', { eventType: event.type, gameId: event.gameId });
    } catch (error) {
      logger.error('Failed to emit event to Kafka', { error, eventType: event.type });
    }
  }

  async emitGameStarted(gameId: string, player1Id: string, player2Id: string): Promise<void> {
    await this.emit({
      type: 'game.started',
      gameId,
      timestamp: new Date().toISOString(),
      data: {
        player1Id,
        player2Id
      }
    });
  }

  async emitMoveMade(gameId: string, playerId: string, column: number, row: number): Promise<void> {
    await this.emit({
      type: 'move.made',
      gameId,
      playerId,
      timestamp: new Date().toISOString(),
      data: {
        column,
        row
      }
    });
  }

  async emitGameCompleted(gameId: string, winnerId: string | null, status: string): Promise<void> {
    await this.emit({
      type: 'game.completed',
      gameId,
      timestamp: new Date().toISOString(),
      data: {
        winnerId,
        status
      }
    });
  }

  async emitPlayerDisconnected(gameId: string, playerId: string): Promise<void> {
    await this.emit({
      type: 'player.disconnected',
      gameId,
      playerId,
      timestamp: new Date().toISOString()
    });
  }

  private getTopicForEventType(eventType: string): string {
    const topicMap: Record<string, string> = {
      'game.started': 'game-events',
      'move.made': 'game-events',
      'game.completed': 'game-events',
      'player.disconnected': 'game-events'
    };

    return topicMap[eventType] || 'game-events';
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('Kafka producer disconnected');
    }
  }
}

