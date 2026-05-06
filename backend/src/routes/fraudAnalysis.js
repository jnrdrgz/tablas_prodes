const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/fraud-analysis/:tournamentId
// For each gameweek: compares every predictor's predictions against others.
// CopyScore = avg similarity with users who uploaded BEFORE you in the same gameweek.
// Only counts non-blank (not 9-9) shared predictions.
router.get('/:tournamentId', async (req, res) => {
  const tournamentId = parseInt(req.params.tournamentId);
  console.log(`[FRAUD] Starting analysis for tournament ${tournamentId}`);

  try {
    const gameweeks = await prisma.gameweek.findMany({
      where: { tournamentId },
      include: {
        matches: {
          include: { predictions: true },
          orderBy: { id: 'asc' }
        }
      },
      orderBy: { id: 'asc' }
    });

    if (!gameweeks.length) {
      return res.status(404).json({ error: 'Tournament not found or has no gameweeks' });
    }

    console.log(`[FRAUD] Found ${gameweeks.length} gameweeks`);

    // copierData[copier][source] = { totalSimilarity, laterCount, coParticipation }
    //   laterCount      = gameweeks where copier uploaded after source (with >=3 shared)
    //   coParticipation = gameweeks where both participated (with >=3 shared)
    //   totalSimilarity = sum of similarity for the laterCount gameweeks
    const copierData = {};
    // gwScores[predictor] = [copyScore per gameweek where not first uploader]
    const gwScores = {};

    const MIN_SHARED = 3; // minimum shared non-blank predictions to count a pair in a gameweek

    const gameweekResults = [];

    for (const gw of gameweeks) {
      const hasPredictions = gw.matches.some(m => m.predictions.length > 0);
      if (!hasPredictions) continue;

      // Build prediction map: predictorPredictions[predictor][matchId] = result
      const predictorPredictions = {};
      const predictorFirstSeen = {};

      for (const match of gw.matches) {
        for (const pred of match.predictions) {
          if (!predictorPredictions[pred.predictor]) {
            predictorPredictions[pred.predictor] = {};
          }
          predictorPredictions[pred.predictor][match.id] = pred.result;

          // Track earliest createdAt per predictor this gameweek
          const existing = predictorFirstSeen[pred.predictor];
          if (!existing || new Date(pred.createdAt) < new Date(existing)) {
            predictorFirstSeen[pred.predictor] = pred.createdAt;
          }
        }
      }

      // Sort predictors by who uploaded first
      const uploadOrder = Object.entries(predictorFirstSeen)
        .map(([predictor, uploadedAt]) => ({ predictor, uploadedAt }))
        .sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));

      const uploadRank = {};
      uploadOrder.forEach((u, i) => { uploadRank[u.predictor] = i; });

      const predictors = Object.keys(predictorPredictions);

      // Compute pairwise similarity for every pair
      // pair.aFirst = true means A uploaded before B
      const pairs = [];
      for (let i = 0; i < predictors.length; i++) {
        for (let j = i + 1; j < predictors.length; j++) {
          const a = predictors[i];
          const b = predictors[j];
          const predsA = predictorPredictions[a];
          const predsB = predictorPredictions[b];

          const sharedMatchIds = Object.keys(predsA).filter(
            mid => predsB[mid] !== undefined && predsA[mid] !== '9-9' && predsB[mid] !== '9-9'
          );

          // Skip pairs with too few shared predictions — not enough data
          if (sharedMatchIds.length < MIN_SHARED) continue;

          const identical = sharedMatchIds.filter(mid => predsA[mid] === predsB[mid]).length;
          const similarity = identical / sharedMatchIds.length;

          const aFirst = (uploadRank[a] ?? 0) < (uploadRank[b] ?? 0);

          pairs.push({
            a,
            b,
            identical,
            total: sharedMatchIds.length,
            similarity: parseFloat(similarity.toFixed(3)),
            aFirst // true = A uploaded first, B is the potential copier
          });

          // Track co-participation for both directions (needed for the >=half filter)
          const copier = aFirst ? b : a;
          const source = aFirst ? a : b;

          // Ensure both directions exist for coParticipation tracking
          for (const [cp, src] of [[a, b], [b, a]]) {
            if (!copierData[cp]) copierData[cp] = {};
            if (!copierData[cp][src]) copierData[cp][src] = { totalSimilarity: 0, laterCount: 0, coParticipation: 0 };
            copierData[cp][src].coParticipation += 1;
          }

          // Only accumulate similarity for the actual later uploader
          copierData[copier][source].totalSimilarity += similarity;
          copierData[copier][source].laterCount += 1;
        }
      }

      // Per-predictor copyScore for this gameweek:
      // Average similarity with all users who uploaded BEFORE this predictor
      const gwCopyScores = {};
      for (const predictor of predictors) {
        const myRank = uploadRank[predictor] ?? 0;
        if (myRank === 0) {
          // First uploader can't copy
          gwCopyScores[predictor] = null;
          continue;
        }

        const relevantPairs = pairs.filter(p => {
          if (p.aFirst && p.b === predictor) return true; // A first, this is B = copier
          if (!p.aFirst && p.a === predictor) return true; // B first, this is A = copier
          return false;
        });

        if (relevantPairs.length === 0) {
          gwCopyScores[predictor] = 0;
        } else {
          const avg = relevantPairs.reduce((sum, p) => sum + p.similarity, 0) / relevantPairs.length;
          gwCopyScores[predictor] = parseFloat(avg.toFixed(3));
        }

        // Accumulate for overall totalCopyScore
        if (!gwScores[predictor]) gwScores[predictor] = [];
        if (gwCopyScores[predictor] !== null) {
          gwScores[predictor].push(gwCopyScores[predictor]);
        }
      }

      gameweekResults.push({
        gameweekId: gw.id,
        description: gw.description,
        uploadOrder,
        pairs: pairs.sort((a, b) => b.similarity - a.similarity),
        copyScores: gwCopyScores
      });

      console.log(`[FRAUD] Gameweek ${gw.id}: ${pairs.length} pairs, ${predictors.length} predictors`);
    }

    // Build per-predictor summary
    const allPredictors = [...new Set(Object.keys(gwScores).concat(Object.keys(copierData)))];

    const predictorSummaries = allPredictors.map(predictor => {
      const scores = gwScores[predictor] || [];
      const totalCopyScore = scores.length > 0
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3))
        : 0;

      // How much they copy from each specific user
      // Only include sources where this predictor uploaded AFTER them in >= half of shared gameweeks
      const copyFrom = Object.entries(copierData[predictor] || {})
        .filter(([, data]) => {
          if (data.coParticipation === 0) return false;
          return data.laterCount >= data.coParticipation / 2;
        })
        .map(([source, data]) => ({
          source,
          avgSimilarity: data.laterCount > 0
            ? parseFloat((data.totalSimilarity / data.laterCount).toFixed(3))
            : 0,
          gameweeksLater: data.laterCount,
          gameweeksTotal: data.coParticipation
        }))
        .sort((a, b) => b.avgSimilarity - a.avgSimilarity);

      // Avg upload rank across gameweeks
      let rankSum = 0;
      let rankCount = 0;
      for (const gw of gameweekResults) {
        const rank = gw.uploadOrder.findIndex(u => u.predictor === predictor);
        if (rank !== -1) {
          rankSum += rank;
          rankCount++;
        }
      }
      const avgUploadRank = rankCount > 0 ? parseFloat((rankSum / rankCount).toFixed(2)) : 0;

      return {
        predictor,
        totalCopyScore,
        avgUploadRank,
        gameweeksParticipated: rankCount,
        copyFrom
      };
    }).sort((a, b) => b.totalCopyScore - a.totalCopyScore);

    console.log(`[FRAUD] Analysis done: ${predictorSummaries.length} predictors analyzed`);

    res.json({
      tournamentId,
      predictors: predictorSummaries,
      gameweeks: gameweekResults
    });
  } catch (error) {
    console.error('[FRAUD] Error running analysis:', error);
    res.status(500).json({ error: 'Failed to run fraud analysis' });
  }
});

module.exports = router;
