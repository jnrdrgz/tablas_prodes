const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { calculateGameweekPoints } = require('../utils/points');

const router = express.Router();
const prisma = new PrismaClient();

// Get general table (points across all tournaments)
router.get('/', async (req, res) => {
  console.log('[GENERAL TABLE] Calculating general table across all tournaments');
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        gameweeks: {
          include: {
            matches: {
              include: { predictions: true }
            }
          }
        }
      }
    });

    console.log(`[GENERAL TABLE] Found ${tournaments.length} tournaments`);

    const totalStats = {};

    for (const tournament of tournaments) {
      for (const gameweek of tournament.gameweeks) {
        const gwPoints = calculateGameweekPoints(gameweek.matches);

        for (const stats of gwPoints) {
          if (!totalStats[stats.predictor]) {
            totalStats[stats.predictor] = {
              predictor: stats.predictor,
              puntos: 0,
              plenos: 0,
              goles: 0,
              torneos: 0,
              fechas: 0
            };
          }

          totalStats[stats.predictor].puntos += stats.puntos;
          totalStats[stats.predictor].plenos += stats.plenos;
          totalStats[stats.predictor].goles += stats.goles;
        }
      }
    }

    // Count tournaments and gameweeks per predictor
    for (const tournament of tournaments) {
      const predictorsInTournament = new Set();
      for (const gameweek of tournament.gameweeks) {
        const predictorsInGameweek = new Set();
        for (const match of gameweek.matches) {
          for (const prediction of match.predictions) {
            predictorsInTournament.add(prediction.predictor);
            predictorsInGameweek.add(prediction.predictor);
          }
        }
        for (const predictor of predictorsInGameweek) {
          if (totalStats[predictor]) {
            totalStats[predictor].fechas += 1;
          }
        }
      }
      for (const predictor of predictorsInTournament) {
        if (totalStats[predictor]) {
          totalStats[predictor].torneos += 1;
        }
      }
    }

    const sorted = Object.values(totalStats).sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.plenos !== a.plenos) return b.plenos - a.plenos;
      return b.goles - a.goles;
    });

    console.log(`[GENERAL TABLE] Calculated general table for ${sorted.length} participants`);
    res.json(sorted);
  } catch (error) {
    console.error('[GENERAL TABLE] Error calculating general table:', error);
    res.status(500).json({ error: 'Failed to calculate general table' });
  }
});

module.exports = router;
