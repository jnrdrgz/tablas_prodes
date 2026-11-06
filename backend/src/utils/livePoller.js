/**
 * Live score poller: a plain setInterval inside the Express process (no Redis/BullMQ on purpose).
 *
 * Every tick (60s by default) it looks at matches linked to ESPN that still have no official result
 * and decides which ESPN scoreboard days need fetching:
 *   - a day with a linked match that is in play, or about to start (kickoff - 15 min) -> fetch every tick
 *   - a day with a linked match we have no data for yet (e.g. after a restart)  -> fetch at most every 10 min
 *   - everything else (finished, far in the future, or already has an official result) -> nothing
 *
 * Data lives only in memory. On restart it is refilled on the next tick.
 */
const { PrismaClient } = require('@prisma/client');
const { fetchScoreboard } = require('./espn');

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = parseInt(process.env.LIVE_POLL_INTERVAL_MS || '60000', 10);
const MISSING_RETRY_MS = 10 * 60 * 1000;
const PRE_KICKOFF_WINDOW_MS = 15 * 60 * 1000;
const GIVE_UP_NOT_STARTED_MS = 6 * 60 * 60 * 1000; // match never started 6h after kickoff (postponed, etc)
const CACHE_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;

const eventsById = new Map();       // eventId -> { ...event, fetchedAt }
const lastFetchByDate = new Map();  // 'YYYYMMDD' -> timestamp
let lastTickAt = null;
let lastFetchAt = null;
let lastError = null;
let tickRunning = false;
let intervalHandle = null;

function storeEvents(events) {
  const now = Date.now();
  for (const event of events) {
    eventsById.set(event.id, { ...event, fetchedAt: now });
  }
  lastFetchAt = new Date(now).toISOString();
}

function getEvent(eventId) {
  if (!eventId) return null;
  return eventsById.get(String(eventId)) || null;
}

function getStatus() {
  return { lastTickAt, lastFetchAt, lastError, cachedEvents: eventsById.size, pollIntervalMs: POLL_INTERVAL_MS };
}

function isEventDueForLivePolling(event, now) {
  if (event.state === 'post') return false;
  const kickoff = event.kickoff ? new Date(event.kickoff).getTime() : null;
  if (event.state === 'in') return true;
  // state 'pre'
  if (!kickoff) return false;
  if (kickoff - PRE_KICKOFF_WINDOW_MS > now) return false;
  return now - kickoff < GIVE_UP_NOT_STARTED_MS;
}

function evictOldEvents(now) {
  let evicted = 0;
  for (const [id, event] of eventsById) {
    if (now - event.fetchedAt > CACHE_MAX_AGE_MS) {
      eventsById.delete(id);
      evicted++;
    }
  }
  if (evicted > 0) console.log(`[LIVE] Evicted ${evicted} old events from cache`);
}

async function tick() {
  if (tickRunning) {
    console.log('[LIVE] Previous tick still running, skipping');
    return;
  }
  tickRunning = true;
  const now = Date.now();
  lastTickAt = new Date(now).toISOString();

  try {
    const pendingMatches = await prisma.match.findMany({
      where: { espnEventId: { not: null }, espnDate: { not: null }, result: null },
      select: { espnEventId: true, espnDate: true }
    });

    // group event ids by scoreboard date (subscriber copies share the same event id, Set dedupes them)
    const eventIdsByDate = new Map();
    for (const m of pendingMatches) {
      if (!eventIdsByDate.has(m.espnDate)) eventIdsByDate.set(m.espnDate, new Set());
      eventIdsByDate.get(m.espnDate).add(m.espnEventId);
    }

    const dueDates = [];
    for (const [date, eventIds] of eventIdsByDate) {
      const ids = [...eventIds];
      const needsLive = ids.some(id => {
        const event = eventsById.get(id);
        return event && isEventDueForLivePolling(event, now);
      });
      const hasMissing = ids.some(id => !eventsById.has(id));
      const lastFetch = lastFetchByDate.get(date) || 0;
      if (needsLive || (hasMissing && now - lastFetch >= MISSING_RETRY_MS)) {
        dueDates.push(date);
      }
    }

    if (dueDates.length === 0) {
      console.log(`[LIVE] Tick: ${pendingMatches.length} linked matches without result, nothing to fetch`);
    } else {
      console.log(`[LIVE] Tick: fetching ESPN days ${dueDates.join(', ')}`);
    }

    for (const date of dueDates) {
      try {
        const events = await fetchScoreboard(date);
        storeEvents(events);
        lastFetchByDate.set(date, Date.now());
        const inPlay = events.filter(e => e.state === 'in').length;
        console.log(`[LIVE] Stored ${events.length} events for ${date} (${inPlay} in play)`);
        lastError = null;
      } catch (error) {
        lastFetchByDate.set(date, Date.now());
        lastError = `${new Date().toISOString()} ${date}: ${error.message}`;
        console.error(`[LIVE] Error fetching ESPN day ${date}:`, error.message);
      }
    }

    evictOldEvents(now);
  } catch (error) {
    lastError = `${new Date().toISOString()} tick: ${error.message}`;
    console.error('[LIVE] Tick failed:', error);
  } finally {
    tickRunning = false;
  }
}

function startLivePoller() {
  if (process.env.LIVE_POLLER_ENABLED === 'false') {
    console.log('[LIVE] Poller disabled by LIVE_POLLER_ENABLED=false');
    return;
  }
  if (intervalHandle) return;
  console.log(`[LIVE] Starting poller, every ${POLL_INTERVAL_MS / 1000}s`);
  tick();
  intervalHandle = setInterval(tick, POLL_INTERVAL_MS);
}

function stopLivePoller() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[LIVE] Poller stopped');
  }
}

module.exports = { startLivePoller, stopLivePoller, storeEvents, getEvent, getStatus };
