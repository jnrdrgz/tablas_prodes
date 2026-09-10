const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { parseWhatsappPredictions, parseWhatsappWebPredictions } = require('../utils/whatsappParser');

const router = express.Router();
const prisma = new PrismaClient();

const PARSERS_BY_FORMAT = {
  whatsapp: parseWhatsappPredictions,
  wpweb: parseWhatsappWebPredictions
};

async function getPredictorsInGameweek(gameweek) {
  const rows = await prisma.prediction.findMany({
    where: { matchId: { in: gameweek.matches.map(m => m.id) } },
    distinct: ['predictor'],
    select: { predictor: true }
  });
  return new Set(rows.map(r => r.predictor));
}

// Predictors in the tournament table up to this gameweek (same as "Puntos Torneo")
// that have no prediction in this gameweek and are not in `uploadingPredictors`.
async function findMissingPredictors(gameweek, uploadingPredictors = []) {
  const tournamentPredictors = await prisma.prediction.findMany({
    where: { match: { gameweek: { tournamentId: gameweek.tournamentId, id: { lte: gameweek.id } } } },
    distinct: ['predictor'],
    select: { predictor: true }
  });

  const present = await getPredictorsInGameweek(gameweek);
  uploadingPredictors.forEach(p => present.add(p));

  const missingPredictors = tournamentPredictors
    .map(p => p.predictor)
    .filter(predictor => !present.has(predictor));

  console.log(`[PREDICTIONS] Missing predictors for gameweek ${gameweek.id}: ${tournamentPredictors.length} in tournament table, ${present.size} present, ${missingPredictors.length} missing`);

  return missingPredictors;
}

// Missing predictors (see findMissingPredictors) get a full row of 9-9 (not sent / anulled).
// Returns the list of predictor names that were filled.
async function fillMissingPredictorsWith99(gameweek) {
  const matchIds = gameweek.matches.map(m => m.id);
  if (matchIds.length === 0) {
    console.log(`[PREDICTIONS] Fill 9-9 skipped for gameweek ${gameweek.id}: no matches`);
    return [];
  }

  const missingPredictors = await findMissingPredictors(gameweek);

  if (missingPredictors.length === 0) return [];

  const rows = missingPredictors.flatMap(predictor =>
    matchIds.map(matchId => ({ matchId, predictor, result: '9-9' }))
  );
  const { count } = await prisma.prediction.createMany({ data: rows, skipDuplicates: true });

  missingPredictors.forEach(p => console.log(`[PREDICTIONS]   Filled ${p} with 9-9 on ${matchIds.length} matches`));
  console.log(`[PREDICTIONS] Created ${count} 9-9 predictions for gameweek ${gameweek.id}`);

  return missingPredictors;
}

// Bulk upload predictions from WhatsApp format (format: "whatsapp" | "wpweb")
// dryRun: parse and validate exactly like a real upload, but save nothing and return what would be loaded
router.post('/bulk', async (req, res) => {
  const { gameweekId, whatsappText, format = 'whatsapp', fillMissing = false, dryRun = false } = req.body;
  console.log(`[PREDICTIONS] Bulk uploading predictions for gameweek ${gameweekId} (format=${format}, fillMissing=${fillMissing}, dryRun=${dryRun})`);

  const parse = PARSERS_BY_FORMAT[format];
  if (!parse) {
    console.warn(`[PREDICTIONS] Upload rejected for gameweek ${gameweekId}: unknown format "${format}"`);
    return res.status(400).json({ error: `Formato desconocido: ${format}` });
  }

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

    // Get all mappings
    const mappings = await prisma.mapping.findMany();
    const mappingDict = {};
    for (const m of mappings) {
      mappingDict[m.key] = m.value;
    }

    // Parse WhatsApp text (nothing is saved until it parses clean)
    const { predictions: parsed, warnings } = parse(whatsappText, mappingDict);
    console.log(`[PREDICTIONS] Parsed ${parsed.length} prediction sets, ${warnings.length} warnings`);

    if (warnings.length > 0) {
      console.warn(`[PREDICTIONS] Upload rejected for gameweek ${gameweekId}: ${warnings.length} double digit scores`);
      warnings.forEach(w => console.warn(`[PREDICTIONS]   ${w.message}`));
      return res.status(400).json({
        error: 'No se cargo nada. Hay resultados con doble digito (probable error de tipeo). Corregilos en el texto y volve a subir:\n' +
          warnings.map(w => `- ${w.message}`).join('\n'),
        warnings
      });
    }

    if (dryRun) {
      const predictorsInGameweek = await getPredictorsInGameweek(gameweek);
      const filledWith99 = fillMissing && gameweek.matches.length > 0
        ? await findMissingPredictors(gameweek, parsed.map(p => p.predictor))
        : [];

      console.log(`[PREDICTIONS] Dry run for gameweek ${gameweekId}: ${parsed.length} prediction sets, ${filledWith99.length} would be filled with 9-9. Nothing saved`);
      return res.json({
        dryRun: true,
        predictions: parsed.map(p => ({ ...p, alreadyLoaded: predictorsInGameweek.has(p.predictor) })),
        filledWith99
      });
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

    const filledWith99 = fillMissing ? await fillMissingPredictorsWith99(gameweek) : [];

    res.status(201).json({
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      predictors: parsed.map(p => p.predictor),
      filledWith99,
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
