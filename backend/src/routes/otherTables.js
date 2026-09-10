const express = require('express');
const { PrismaClient } = require('@prisma/client');
const {
  calculateTableWithoutPlenos,
  buildTimelines,
  calculatePlenoStreaks,
  calculateHitStreaks,
  calculateBestGameweekPerPredictor,
  calculateBestPredictorPerTeam
} = require('../utils/otherTables');

const router = express.Router();
const prisma = new PrismaClient();

// Extra tables for the admin "Otras Tablas" page (calculated on the fly).
// sinPlenos only counts active tournaments, like the Tabla General; the rest are historic (archived included).
router.get('/', async (req, res) => {
  console.log('[OTHER TABLES] Calculating other tables');
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { id: 'asc' },
      include: {
        gameweeks: {
          orderBy: { id: 'asc' },
          include: {
            matches: {
              orderBy: { id: 'asc' },
              include: { predictions: true }
            }
          }
        }
      }
    });

    const activeTournaments = tournaments.filter(t => !t.archived);
    console.log(`[OTHER TABLES] Loaded ${tournaments.length} tournaments (${activeTournaments.length} active)`);

    const timelines = buildTimelines(tournaments);

    res.json({
      sinPlenos: calculateTableWithoutPlenos(activeTournaments),
      plenosSeguidos: calculatePlenoStreaks(timelines),
      simplesSeguidos: calculateHitStreaks(timelines),
      puntosEnUnaFecha: calculateBestGameweekPerPredictor(tournaments),
      puntosPorEquipo: calculateBestPredictorPerTeam(tournaments)
    });
    console.log('[OTHER TABLES] Done');
  } catch (error) {
    console.error('[OTHER TABLES] Error calculating other tables:', error);
    res.status(500).json({ error: 'Failed to calculate other tables' });
  }
});

module.exports = router;
