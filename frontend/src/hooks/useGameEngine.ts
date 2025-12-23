import { useMemo, useCallback } from 'react';
import { GameEngine } from '../core/GameEngine';
import { Board } from '../core/Board';

export function useGameEngine(gameData: any) {
  const engine = useMemo(() => {
    if (gameData && gameData.board) {
      const board = new Board(gameData.board);
      return new GameEngine(board);
    }
    return new GameEngine();
  }, [gameData]);

  const validateMove = useCallback((column: number): boolean => {
    return engine.validateMove(column);
  }, [engine]);

  return {
    validateMove
  };
}

