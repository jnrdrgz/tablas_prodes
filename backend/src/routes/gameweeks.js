const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { calculateGameweekPoints, calculateTournamentPointsUntilGameweek } = require('../utils/points');

const router = express.Router();
const prisma = new PrismaClient();

// Get gameweek with matches and predictions
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[GAMEWEEKS] Fetching gameweek ${id}`);
  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parseInt(id) },
      include: {
        tournament: {
          include: {
            subscribedTo: true
          }
        },
        matches: {
          orderBy: { id: 'asc' },
          include: {
            predictions: true
          }
        }
      }
    });
    if (!gameweek) {
      console.log(`[GAMEWEEKS] Gameweek ${id} not found`);
      return res.status(404).json({ error: 'Gameweek not found' });
    }
    console.log(`[GAMEWEEKS] Found gameweek: ${gameweek.description} with ${gameweek.matches.length} matches`);
    res.json(gameweek);
  } catch (error) {
    console.error('[GAMEWEEKS] Error fetching gameweek:', error);
    res.status(500).json({ error: 'Failed to fetch gameweek' });
  }
});

// Get gameweek points (calculated on the fly)
router.get('/:id/points', async (req, res) => {
  const { id } = req.params;
  console.log(`[GAMEWEEKS] Calculating points for gameweek ${id}`);
  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parseInt(id) },
      include: {
        tournament: true,
        matches: {
          orderBy: { id: 'asc' },
          include: { predictions: true }
        }
      }
    });

    if (!gameweek) {
      return res.status(404).json({ error: 'Gameweek not found' });
    }

    const gameweekPoints = calculateGameweekPoints(gameweek.matches);
    console.log(`[GAMEWEEKS] Calculated gameweek points for ${Object.keys(gameweekPoints).length} predictors`);

    const tournamentPoints = await calculateTournamentPointsUntilGameweek(
      prisma,
      gameweek.tournamentId,
      parseInt(id)
    );
    console.log(`[GAMEWEEKS] Calculated tournament points for ${Object.keys(tournamentPoints).length} predictors`);

    res.json({ gameweekPoints, tournamentPoints });
  } catch (error) {
    console.error('[GAMEWEEKS] Error calculating points:', error);
    res.status(500).json({ error: 'Failed to calculate points' });
  }
});

// Create gameweek
router.post('/', async (req, res) => {
  const { description, tournamentId } = req.body;
  console.log(`[GAMEWEEKS] Creating gameweek for tournament ${tournamentId}: ${description}`);
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(tournamentId) },
      include: { subscribers: true }
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Don't allow creating gameweeks on subscribed tournaments
    if (tournament.subscribedToId) {
      console.log(`[GAMEWEEKS] Cannot create gameweek on subscribed tournament ${tournamentId}`);
      return res.status(400).json({ error: 'Cannot create gameweek on subscribed tournament' });
    }

    const gameweek = await prisma.gameweek.create({
      data: {
        description,
        tournamentId: parseInt(tournamentId)
      }
    });
    console.log(`[GAMEWEEKS] Created gameweek ${gameweek.id}`);

    // Create same gameweek on all subscriber tournaments
    if (tournament.subscribers.length > 0) {
      console.log(`[GAMEWEEKS] Creating gameweeks on ${tournament.subscribers.length} subscriber tournaments`);
      for (const subscriber of tournament.subscribers) {
        await prisma.gameweek.create({
          data: {
            description,
            tournamentId: subscriber.id
          }
        });
        console.log(`[GAMEWEEKS] Created gameweek on subscriber tournament ${subscriber.id}`);
      }
    }

    res.status(201).json(gameweek);
  } catch (error) {
    console.error('[GAMEWEEKS] Error creating gameweek:', error);
    res.status(500).json({ error: 'Failed to create gameweek' });
  }
});

// Update gameweek
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  console.log(`[GAMEWEEKS] Updating gameweek ${id}`);
  try {
    const gameweek = await prisma.gameweek.update({
      where: { id: parseInt(id) },
      data: { description }
    });
    console.log(`[GAMEWEEKS] Updated gameweek ${id}`);
    res.json(gameweek);
  } catch (error) {
    console.error('[GAMEWEEKS] Error updating gameweek:', error);
    res.status(500).json({ error: 'Failed to update gameweek' });
  }
});

// Delete gameweek
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[GAMEWEEKS] Deleting gameweek ${id}`);
  try {
    await prisma.gameweek.delete({ where: { id: parseInt(id) } });
    console.log(`[GAMEWEEKS] Deleted gameweek ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[GAMEWEEKS] Error deleting gameweek:', error);
    res.status(500).json({ error: 'Failed to delete gameweek' });
  }
});

module.exports = router;
