/**
 * ESPN unofficial scoreboard client (no API key needed).
 * Only the Liga Profesional (arg.1) is used.
 *
 * Normalized event shape returned by fetchScoreboard():
 * {
 *   id, espnDate, kickoff (ISO),
 *   state: 'pre' | 'in' | 'post',
 *   statusName: 'STATUS_FIRST_HALF' | 'STATUS_HALFTIME' | 'STATUS_FULL_TIME' | ...,
 *   completed: boolean,
 *   clock: "67'" , shortDetail: "HT" / "FT" / "67'",
 *   home: { name, shortName, score }, away: { ... },
 *   details: [{ kind: 'goal' | 'red', side: 'home' | 'away', minute, player, penalty, ownGoal }]
 * }
 */

const ESPN_LEAGUE = 'arg.1';
const SCOREBOARD_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN_LEAGUE}/scoreboard`;
const REQUEST_TIMEOUT_MS = 10000;

// "2026-11-08" or Date -> "20261108"
function toEspnDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, '');
  }
  const d = new Date(value);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function isValidEspnDate(value) {
  return typeof value === 'string' && /^\d{8}$/.test(value);
}

function normalizeCompetitor(competitor) {
  return {
    teamId: competitor?.team?.id || null,
    name: competitor?.team?.displayName || competitor?.team?.name || '?',
    shortName: competitor?.team?.shortDisplayName || competitor?.team?.displayName || '?',
    score: competitor?.score !== undefined && competitor?.score !== '' ? Number(competitor.score) : null
  };
}

function normalizeDetails(details, homeTeamId) {
  if (!Array.isArray(details)) return [];
  return details
    .filter(d => d.scoringPlay || d.redCard)
    .map(d => ({
      kind: d.scoringPlay ? 'goal' : 'red',
      side: d?.team?.id === homeTeamId ? 'home' : 'away',
      minute: d?.clock?.displayValue || '',
      player: d?.athletesInvolved?.[0]?.shortName || d?.athletesInvolved?.[0]?.displayName || '',
      penalty: Boolean(d.penaltyKick),
      ownGoal: Boolean(d.ownGoal)
    }));
}

function normalizeEvent(event, espnDate) {
  const competition = event?.competitions?.[0] || {};
  const status = competition.status || event.status || {};
  const competitors = competition.competitors || [];
  const homeRaw = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const awayRaw = competitors.find(c => c.homeAway === 'away') || competitors[1];
  const home = normalizeCompetitor(homeRaw);
  const away = normalizeCompetitor(awayRaw);

  return {
    id: String(event.id),
    espnDate,
    kickoff: event.date || competition.date || null,
    state: status?.type?.state || 'pre',
    statusName: status?.type?.name || 'STATUS_UNKNOWN',
    completed: Boolean(status?.type?.completed),
    clock: status?.displayClock || '',
    shortDetail: status?.type?.shortDetail || '',
    home,
    away,
    details: normalizeDetails(competition.details, home.teamId)
  };
}

async function fetchScoreboard(espnDate) {
  if (!isValidEspnDate(espnDate)) {
    throw new Error(`Invalid ESPN date: ${espnDate}`);
  }
  const url = `${SCOREBOARD_URL}?dates=${espnDate}`;
  const startedAt = Date.now();
  console.log(`[ESPN] GET ${url}`);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'tablador-live/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`ESPN responded ${response.status} for ${espnDate}`);
  }

  const data = await response.json();
  const events = (data.events || []).map(e => normalizeEvent(e, espnDate));
  console.log(`[ESPN] ${espnDate}: ${events.length} events in ${Date.now() - startedAt}ms`);
  return events;
}

// Score to use for points: only once the match started and it has numbers
function scoreFromEvent(event) {
  if (!event) return null;
  const started = event.state === 'in' || (event.state === 'post' && event.completed);
  if (!started) return null;
  if (event.home.score === null || event.away.score === null) return null;
  if (Number.isNaN(event.home.score) || Number.isNaN(event.away.score)) return null;
  return `${event.home.score}-${event.away.score}`;
}

module.exports = {
  ESPN_LEAGUE,
  fetchScoreboard,
  toEspnDate,
  isValidEspnDate,
  scoreFromEvent
};
