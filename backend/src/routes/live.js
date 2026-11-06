// Public live endpoints: live scores (from the in-memory ESPN cache) + live points tables
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const {
  compareResult,
  calculateGameweekPoints,
  calculateTournamentPointsUntilGameweek
} = require('../utils/points');
const { scoreFromEvent } = require('../utils/espn');
const { getEvent, getStatus } = require('../utils/livePoller');

const router = express.Router();
const prisma = new PrismaClient();

const byPointsPlenosGoles = (a, b) =>
  (b.puntos - a.puntos) || (b.plenos - a.plenos) || (b.goles - a.goles);

/**
 * Official result always wins. Without it, a linked match uses ESPN's score (live or final).
 * displayStatus: 'result' (official) | 'live' | 'halftime' | 'espn_final' | 'scheduled' | 'nolink' | 'pending'
 */
function resolveMatch(match) {
  const event = match.espnEventId ? getEvent(match.espnEventId) : null;
  const officialResult = match.result || null;
  const espnScore = officialResult ? null : scoreFromEvent(event);
  const effectiveResult = officialResult || espnScore;

  let displayStatus;
  if (officialResult) displayStatus = 'result';
  else if (!match.espnEventId) displayStatus = 'nolink';
  else if (!event) displayStatus = 'pending';
  else if (event.statusName === 'STATUS_HALFTIME') displayStatus = 'halftime';
  else if (event.state === 'in') displayStatus = 'live';
  else if (event.state === 'post' && event.completed) displayStatus = 'espn_final';
  else displayStatus = 'scheduled';

  return {
    id: match.id,
    description: match.description,
    officialResult,
    effectiveResult,
    source: officialResult ? 'result' : espnScore ? 'espn' : null,
    displayStatus,
    espn: event
      ? {
          id: event.id,
          kickoff: event.kickoff,
          state: event.state,
          statusName: event.statusName,
          clock: event.clock,
          shortDetail: event.shortDetail,
          home: event.home,
          away: event.away,
          details: event.details
        }
      : null,
    predictions: match.predictions
      .map(p => ({
        predictor: p.predictor,
        result: p.result,
        status: compareResult(p.result, effectiveResult).status
      }))
      .sort((a, b) => a.predictor.localeCompare(b.predictor))
  };
}

async function buildLiveTournament(tournamentId) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, description: true, archived: true, subscribedToId: true }
  });
  if (!tournament) return null;

  // the "current" gameweek is the latest one created
  const gameweek = await prisma.gameweek.findFirst({
    where: { tournamentId },
    orderBy: { id: 'desc' },
    include: { matches: { orderBy: { id: 'asc' }, include: { predictions: true } } }
  });

  if (!gameweek) {
    return { tournament, gameweek: null, matches: [], standings: [] };
  }

  const matches = gameweek.matches.map(resolveMatch);

  const officialGameweek = calculateGameweekPoints(gameweek.matches);
  const liveGameweek = calculateGameweekPoints(
    gameweek.matches.map(m => ({ ...m, result: matches.find(r => r.id === m.id).effectiveResult }))
  );
  const officialTournament = await calculateTournamentPointsUntilGameweek(prisma, tournamentId, gameweek.id);

  const toMap = list => new Map(list.map(row => [row.predictor, row]));
  const officialGwMap = toMap(officialGameweek);
  const liveGwMap = toMap(liveGameweek);
  const officialTotalMap = toMap(officialTournament);
  const empty = { puntos: 0, plenos: 0, goles: 0 };

  const predictors = new Set([...officialTotalMap.keys(), ...liveGwMap.keys()]);
  const rows = [...predictors].map(predictor => {
    const gwOfficial = officialGwMap.get(predictor) || empty;
    const gwLive = liveGwMap.get(predictor) || empty;
    const totalOfficial = officialTotalMap.get(predictor) || empty;
    const provisional = gwLive.puntos - gwOfficial.puntos;
    return {
      predictor,
      gameweekPoints: gwLive.puntos,
      provisionalPoints: provisional,
      gameweekPlenos: gwLive.plenos,
      official: totalOfficial,
      // used for sorting the live table
      puntos: totalOfficial.puntos + provisional,
      plenos: totalOfficial.plenos + (gwLive.plenos - gwOfficial.plenos),
      goles: totalOfficial.goles + (gwLive.goles - gwOfficial.goles)
    };
  });

  const officialOrder = [...rows]
    .sort((a, b) => byPointsPlenosGoles(a.official, b.official))
    .map(r => r.predictor);
  rows.sort(byPointsPlenosGoles);

  const standings = rows.map((row, index) => ({
    position: index + 1,
    predictor: row.predictor,
    gameweekPoints: row.gameweekPoints,
    provisionalPoints: row.provisionalPoints,
    gameweekPlenos: row.gameweekPlenos,
    total: row.puntos,
    // positive = moved up because of ESPN (not yet official) scores
    positionChange: officialOrder.indexOf(row.predictor) - index
  }));

  return {
    tournament,
    gameweek: { id: gameweek.id, description: gameweek.description },
    matches,
    standings
  };
}

// GET /api/live/tournaments -> one summary per active (not archived) tournament
router.get('/tournaments', async (req, res) => {
  console.log('[LIVE-ROUTE] Fetching live summary for all active tournaments');
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { archived: false },
      select: { id: true },
      orderBy: { description: 'asc' }
    });

    const summaries = [];
    for (const t of tournaments) {
      const live = await buildLiveTournament(t.id);
      if (!live) continue;
      const inPlayCount = live.matches.filter(m => m.displayStatus === 'live' || m.displayStatus === 'halftime').length;
      const upcomingKickoffs = live.matches
        .filter(m => m.displayStatus === 'scheduled' && m.espn?.kickoff)
        .map(m => m.espn.kickoff)
        .sort();
      const leader = live.standings[0] || null;
      summaries.push({
        id: live.tournament.id,
        description: live.tournament.description,
        gameweek: live.gameweek,
        matchCount: live.matches.length,
        participantCount: live.standings.length,
        inPlayCount,
        nextKickoff: upcomingKickoffs[0] || null,
        leader: leader ? { predictor: leader.predictor, total: leader.total, provisionalPoints: leader.provisionalPoints } : null
      });
    }

    console.log(`[LIVE-ROUTE] Returning ${summaries.length} tournament summaries`);
    res.json({ tournaments: summaries, status: getStatus() });
  } catch (error) {
    console.error('[LIVE-ROUTE] Error building summaries:', error);
    res.status(500).json({ error: 'Error cargando datos en vivo' });
  }
});

// GET /api/live/tournaments/:id -> current gameweek with live scores and live tables
router.get('/tournaments/:id', async (req, res) => {
  const tournamentId = parseInt(req.params.id);
  console.log(`[LIVE-ROUTE] Fetching live data for tournament ${tournamentId}`);
  if (Number.isNaN(tournamentId)) {
    return res.status(400).json({ error: 'Id invalido' });
  }
  try {
    const live = await buildLiveTournament(tournamentId);
    if (!live) {
      return res.status(404).json({ error: 'Torneo no encontrado' });
    }
    console.log(`[LIVE-ROUTE] Tournament ${tournamentId}: ${live.matches.length} matches, ${live.standings.length} predictors`);
    res.json({ ...live, status: getStatus() });
  } catch (error) {
    console.error(`[LIVE-ROUTE] Error building tournament ${tournamentId}:`, error);
    res.status(500).json({ error: 'Error cargando datos en vivo' });
  }
});

module.exports = router;
