import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../config/logger';

export function createRoutes(databaseService: DatabaseService): Router {
  const router = Router();

  router.get('/health', async (_req: Request, res: Response) => {
    const dbInitialized = databaseService.isInitialized();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: {
        initialized: dbInitialized,
        host: process.env.DB_HOST || 'NOT SET',
        database: process.env.DB_NAME || 'NOT SET',
        user: process.env.DB_USER || 'NOT SET',
        port: process.env.DB_PORT || 'NOT SET',
        hasPassword: !!process.env.DB_PASSWORD
      }
    });
  });

  router.get('/db-test', async (_req: Request, res: Response) => {
    try {
      const dbInitialized = databaseService.isInitialized();
      if (!dbInitialized) {
        res.status(503).json({ 
          error: 'Database not initialized',
          message: 'Check server logs for database initialization errors',
          env: {
            hasHost: !!process.env.DB_HOST,
            hasName: !!process.env.DB_NAME,
            hasUser: !!process.env.DB_USER,
            hasPassword: !!process.env.DB_PASSWORD
          }
        });
        return;
      }

      const leaderboard = await databaseService.getLeaderboard(5);
      res.json({ 
        status: 'ok',
        message: 'Database is working',
        leaderboardCount: leaderboard.length,
        sample: leaderboard
      });
    } catch (error: any) {
      logger.error('Database test failed', { error: error?.message });
      res.status(500).json({ 
        error: 'Database test failed',
        message: error?.message 
      });
    }
  });

  router.get('/leaderboard', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await databaseService.getLeaderboard(limit);
      logger.debug('Leaderboard API called', { limit, resultCount: leaderboard.length });
      res.json({ leaderboard });
    } catch (error) {
      logger.error('Error fetching leaderboard', { error });
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  router.get('/player/:id/stats', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const stats = await databaseService.getPlayerStats(id);
      
      if (!stats) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      res.json({ stats });
    } catch (error) {
      logger.error('Error fetching player stats', { error });
      res.status(500).json({ error: 'Failed to fetch player stats' });
    }
  });

  return router;
}

