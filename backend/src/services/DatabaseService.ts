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
      await this.pool.query('SELECT 1').catch((error: any) => {
        logger.warn('Database connection test failed', { 
          error: error?.message || error,
          code: error?.code,
          host: process.env.DB_HOST 
        });
        throw error;
      });

      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '../models/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await this.pool.query(schema);
      
      await this.pool.query(`
        ALTER TABLE games 
        ALTER COLUMN player1_id DROP NOT NULL,
        ALTER COLUMN player2_id DROP NOT NULL;
      `).catch((error: any) => {
        if (error.code !== '42704' && error.code !== '42804') {
          logger.warn('Could not alter games table columns (may already be nullable)', { error: error?.message });
        }
      });
      
      logger.info('Database schema initialized');
    } catch (error: any) {
      logger.error('Failed to initialize database schema', { 
        error: error?.message || error,
        code: error?.code,
        host: process.env.DB_HOST 
      });
      throw error;
    }
  }

  async savePlayer(playerId: string, username: string): Promise<string> {
    const checkQuery = `SELECT id FROM players WHERE username = $1`;
    const insertQuery = `
      INSERT INTO players (id, username)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
    `;
    
    try {
      const existingPlayer = await this.pool.query(checkQuery, [username]);
      
      if (existingPlayer.rows.length > 0) {
        const existingId = existingPlayer.rows[0].id;
        logger.debug('Player with username already exists, using existing ID', { 
          existingId, 
          newId: playerId, 
          username 
        });
        return existingId;
      }

      await this.pool.query(insertQuery, [playerId, username]);
      logger.debug('Player saved', { playerId, username });
      return playerId;
    } catch (error: any) {
      if (error.code === '23505') {
        logger.debug('Player already exists, skipping save', { playerId, username });
        const existing = await this.pool.query(checkQuery, [username]);
        return existing.rows.length > 0 ? existing.rows[0].id : playerId;
      }
      logger.error('Failed to save player', { error, playerId, username });
      throw error;
    }
  }

  async saveGame(game: Game): Promise<void> {
    let client;
    try {
      client = await this.pool.connect();
    } catch (error: any) {
      logger.warn('Failed to get database connection for game save', { 
        error: error?.message || error,
        code: error?.code,
        gameId: game.id 
      });
      return;
    }
    
    try {
      await client.query('BEGIN');

      let dbPlayer1Id: string | null = null;
      let dbPlayer2Id: string | null = null;

      if (game.player1.isHuman()) {
        try {
          dbPlayer1Id = await this.savePlayer(game.player1.id, game.player1.username);
        } catch (error: any) {
          logger.warn('Failed to save player1, continuing', { error: error?.message, playerId: game.player1.id });
        }
      }

      if (game.player2.isHuman()) {
        try {
          dbPlayer2Id = await this.savePlayer(game.player2.id, game.player2.username);
        } catch (error: any) {
          logger.warn('Failed to save player2, continuing', { error: error?.message, playerId: game.player2.id });
        }
      }

      const winner = game.getWinner();
      const status = game.getStatus() === 'won' ? 'completed' : game.getStatus();
      
      let finalWinnerId: string | null = null;
      if (winner) {
        if (game.player1.id === winner.id && game.player1.isHuman()) {
          finalWinnerId = dbPlayer1Id;
        } else if (game.player2.id === winner.id && game.player2.isHuman()) {
          finalWinnerId = dbPlayer2Id;
        }
      }

      if (dbPlayer1Id || dbPlayer2Id) {
        const gameQuery = `
          INSERT INTO games (id, player1_id, player2_id, winner_id, status, created_at, completed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        await client.query(gameQuery, [
          game.id,
          dbPlayer1Id,
          dbPlayer2Id,
          finalWinnerId,
          status,
          game.createdAt,
          game.getStatus() !== 'playing' ? new Date() : null
        ]);

        if (finalWinnerId) {
          await client.query(
            'UPDATE players SET games_won = games_won + 1 WHERE id = $1',
            [finalWinnerId]
          );
          logger.info('Updated games_won for winner', { winnerId: finalWinnerId, username: winner?.username });
        }
      } else {
        logger.debug('Skipping game save - both players are bots', { gameId: game.id });
      }

      await client.query('COMMIT');
      logger.info('Game saved', { gameId: game.id, winnerId: finalWinnerId, winner: winner?.username });
    } catch (error: any) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        logger.warn('Game save failed due to duplicate key, but game state is preserved', { 
          error: error?.message, 
          gameId: game.id 
        });
      } else {
        logger.error('Failed to save game', { error, gameId: game.id });
      }
    } finally {
      if (client) {
        client.release();
      }
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
    } catch (error: any) {
      logger.error('Failed to get player stats', { 
        error: error?.message || error,
        code: error?.code,
        playerId 
      });
      return null;
    }
  }

  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    const query = `
      SELECT id, username, games_won,
             ROW_NUMBER() OVER (ORDER BY games_won DESC, username ASC) as rank
      FROM players
      WHERE LOWER(username) != 'bot'
      ORDER BY games_won DESC, username ASC
      LIMIT $1
    `;

    try {
      const result: QueryResult = await this.pool.query(query, [limit]);
      
      const leaderboard = result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        gamesWon: parseInt(row.games_won) || 0,
        rank: parseInt(row.rank)
      }));

      logger.debug('Leaderboard fetched', { count: leaderboard.length, limit });
      return leaderboard;
    } catch (error: any) {
      logger.error('Failed to get leaderboard', { error, errorMessage: error?.message });
      return [];
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

