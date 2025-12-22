import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../config/logger';

export function createRoutes(databaseService: DatabaseService): Router {
  const router = Router();

  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

