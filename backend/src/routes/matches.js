const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Create match
router.post('/', async (req, res) => {
  const { gameweekId, description } = req.body;
  console.log(`[MATCHES] Creating match for gameweek ${gameweekId}: ${description}`);
  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parseInt(gameweekId) },
      include: {
        tournament: {
          include: { subscribers: true }
        }
      }
    });

    if (!gameweek) {
      return res.status(404).json({ error: 'Gameweek not found' });
    }

    // Don't allow creating matches on subscribed tournaments
    if (gameweek.tournament.subscribedToId) {
      console.log(`[MATCHES] Cannot create match on subscribed tournament`);
      return res.status(400).json({ error: 'Cannot create match on subscribed tournament' });
    }

    const match = await prisma.match.create({
      data: {
        gameweekId: parseInt(gameweekId),
        description
      }
    });
    console.log(`[MATCHES] Created match ${match.id}`);

    // Create same match on subscriber tournaments' corresponding gameweeks
    for (const subscriber of gameweek.tournament.subscribers) {
      const subscriberGameweek = await prisma.gameweek.findFirst({
        where: {
          tournamentId: subscriber.id,
          description: gameweek.description
        }
      });
      if (subscriberGameweek) {
        await prisma.match.create({
          data: {
            gameweekId: subscriberGameweek.id,
            description
          }
        });
        console.log(`[MATCHES] Created match on subscriber gameweek ${subscriberGameweek.id}`);
      }
    }

    res.status(201).json(match);
  } catch (error) {
    console.error('[MATCHES] Error creating match:', error);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Bulk create matches (from text input)
router.post('/bulk', async (req, res) => {
  const { gameweekId, matchesText } = req.body;
  console.log(`[MATCHES] Bulk creating matches for gameweek ${gameweekId}`);
  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parseInt(gameweekId) },
      include: {
        tournament: {
          include: { subscribers: true }
        }
      }
    });

    if (!gameweek) {
      return res.status(404).json({ error: 'Gameweek not found' });
    }

    if (gameweek.tournament.subscribedToId) {
      console.log(`[MATCHES] Cannot create matches on subscribed tournament`);
      return res.status(400).json({ error: 'Cannot create matches on subscribed tournament' });
    }

    // Parse matches text - each line is a match like "Team A - Team B"
    const lines = matchesText.split('\n').filter(line => line.trim());
    const createdMatches = [];

    for (const line of lines) {
      const description = line.trim();
      if (description) {
        const match = await prisma.match.create({
          data: {
            gameweekId: parseInt(gameweekId),
            description
          }
        });
        createdMatches.push(match);
        console.log(`[MATCHES] Created match: ${description}`);

        // Create same match on subscriber tournaments
        for (const subscriber of gameweek.tournament.subscribers) {
          const subscriberGameweek = await prisma.gameweek.findFirst({
            where: {
              tournamentId: subscriber.id,
              description: gameweek.description
            }
          });
          if (subscriberGameweek) {
            await prisma.match.create({
              data: {
                gameweekId: subscriberGameweek.id,
                description
              }
            });
          }
        }
      }
    }

    console.log(`[MATCHES] Created ${createdMatches.length} matches in bulk`);
    res.status(201).json(createdMatches);
  } catch (error) {
    console.error('[MATCHES] Error bulk creating matches:', error);
    res.status(500).json({ error: 'Failed to create matches' });
  }
});

// Update match result
router.put('/:id/result', async (req, res) => {
  const { id } = req.params;
  const { result } = req.body;
  console.log(`[MATCHES] Updating result for match ${id}: ${result}`);
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(id) },
      include: {
        gameweek: {
          include: {
            tournament: {
              include: { subscribers: true }
            }
          }
        }
      }
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.gameweek.tournament.subscribedToId) {
      console.log(`[MATCHES] Cannot update match result on subscribed tournament`);
      return res.status(400).json({ error: 'Cannot update match result on subscribed tournament' });
    }

    const updatedMatch = await prisma.match.update({
      where: { id: parseInt(id) },
      data: { result }
    });

    // Update same match result on subscriber tournaments
    for (const subscriber of match.gameweek.tournament.subscribers) {
      const subscriberGameweek = await prisma.gameweek.findFirst({
        where: {
          tournamentId: subscriber.id,
          description: match.gameweek.description
        }
      });
      if (subscriberGameweek) {
        const subscriberMatch = await prisma.match.findFirst({
          where: {
            gameweekId: subscriberGameweek.id,
            description: match.description
          }
        });
        if (subscriberMatch) {
          await prisma.match.update({
            where: { id: subscriberMatch.id },
            data: { result }
          });
          console.log(`[MATCHES] Updated result on subscriber match ${subscriberMatch.id}`);
        }
      }
    }

    console.log(`[MATCHES] Updated match ${id} result to ${result}`);
    res.json(updatedMatch);
  } catch (error) {
    console.error('[MATCHES] Error updating match result:', error);
    res.status(500).json({ error: 'Failed to update match result' });
  }
});

// Bulk update match results
router.put('/bulk-results', async (req, res) => {
  const { gameweekId, resultsText } = req.body;
  console.log(`[MATCHES] Bulk updating results for gameweek ${gameweekId}`);
  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parseInt(gameweekId) },
      include: {
        matches: { orderBy: { id: 'asc' } },
        tournament: {
          include: { subscribers: true }
        }
      }
    });

    if (!gameweek) {
      return res.status(404).json({ error: 'Gameweek not found' });
    }

    if (gameweek.tournament.subscribedToId) {
      return res.status(400).json({ error: 'Cannot update results on subscribed tournament' });
    }

    // Parse results - extract score from each line
    const lines = resultsText.split('\n').filter(line => line.trim());
    const resultPattern = /(\d+)\s*[-:]\s*(\d+)/;

    const updates = [];
    for (let i = 0; i < Math.min(lines.length, gameweek.matches.length); i++) {
      const match = resultPattern.exec(lines[i]);
      if (match) {
        const result = `${match[1]}-${match[2]}`;
        updates.push({
          matchId: gameweek.matches[i].id,
          result
        });
      }
    }

    for (const update of updates) {
      await prisma.match.update({
        where: { id: update.matchId },
        data: { result: update.result }
      });
      console.log(`[MATCHES] Updated match ${update.matchId} result to ${update.result}`);
    }

    // Update subscriber tournaments
    for (const subscriber of gameweek.tournament.subscribers) {
      const subscriberGameweek = await prisma.gameweek.findFirst({
        where: {
          tournamentId: subscriber.id,
          description: gameweek.description
        },
        include: { matches: { orderBy: { id: 'asc' } } }
      });
      if (subscriberGameweek) {
        for (let i = 0; i < Math.min(updates.length, subscriberGameweek.matches.length); i++) {
          await prisma.match.update({
            where: { id: subscriberGameweek.matches[i].id },
            data: { result: updates[i].result }
          });
        }
      }
    }

    console.log(`[MATCHES] Updated ${updates.length} match results`);
    res.json({ updated: updates.length });
  } catch (error) {
    console.error('[MATCHES] Error bulk updating results:', error);
    res.status(500).json({ error: 'Failed to update results' });
  }
});

// Delete match
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[MATCHES] Deleting match ${id}`);
  try {
    await prisma.match.delete({ where: { id: parseInt(id) } });
    console.log(`[MATCHES] Deleted match ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[MATCHES] Error deleting match:', error);
    res.status(500).json({ error: 'Failed to delete match' });
  }
});

module.exports = router;
