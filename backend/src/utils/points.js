/**
 * Points calculation utilities
 *
 * Scoring:
 * - Exact result match: 3 points (pleno)
 * - Correct winner/draw: 1 point
 * - Wrong: 0 points
 * - "9-9" means blank/skipped prediction
 *
 * Sorting: points > plenos > goles (total goals in predictions)
 */

/**
 * Compare prediction vs real result
 * Returns: { points: number, status: 'exact' | 'winner' | 'wrong' | 'skip' }
 */
function compareResult(prediction, realResult) {
  // Skip if either is blank (9-9)
  if (!prediction || !realResult || prediction === '9-9' || realResult === '9-9') {
    return { points: 0, status: 'skip' };
  }

  const [predHome, predAway] = prediction.split('-').map(Number);
  const [realHome, realAway] = realResult.split('-').map(Number);

  // Exact match
  if (predHome === realHome && predAway === realAway) {
    return { points: 3, status: 'exact', goles: predHome + predAway };
  }

  // Check winner/draw
  const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
  const realWinner = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

  if (predWinner === realWinner) {
    return { points: 1, status: 'winner', goles: 0 };
  }

  return { points: 0, status: 'wrong', goles: 0 };
}

/**
 * Calculate points for a gameweek
 * Returns object keyed by predictor name with their stats
 */
function calculateGameweekPoints(matches) {
  const predictorStats = {};

  for (const match of matches) {
    const realResult = match.result;

    for (const prediction of match.predictions) {
      const predictor = prediction.predictor;

      if (!predictorStats[predictor]) {
        predictorStats[predictor] = {
          predictor,
          puntos: 0,
          plenos: 0,
          goles: 0
        };
      }

      const comparison = compareResult(prediction.result, realResult);
      predictorStats[predictor].puntos += comparison.points;

      if (comparison.status === 'exact') {
        predictorStats[predictor].plenos += 1;
        predictorStats[predictor].goles += comparison.goles || 0;
      }
    }
  }

  // Convert to sorted array
  const sorted = Object.values(predictorStats).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.plenos !== a.plenos) return b.plenos - a.plenos;
    return b.goles - a.goles;
  });

  return sorted;
}

/**
 * Calculate tournament points up to (and including) a specific gameweek
 * Important: Only counts gameweeks created before or at the specified gameweek
 */
async function calculateTournamentPointsUntilGameweek(prisma, tournamentId, gameweekId) {
  console.log(`[POINTS] Calculating tournament ${tournamentId} points until gameweek ${gameweekId}`);

  // Get the target gameweek to find its creation date
  const targetGameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId }
  });

  if (!targetGameweek) {
    return [];
  }

  // Get all gameweeks up to and including this one (by creation order/id)
  const gameweeks = await prisma.gameweek.findMany({
    where: {
      tournamentId,
      id: { lte: gameweekId }
    },
    include: {
      matches: {
        include: { predictions: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`[POINTS] Found ${gameweeks.length} gameweeks to calculate`);

  // Aggregate points across all gameweeks
  const totalStats = {};

  for (const gameweek of gameweeks) {
    const gwPoints = calculateGameweekPoints(gameweek.matches);

    for (const stats of gwPoints) {
      if (!totalStats[stats.predictor]) {
        totalStats[stats.predictor] = {
          predictor: stats.predictor,
          puntos: 0,
          plenos: 0,
          goles: 0
        };
      }

      totalStats[stats.predictor].puntos += stats.puntos;
      totalStats[stats.predictor].plenos += stats.plenos;
      totalStats[stats.predictor].goles += stats.goles;
    }
  }

  // Sort
  const sorted = Object.values(totalStats).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.plenos !== a.plenos) return b.plenos - a.plenos;
    return b.goles - a.goles;
  });

  console.log(`[POINTS] Calculated total points for ${sorted.length} predictors`);
  return sorted;
}

module.exports = {
  compareResult,
  calculateGameweekPoints,
  calculateTournamentPointsUntilGameweek
};
