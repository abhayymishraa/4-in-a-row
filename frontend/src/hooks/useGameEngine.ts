import { useState, useEffect, useCallback } from 'react';
import { GameEngine } from '../core/GameEngine';
import { Board } from '../core/Board';

export function useGameEngine(gameData: any) {
  const [engine, setEngine] = useState<GameEngine>(new GameEngine());

  useEffect(() => {
    if (gameData && gameData.board) {
      const board = new Board(gameData.board);
      const newEngine = new GameEngine(board);
      setEngine(newEngine);
    }
  }, [gameData]);

  const validateMove = useCallback((column: number): boolean => {
    return engine.validateMove(column);
  }, [engine]);

  return {
    validateMove
  };
}

