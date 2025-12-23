import { useState, useEffect, useCallback } from 'react';
import { GameEngine, GameStatus } from '../core/GameEngine';
import { Board } from '../core/Board';

export function useGameEngine(gameData: any) {
  const [engine, setEngine] = useState<GameEngine>(new GameEngine());

  useEffect(() => {
    if (gameData && gameData.board) {
      const board = new Board(gameData.board);
      const currentPlayerNumber = gameData.currentPlayer?.id === gameData.player1?.id ? 1 : 2;
      const newEngine = new GameEngine(board, currentPlayerNumber);
      setEngine(newEngine);
    }
  }, [gameData]);

  const validateMove = useCallback((column: number): boolean => {
    return engine.validateMove(column);
  }, [engine]);

  const getGameStatus = useCallback((): GameStatus => {
    return engine.getGameStatus();
  }, [engine]);

  const isPlayerTurn = useCallback((playerId: string, currentPlayerId: string): boolean => {
    return playerId === currentPlayerId;
  }, []);

  return {
    engine,
    validateMove,
    getGameStatus,
    isPlayerTurn,
    board: engine.getBoard()
  };
}

