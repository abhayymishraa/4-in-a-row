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

  private isInitialized: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'emittr_game',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.DB_HOST?.includes('supabase.co') ? { rejectUnauthorized: false } : false,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err });
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Database already initialized, skipping.');
      return;
    }
    try {
      await this.pool.query('SELECT 1');
      logger.info('Database connection test successful', { 
        host: process.env.DB_HOST,
        database: process.env.DB_NAME 
      });

      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '../models/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await this.pool.query(schema);
      
      await this.pool.query(`
        ALTER TABLE games 
        ALTER COLUMN player1_id DROP NOT NULL,
        ALTER COLUMN player2_id DROP NOT NULL,
        ALTER COLUMN winner_id DROP NOT NULL;
      `).catch((error: any) => {
        if (error.code !== '42704' && error.code !== '42804') {
          logger.warn('Could not alter games table columns (may already be nullable or column not found):', { error: error?.message });
        }
      });

      await this.pool.query(`
        ALTER TABLE game_moves
        ALTER COLUMN player_id DROP NOT NULL;
      `).catch((error: any) => {
        if (error.code !== '42704' && error.code !== '42804') {
          logger.warn('Could not alter game_moves table columns (may already be nullable or column not found):', { error: error?.message });
        }
      });
      
      this.isInitialized = true;
      logger.info('Database schema initialized successfully');
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
    if (!this.isInitialized) {
      logger.warn('Database not initialized, skipping savePlayer', { playerId, username });
      return playerId;
    }

    const checkQuery = `SELECT id FROM players WHERE username = $1`;
    const insertQuery = `
      INSERT INTO players (id, username)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING
      RETURNING id
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

      const result = await this.pool.query(insertQuery, [playerId, username]);
      const savedId = result.rows[0]?.id || playerId;
      
      if (result.rows.length === 0) {
        const recheck = await this.pool.query(checkQuery, [username]);
        if (recheck.rows.length > 0) {
          logger.debug('Player was inserted by another process, using existing ID', { 
            existingId: recheck.rows[0].id,
            attemptedId: playerId,
            username 
          });
          return recheck.rows[0].id;
        }
      }
      
      logger.info('Player saved to database', { playerId: savedId, username });
      return savedId;
    } catch (error: any) {
      if (error.code === '23505') {
        logger.debug('Player already exists (unique constraint), fetching existing ID', { playerId, username });
        const existing = await this.pool.query(checkQuery, [username]);
        if (existing.rows.length > 0) {
          return existing.rows[0].id;
        }
      }
      logger.error('Failed to save player', { 
        error: error?.message || error,
        code: error?.code,
        playerId, 
        username 
      });
      throw error;
    }
  }

  async saveGame(game: Game): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Database not initialized, skipping saveGame', { gameId: game.id });
      return;
    }

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
          logger.debug('Player1 saved to database', { playerId: dbPlayer1Id, username: game.player1.username });
        } catch (error: any) {
          logger.warn('Failed to save player1, continuing', { error: error?.message, playerId: game.player1.id, username: game.player1.username });
        }
      }

      if (game.player2.isHuman()) {
        try {
          dbPlayer2Id = await this.savePlayer(game.player2.id, game.player2.username);
          logger.debug('Player2 saved to database', { playerId: dbPlayer2Id, username: game.player2.username });
        } catch (error: any) {
          logger.warn('Failed to save player2, continuing', { error: error?.message, playerId: game.player2.id, username: game.player2.username });
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
          ON CONFLICT (id) DO UPDATE SET
            player1_id = EXCLUDED.player1_id,
            player2_id = EXCLUDED.player2_id,
            winner_id = EXCLUDED.winner_id,
            status = EXCLUDED.status,
            completed_at = EXCLUDED.completed_at
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
          const updateResult = await client.query(
            'UPDATE players SET games_won = games_won + 1 WHERE id = $1 RETURNING id, username, games_won',
            [finalWinnerId]
          );
          if (updateResult.rows.length > 0) {
            logger.info('Updated games_won for winner', { 
              winnerId: finalWinnerId, 
              username: updateResult.rows[0].username,
              newGamesWon: updateResult.rows[0].games_won
            });
          } else {
            logger.warn('Winner ID not found when updating games_won', { winnerId: finalWinnerId });
          }
        }
      } else {
        logger.debug('Skipping game save - both players are bots', { gameId: game.id });
      }

      await client.query('COMMIT');
      logger.info('Game saved successfully', { 
        gameId: game.id, 
        winnerId: finalWinnerId, 
        winner: winner?.username || null,
        player1Id: dbPlayer1Id,
        player2Id: dbPlayer2Id
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to save game', { 
        error: error?.message || error,
        code: error?.code,
        gameId: game.id,
        stack: error?.stack
      });
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
    if (!this.isInitialized) {
      logger.warn('Database not initialized, returning empty leaderboard');
      return [];
    }

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
      
      const leaderboard = result.rows.map((row: any) => ({
        id: row.id,
        username: row.username,
        gamesWon: parseInt(row.games_won) || 0,
        rank: parseInt(row.rank)
      }));

      logger.info('Leaderboard fetched', { count: leaderboard.length, limit, players: leaderboard.map((p: any) => ({ username: p.username, wins: p.gamesWon })) });
      return leaderboard;
    } catch (error: any) {
      logger.error('Failed to get leaderboard', { 
        error: error?.message || error,
        code: error?.code,
        stack: error?.stack
      });
      return [];
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

