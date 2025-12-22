import { Pool, QueryResult } from 'pg';
import { Game } from '../core/Game';
import { logger } from '../config/logger';

export interface PlayerStats {
  id: string;
  username: string;
  gamesWon: number;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  gamesWon: number;
  rank: number;
}

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'emittr_game',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
    });
  }

  async initialize(): Promise<void> {
    try {
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '../models/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await this.pool.query(schema);
      logger.info('Database schema initialized');
    } catch (error) {
      logger.error('Failed to initialize database schema', { error });
      throw error;
    }
  }

  async savePlayer(playerId: string, username: string): Promise<void> {
    const query = `
      INSERT INTO players (id, username)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
    `;
    
    try {
      await this.pool.query(query, [playerId, username]);
      logger.debug('Player saved', { playerId, username });
    } catch (error) {
      logger.error('Failed to save player', { error, playerId, username });
      throw error;
    }
  }

  async saveGame(game: Game): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      await this.savePlayer(game.player1.id, game.player1.username);
      await this.savePlayer(game.player2.id, game.player2.username);

      const winnerId = game.getWinner()?.id || null;
      const status = game.getStatus() === 'won' ? 'completed' : game.getStatus();

      const gameQuery = `
        INSERT INTO games (id, player1_id, player2_id, winner_id, status, created_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      await client.query(gameQuery, [
        game.id,
        game.player1.id,
        game.player2.id,
        winnerId,
        status,
        game.createdAt,
        game.getStatus() !== 'playing' ? new Date() : null
      ]);

      if (winnerId) {
        await client.query(
          'UPDATE players SET games_won = games_won + 1 WHERE id = $1',
          [winnerId]
        );
      }

      await client.query('COMMIT');
      logger.info('Game saved', { gameId: game.id, winnerId });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to save game', { error, gameId: game.id });
      throw error;
    } finally {
      client.release();
    }
  }

  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const query = `
      SELECT id, username, games_won
      FROM players
      WHERE id = $1
    `;

    try {
      const result: QueryResult = await this.pool.query(query, [playerId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        username: row.username,
        gamesWon: parseInt(row.games_won) || 0
      };
    } catch (error) {
      logger.error('Failed to get player stats', { error, playerId });
      throw error;
    }
  }

  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    const query = `
      SELECT id, username, games_won,
             ROW_NUMBER() OVER (ORDER BY games_won DESC) as rank
      FROM players
      WHERE games_won > 0
      ORDER BY games_won DESC
      LIMIT $1
    `;

    try {
      const result: QueryResult = await this.pool.query(query, [limit]);
      
      return result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        gamesWon: parseInt(row.games_won) || 0,
        rank: parseInt(row.rank)
      }));
    } catch (error) {
      logger.error('Failed to get leaderboard', { error });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

