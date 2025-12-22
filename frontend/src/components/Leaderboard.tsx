import React from 'react';

interface LeaderboardProps {
  leaderboard: Array<{
    id: string;
    username: string;
    gamesWon: number;
    rank: number;
  }>;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ leaderboard }) => {
  return (
    <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
      <h2 style={{ marginBottom: '15px' }}>Leaderboard</h2>
      {leaderboard.length === 0 ? (
        <div style={{ color: '#666' }}>No players yet</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Rank</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Player</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Wins</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{entry.rank}</td>
                <td style={{ padding: '8px' }}>{entry.username}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{entry.gamesWon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Leaderboard;

