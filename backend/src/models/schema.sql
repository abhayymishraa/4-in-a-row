CREATE TABLE IF NOT EXISTS players (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(255) PRIMARY KEY,
  player1_id VARCHAR(255) NOT NULL REFERENCES players(id),
  player2_id VARCHAR(255) NOT NULL REFERENCES players(id),
  winner_id VARCHAR(255) REFERENCES players(id),
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_moves (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id VARCHAR(255) NOT NULL REFERENCES players(id),
  column_number INTEGER NOT NULL,
  row_number INTEGER NOT NULL,
  move_number INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_player1 ON games(player1_id);
CREATE INDEX IF NOT EXISTS idx_games_player2 ON games(player2_id);
CREATE INDEX IF NOT EXISTS idx_games_winner ON games(winner_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id ON game_moves(game_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_player_id ON game_moves(player_id);

