import React from 'react';

interface LeaderboardProps {
  leaderboard: Array<{
    id: string;
    username: string;
    gamesWon: number;
    rank: number;
  }>;
  onRefresh?: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ leaderboard, onRefresh }) => {
  return (
    <div className="bg-white p-5 rounded-lg border border-gray-300 shadow-sm h-fit sticky top-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Leaderboard</h2>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Refresh leaderboard"
            >
              ↻
            </button>
          )}
          <div className="text-xs text-gray-500">Auto-updates</div>
        </div>
      </div>
      {leaderboard.length === 0 ? (
        <div className="text-gray-500 py-4 text-center">No players yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50">
                <th className="text-left p-3 font-semibold text-gray-700">Rank</th>
                <th className="text-left p-3 font-semibold text-gray-700">Player</th>
                <th className="text-right p-3 font-semibold text-gray-700">Wins</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr 
                  key={entry.id} 
                  className={`border-b border-gray-200 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } hover:bg-blue-50`}
                >
                  <td className="p-3 text-gray-700 font-medium">{entry.rank}</td>
                  <td className="p-3 text-gray-800 font-medium">{entry.username}</td>
                  <td className="p-3 text-right text-gray-700 font-semibold">{entry.gamesWon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
