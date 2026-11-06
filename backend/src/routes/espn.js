// Admin endpoints to link our matches with ESPN events
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { fetchScoreboard, toEspnDate, isValidEspnDate } = require('../utils/espn');
const { storeEvents } = require('../utils/livePoller');

const router = express.Router();
const prisma = new PrismaClient();

const MAX_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/espn/scoreboard?from=2026-11-06&to=2026-11-09
// ESPN only accepts one day per request, so we loop day by day
router.get('/scoreboard', async (req, res) => {
  const { from, to } = req.query;
  console.log(`[ESPN-ROUTE] Scoreboard requested from=${from} to=${to}`);

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(from || '') || !datePattern.test(to || '')) {
    return res.status(400).json({ error: 'Fechas invalidas, usar formato YYYY-MM-DD' });
  }

  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) {
    return res.status(400).json({ error: 'Rango de fechas invalido' });
  }
  const dayCount = Math.round((toMs - fromMs) / DAY_MS) + 1;
  if (dayCount > MAX_DAYS) {
    return res.status(400).json({ error: `Maximo ${MAX_DAYS} dias por busqueda` });
  }

  const eventsById = new Map();
  const errors = [];
  for (let i = 0; i < dayCount; i++) {
    const espnDate = toEspnDate(new Date(fromMs + i * DAY_MS));
    try {
      const events = await fetchScoreboard(espnDate);
      storeEvents(events);
      for (const event of events) {
        // the same event can show up on two days; keep the first day it appeared on
        if (!eventsById.has(event.id)) eventsById.set(event.id, event);
      }
    } catch (error) {
      console.error(`[ESPN-ROUTE] Error fetching ${espnDate}:`, error.message);
      errors.push(`${espnDate}: ${error.message}`);
    }
  }

  const events = [...eventsById.values()].sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || ''));
  console.log(`[ESPN-ROUTE] Returning ${events.length} events (${errors.length} day errors)`);
  res.json({ events, errors });
});

// PUT /api/espn/gameweek/:id/links  body: { links: [{ matchId, espnEventId, espnDate }] }
// espnEventId/espnDate null = unlink. Copies the link to subscriber tournaments, like results.
router.put('/gameweek/:id/links', async (req, res) => {
  const gameweekId = parseInt(req.params.id);
  const { links } = req.body;
  console.log(`[ESPN-ROUTE] Saving ${Array.isArray(links) ? links.length : 0} links for gameweek ${gameweekId}`);

  if (!Array.isArray(links)) {
    return res.status(400).json({ error: 'links debe ser una lista' });
  }

  for (const link of links) {
    const hasEvent = link.espnEventId !== null && link.espnEventId !== undefined && link.espnEventId !== '';
    if (hasEvent && (!/^\d+$/.test(String(link.espnEventId)) || !isValidEspnDate(link.espnDate))) {
      return res.status(400).json({ error: `Vinculo invalido para partido ${link.matchId}` });
    }
  }

  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: gameweekId },
      include: { matches: true, tournament: { include: { subscribers: true } } }
    });

    if (!gameweek) {
      return res.status(404).json({ error: 'Gameweek not found' });
    }
    if (gameweek.tournament.subscribedToId) {
      console.log(`[ESPN-ROUTE] Rejected: gameweek ${gameweekId} belongs to a subscribed tournament`);
      return res.status(400).json({ error: 'Vincular en el torneo principal, se copia a los suscritos' });
    }

    const matchesById = new Map(gameweek.matches.map(m => [m.id, m]));
    for (const link of links) {
      if (!matchesById.has(parseInt(link.matchId))) {
        return res.status(400).json({ error: `El partido ${link.matchId} no es de esta fecha` });
      }
    }

    const subscriberGameweeks = await prisma.gameweek.findMany({
      where: {
        tournamentId: { in: gameweek.tournament.subscribers.map(s => s.id) },
        description: gameweek.description
      },
      include: { matches: true }
    });

    let updatedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const link of links) {
        const match = matchesById.get(parseInt(link.matchId));
        const hasEvent = link.espnEventId !== null && link.espnEventId !== undefined && link.espnEventId !== '';
        const data = {
          espnEventId: hasEvent ? String(link.espnEventId) : null,
          espnDate: hasEvent ? link.espnDate : null
        };

        await tx.match.update({ where: { id: match.id }, data });
        updatedCount++;
        console.log(`[ESPN-ROUTE] Match ${match.id} "${match.description}" -> ${data.espnEventId || 'sin vincular'}`);

        for (const subGameweek of subscriberGameweeks) {
          const subMatch = subGameweek.matches.find(m => m.description === match.description);
          if (subMatch) {
            await tx.match.update({ where: { id: subMatch.id }, data });
            updatedCount++;
            console.log(`[ESPN-ROUTE] Copied link to subscriber match ${subMatch.id} (gameweek ${subGameweek.id})`);
          } else {
            console.warn(`[ESPN-ROUTE] Subscriber gameweek ${subGameweek.id} has no match "${match.description}"`);
          }
        }
      }
    });

    console.log(`[ESPN-ROUTE] Saved links: ${updatedCount} match rows updated`);
    res.json({ updated: updatedCount });
  } catch (error) {
    console.error('[ESPN-ROUTE] Error saving links:', error);
    res.status(500).json({ error: 'Error guardando vinculos' });
  }
});

module.exports = router;
