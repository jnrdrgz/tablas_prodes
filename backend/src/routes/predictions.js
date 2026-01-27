const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { parseWhatsappPredictions } = require('../utils/whatsappParser');

const router = express.Router();
const prisma = new PrismaClient();

// Bulk upload predictions from WhatsApp format
router.post('/bulk', async (req, res) => {
  const { gameweekId, whatsappText } = req.body;
  console.log(`[PREDICTIONS] Bulk uploading predictions for gameweek ${gameweekId}`);

  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parseInt(gameweekId) },
      include: {
        matches: { orderBy: { id: 'asc' } },
        tournament: true
      }
    });

    if (!gameweek) {
      return res.status(404).json({ error: 'Gameweek not found' });
    }

    // Save raw WhatsApp input for audit/backup
    const savedInput = await prisma.whatsappInput.create({
      data: {
        tournamentId: gameweek.tournamentId,
        gameweekId: parseInt(gameweekId),
        rawText: whatsappText
      }
    });
    console.log(`[PREDICTIONS] Saved raw WhatsApp input ${savedInput.id} for tournament ${gameweek.tournamentId}`);

    // Get all mappings
    const mappings = await prisma.mapping.findMany();
    const mappingDict = {};
    for (const m of mappings) {
      mappingDict[m.key] = m.value;
    }

    // Parse WhatsApp text
    const parsed = parseWhatsappPredictions(whatsappText, mappingDict);
    console.log(`[PREDICTIONS] Parsed ${parsed.length} prediction sets`);

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const predictionSet of parsed) {
      const predictor = predictionSet.predictor;
      const results = predictionSet.results;

      for (let i = 0; i < Math.min(results.length, gameweek.matches.length); i++) {
        const match = gameweek.matches[i];
        const result = results[i];

        // Use upsert to update or create prediction
        const existing = await prisma.prediction.findUnique({
          where: {
            matchId_predictor: {
              matchId: match.id,
              predictor
            }
          }
        });

        if (existing) {
          await prisma.prediction.update({
            where: { id: existing.id },
            data: { result }
          });
          totalUpdated++;
        } else {
          await prisma.prediction.create({
            data: {
              matchId: match.id,
              predictor,
              result
            }
          });
          totalCreated++;
        }
      }
      console.log(`[PREDICTIONS] Saved predictions for ${predictor}: ${results.length} matches`);
    }

    console.log(`[PREDICTIONS] Created ${totalCreated}, updated ${totalUpdated} predictions`);
    res.status(201).json({
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      predictors: parsed.map(p => p.predictor),
      inputSavedId: savedInput.id
    });
  } catch (error) {
    console.error('[PREDICTIONS] Error bulk uploading predictions:', error);
    res.status(500).json({ error: 'Failed to upload predictions' });
  }
});

// Create or update single prediction
router.post('/', async (req, res) => {
  const { matchId, predictor, result } = req.body;
  console.log(`[PREDICTIONS] Creating prediction for match ${matchId} by ${predictor}: ${result}`);

  try {
    const existing = await prisma.prediction.findUnique({
      where: {
        matchId_predictor: {
          matchId: parseInt(matchId),
          predictor
        }
      }
    });

    let prediction;
    if (existing) {
      prediction = await prisma.prediction.update({
        where: { id: existing.id },
        data: { result }
      });
      console.log(`[PREDICTIONS] Updated prediction ${prediction.id}`);
    } else {
      prediction = await prisma.prediction.create({
        data: {
          matchId: parseInt(matchId),
          predictor,
          result
        }
      });
      console.log(`[PREDICTIONS] Created prediction ${prediction.id}`);
    }

    res.status(201).json(prediction);
  } catch (error) {
    console.error('[PREDICTIONS] Error creating prediction:', error);
    res.status(500).json({ error: 'Failed to create prediction' });
  }
});

// Delete prediction
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[PREDICTIONS] Deleting prediction ${id}`);
  try {
    await prisma.prediction.delete({ where: { id: parseInt(id) } });
    console.log(`[PREDICTIONS] Deleted prediction ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[PREDICTIONS] Error deleting prediction:', error);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

// Delete all predictions for a gameweek
router.delete('/gameweek/:gameweekId', async (req, res) => {
  const { gameweekId } = req.params;
  console.log(`[PREDICTIONS] Deleting all predictions for gameweek ${gameweekId}`);

  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parseInt(gameweekId) },
      include: { matches: { select: { id: true } } }
    });

    if (!gameweek) {
      return res.status(404).json({ error: 'Gameweek not found' });
    }

    const matchIds = gameweek.matches.map(m => m.id);

    const result = await prisma.prediction.deleteMany({
      where: { matchId: { in: matchIds } }
    });

    console.log(`[PREDICTIONS] Deleted ${result.count} predictions for gameweek ${gameweekId}`);
    res.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('[PREDICTIONS] Error deleting predictions:', error);
    res.status(500).json({ error: 'Failed to delete predictions' });
  }
});

module.exports = router;
