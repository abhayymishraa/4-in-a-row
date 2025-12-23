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
  private _isInitialized: boolean = false;

  constructor() {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT || '5432');
    const dbName = process.env.DB_NAME || 'emittr_game';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Determine SSL configuration
    // Most cloud databases require SSL in production
    let sslConfig: any = false;
    if (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'required') {
      sslConfig = { rejectUnauthorized: false };
    } else if (process.env.DB_SSL === 'false') {
      sslConfig = false;
    } else {
      // Auto-detect: enable SSL for production or known cloud providers
      const cloudHosts = ['supabase.co', 'railway.app', 'render.com', 'fly.dev', 'aws', 'azure', 'gcp', 'cloud'];
      const isCloudHost = cloudHosts.some(host => dbHost.includes(host)) || isProduction;
      sslConfig = isCloudHost ? { rejectUnauthorized: false } : false;
    }
    
    logger.info('Initializing database connection pool', {
      host: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      hasPassword: !!dbPassword,
      ssl: sslConfig ? 'enabled' : 'disabled',
      isProduction
    });

    this.pool = new Pool({
      host: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      password: dbPassword,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      ssl: sslConfig,
      // Note: The 'family' property is not part of the official PoolConfig type for 'pg'
      // and may cause type errors with strict TypeScript settings.
      // If you experience type errors, consider removing or properly extending the type.
      // family: 4, // Uncomment if you specifically need to force IPv4 and are handling types
    });
    
    this.pool.on('error', (err: any) => {
      logger.error('Unexpected error on idle database client', { 
        error: err.message,
        code: err.code,
        stack: err.stack
      });
    });

    this.pool.on('connect', () => {
      logger.debug('New database client connected');
    });
  }

  async initialize(): Promise<void> {
    if (this._isInitialized) {
      logger.debug('Database already initialized, skipping.');
      return;
    }
    try {
      // Test connection with retry logic for network issues
      let connectionTestPassed = false;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await this.pool.query('SELECT 1');
          connectionTestPassed = true;
          break;
        } catch (error: any) {
          if (attempt === maxRetries) {
            throw error;
          }
          logger.warn(`Database connection test attempt ${attempt}/${maxRetries} failed, retrying...`, {
            error: error?.message,
            code: error?.code
          });
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }
      
      if (!connectionTestPassed) {
        throw new Error('Database connection test failed after retries');
      }
      logger.info('Database connection test successful', { 
        host: process.env.DB_HOST,
        database: process.env.DB_NAME 
      });

      logger.info('📋 Loading and executing database schema...');
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, '../models/schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      logger.debug('Executing schema SQL...');
      await this.pool.query(schema);
      logger.info('✅ Database schema executed successfully');
      
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
      
      this._isInitialized = true;
      logger.info('✅✅✅ Database FULLY initialized and ready for operations ✅✅✅', {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        initialized: true
      });
    } catch (error: any) {
      this._isInitialized = false;
      logger.error('❌❌❌ Database initialization FAILED ❌❌❌', { 
        error: error?.message || error,
        code: (error as any)?.code,
        host: process.env.DB_HOST || 'NOT SET',
        database: process.env.DB_NAME || 'NOT SET',
        user: process.env.DB_USER || 'NOT SET',
        port: process.env.DB_PORT || 'NOT SET',
        hasPassword: !!process.env.DB_PASSWORD,
        stack: error?.stack
      });
      logger.error('⚠️  All database operations (savePlayer, saveGame, getLeaderboard) will be DISABLED');
      throw error;
    }
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }

  async savePlayer(playerId: string, username: string): Promise<string> {
    if (!this._isInitialized) {
      logger.warn('⚠️  SKIPPING savePlayer - Database not initialized', { 
        playerId, 
        username,
        host: process.env.DB_HOST || 'NOT SET',
        database: process.env.DB_NAME || 'NOT SET'
      });
      return playerId;
    }

    logger.debug('💾 Attempting to save player to database', { playerId, username });

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
      
      logger.info('✅ Player saved to database successfully', { playerId: savedId, username });
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
    if (!this._isInitialized) {
      logger.warn('⚠️  SKIPPING saveGame - Database not initialized', { 
        gameId: game.id,
        host: process.env.DB_HOST || 'NOT SET',
        database: process.env.DB_NAME || 'NOT SET',
        status: game.getStatus(),
        player1: game.player1.username,
        player2: game.player2.username,
        winner: game.getWinner()?.username || 'none'
      });
      return;
    }

    // Verify connection is still alive before attempting save
    try {
      await this.pool.query('SELECT 1');
    } catch (error: any) {
      logger.error('Database connection lost, cannot save game', {
        error: error?.message,
        code: error?.code,
        gameId: game.id
      });
      return;
    }

    logger.debug('💾 Attempting to save game to database', { 
      gameId: game.id,
      status: game.getStatus(),
      player1: game.player1.username,
      player2: game.player2.username
    });

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
      logger.info('✅ Game saved to database successfully', { 
        gameId: game.id, 
        winnerId: finalWinnerId, 
        winner: winner?.username || null,
        player1Id: dbPlayer1Id,
        player2Id: dbPlayer2Id,
        status: game.getStatus()
      });
    } catch (error: any) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error('❌ Failed to save game to database', { 
        error: error?.message || error,
        code: error?.code,
        gameId: game.id,
        status: game.getStatus(),
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        stack: error?.stack
      });
      
      // Check if it's a connection error and log helpful message
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        logger.error('Database connection error - check DB_HOST, DB_PORT, and network connectivity');
      } else if (error.code === '28P01') {
        logger.error('Database authentication failed - check DB_USER and DB_PASSWORD');
      } else if (error.code === '3D000') {
        logger.error('Database does not exist - check DB_NAME');
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
    if (!this._isInitialized) {
      logger.warn('Database not initialized, returning empty leaderboard', {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME
      });
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

