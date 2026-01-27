const express = require('express');
const { PrismaClient } = require('@prisma/client');

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
