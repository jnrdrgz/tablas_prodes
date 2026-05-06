const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { calculateTournamentPointsUntilGameweek } = require('../utils/points');

const router = express.Router();
const prisma = new PrismaClient();

// Get all tournaments
router.get('/', async (req, res) => {
  console.log('[TOURNAMENTS] Fetching all tournaments');
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        subscribedTo: true,
        _count: { select: { gameweeks: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`[TOURNAMENTS] Found ${tournaments.length} tournaments`);
    res.json(tournaments);
  } catch (error) {
    console.error('[TOURNAMENTS] Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// Get single tournament with gameweeks
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[TOURNAMENTS] Fetching tournament ${id}`);
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(id) },
      include: {
        subscribedTo: true,
        gameweeks: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: { select: { matches: true } }
          }
        }
      }
    });
    if (!tournament) {
      console.log(`[TOURNAMENTS] Tournament ${id} not found`);
      return res.status(404).json({ error: 'Tournament not found' });
    }
    console.log(`[TOURNAMENTS] Found tournament: ${tournament.description}`);
    res.json(tournament);
  } catch (error) {
    console.error('[TOURNAMENTS] Error fetching tournament:', error);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// Create tournament
router.post('/', async (req, res) => {
  const { description, subscribedToId, settings } = req.body;
  console.log(`[TOURNAMENTS] Creating tournament: ${description}`);
  try {
    const tournament = await prisma.tournament.create({
      data: {
        description,
        subscribedToId: subscribedToId ? parseInt(subscribedToId) : null,
        settings: settings || {}
      }
    });
    console.log(`[TOURNAMENTS] Created tournament ${tournament.id}: ${tournament.description}`);
    res.status(201).json(tournament);
  } catch (error) {
    console.error('[TOURNAMENTS] Error creating tournament:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// Update tournament
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { description, settings } = req.body;
  console.log(`[TOURNAMENTS] Updating tournament ${id}`);
  try {
    const tournament = await prisma.tournament.update({
      where: { id: parseInt(id) },
      data: { description, settings }
    });
    console.log(`[TOURNAMENTS] Updated tournament ${id}`);
    res.json(tournament);
  } catch (error) {
    console.error('[TOURNAMENTS] Error updating tournament:', error);
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// Get position evolution across gameweeks (omits gameweeks with <= 2 matches)
router.get('/:id/position-evolution', async (req, res) => {
  const { id } = req.params;
  console.log(`[TOURNAMENTS] Calculating position evolution for tournament ${id}`);
  try {
    const gameweeks = await prisma.gameweek.findMany({
      where: { tournamentId: parseInt(id) },
      include: { _count: { select: { matches: true } } },
      orderBy: { id: 'asc' }
    });

    const qualifying = gameweeks.filter(gw => gw._count.matches > 2);
    console.log(`[TOURNAMENTS] ${qualifying.length} qualifying gameweeks out of ${gameweeks.length}`);

    if (qualifying.length === 0) {
      return res.json({ gameweeks: [], evolution: [] });
    }

    const snapshots = [];
    for (const gw of qualifying) {
      const points = await calculateTournamentPointsUntilGameweek(prisma, parseInt(id), gw.id);
      snapshots.push(points);
    }

    const allPredictors = new Set();
    snapshots.forEach(s => s.forEach(p => allPredictors.add(p.predictor)));

    const evolution = Array.from(allPredictors).map(predictor => {
      const positions = snapshots.map(snapshot => {
        const idx = snapshot.findIndex(p => p.predictor === predictor);
        return idx === -1 ? null : idx + 1;
      });
      const finalPos = positions[positions.length - 1] ?? 999;
      return { predictor, positions, finalPos };
    });

    evolution.sort((a, b) => a.finalPos - b.finalPos);
    evolution.forEach(e => delete e.finalPos);

    console.log(`[TOURNAMENTS] Evolution built for ${evolution.length} predictors`);
    res.json({
      gameweeks: qualifying.map(gw => ({ id: gw.id, description: gw.description })),
      evolution
    });
  } catch (error) {
    console.error('[TOURNAMENTS] Error calculating position evolution:', error);
    res.status(500).json({ error: 'Failed to calculate position evolution' });
  }
});

// Delete tournament
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[TOURNAMENTS] Deleting tournament ${id}`);
  try {
    await prisma.tournament.delete({ where: { id: parseInt(id) } });
    console.log(`[TOURNAMENTS] Deleted tournament ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[TOURNAMENTS] Error deleting tournament:', error);
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});

module.exports = router;
