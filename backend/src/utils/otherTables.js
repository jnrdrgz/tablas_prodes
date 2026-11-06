/**
 * Extra tables for the admin "Otras Tablas" page.
 *
 * Every function receives tournaments loaded with gameweeks -> matches -> predictions,
 * gameweeks and matches ordered by id (id order = creation order = chronological order).
 */
const { compareResult, calculateGameweekPoints } = require('./points');

const isPleno = status => status === 'exact';
const isHit = status => status === 'exact' || status === 'winner';

function byNameAsc(a, b) {
  return a.predictor.localeCompare(b.predictor);
}

function gameweekLabel(tournament, gameweek) {
  return `${tournament.description} - ${gameweek.description}`;
}

/**
 * General table where a pleno is worth the same as any hit: 1 point per correct winner/draw.
 */
function calculateTableWithoutPlenos(tournaments) {
  const stats = {};

  for (const tournament of tournaments) {
    for (const gameweek of tournament.gameweeks) {
      for (const match of gameweek.matches) {
        for (const prediction of match.predictions) {
          if (!stats[prediction.predictor]) {
            stats[prediction.predictor] = { predictor: prediction.predictor, puntos: 0 };
          }

          const { status } = compareResult(prediction.result, match.result);
          if (isHit(status)) stats[prediction.predictor].puntos += 1;
        }
      }
    }
  }

  const sorted = Object.values(stats).sort((a, b) => b.puntos - a.puntos || byNameAsc(a, b));
  console.log(`[OTHER TABLES] Sin plenos: ${sorted.length} participants`);
  return sorted;
}

/**
 * For each predictor, the ordered results they got on every finished match of the tournaments
 * they played. A 9-9 or a missing prediction (prode not sent) comes out as status "skip".
 * Matches without a real result, or anulled (real result 9-9), are left out entirely.
 * Returns { predictor: [{ status, label }] }
 */
function buildTimelines(tournaments) {
  const playersByTournament = {};
  for (const tournament of tournaments) {
    const players = new Set();
    for (const gameweek of tournament.gameweeks) {
      for (const match of gameweek.matches) {
        for (const prediction of match.predictions) players.add(prediction.predictor);
      }
    }
    playersByTournament[tournament.id] = players;
  }

  const gameweeks = tournaments
    .flatMap(tournament => tournament.gameweeks.map(gameweek => ({ gameweek, tournament })))
    .sort((a, b) => a.gameweek.id - b.gameweek.id);

  const timelines = {};

  for (const { gameweek, tournament } of gameweeks) {
    const label = gameweekLabel(tournament, gameweek);

    for (const match of gameweek.matches) {
      if (!match.result || match.result === '9-9') continue;

      const predictionByPlayer = new Map(match.predictions.map(p => [p.predictor, p.result]));

      for (const player of playersByTournament[tournament.id]) {
        const { status } = compareResult(predictionByPlayer.get(player), match.result);
        if (!timelines[player]) timelines[player] = [];
        timelines[player].push({ status, label });
      }
    }
  }

  console.log(`[OTHER TABLES] Built match timelines for ${Object.keys(timelines).length} participants`);
  return timelines;
}

/**
 * Longest run of consecutive matches where isStreakHit(status) holds, per predictor.
 * Anything else (wrong, 9-9, prode not sent) breaks the run. Ties keep the earliest run.
 * Returns [{ predictor, racha, desde, hasta }] where desde/hasta are "Torneo - Fecha".
 */
function calculateLongestStreaks(timelines, isStreakHit) {
  const rows = [];

  for (const [predictor, timeline] of Object.entries(timelines)) {
    let best = null;
    let current = null;

    for (const event of timeline) {
      if (!isStreakHit(event.status)) {
        current = null;
        continue;
      }

      if (!current) current = { racha: 0, desde: event.label };
      current.racha += 1;
      current.hasta = event.label;

      if (!best || current.racha > best.racha) best = { ...current };
    }

    if (best) rows.push({ predictor, ...best });
  }

  return rows.sort((a, b) => b.racha - a.racha || byNameAsc(a, b));
}

function calculatePlenoStreaks(timelines) {
  const rows = calculateLongestStreaks(timelines, isPleno);
  console.log(`[OTHER TABLES] Plenos seguidos: ${rows.length} participants, best ${rows[0]?.racha ?? 0}`);
  return rows;
}

function calculateHitStreaks(timelines) {
  const rows = calculateLongestStreaks(timelines, isHit);
  console.log(`[OTHER TABLES] Simples seguidos: ${rows.length} participants, best ${rows[0]?.racha ?? 0}`);
  return rows;
}

/**
 * Each predictor's best single gameweek (most points, then most plenos; ties keep the earliest).
 */
function calculateBestGameweekPerPredictor(tournaments) {
  const best = {};

  for (const tournament of tournaments) {
    for (const gameweek of tournament.gameweeks) {
      for (const stats of calculateGameweekPoints(gameweek.matches)) {
        const current = best[stats.predictor];
        const isBetter = !current ||
          stats.puntos > current.puntos ||
          (stats.puntos === current.puntos && stats.plenos > current.plenos);

        if (isBetter) {
          best[stats.predictor] = {
            predictor: stats.predictor,
            puntos: stats.puntos,
            plenos: stats.plenos,
            fecha: gameweek.description,
            torneo: tournament.description
          };
        }
      }
    }
  }

  const sorted = Object.values(best)
    .sort((a, b) => b.puntos - a.puntos || b.plenos - a.plenos || byNameAsc(a, b));
  console.log(`[OTHER TABLES] Puntos en una fecha: ${sorted.length} participants`);
  return sorted;
}

// "Boca - River" -> ["Boca", "River"]; null when it can't be split into exactly two teams
function splitTeams(description) {
  const teams = description.split('-').map(s => s.trim()).filter(Boolean);
  return teams.length === 2 ? teams : null;
}

// Groups the same team written differently across fechas ("Vélez" / "velez")
function normalizeTeamText(team) {
  return team.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Teams written with different names across fechas. Only used by Puntos por Equipo for now
// (team names are not normalized in the database). Keys are normalized, values are the display name.
const TEAM_ALIASES = {
  'estudiantes lp': 'Estudiantes LP',
  'estudiantes': 'Estudiantes LP',
  'gimnasia lp': 'Gimnasia LP',
  'gimnasia': 'Gimnasia LP',
  'gimnasia (m)': 'Gimnasia (M)',
  'gimnasia mza': 'Gimnasia (M)',
  'gimnasia m': 'Gimnasia (M)'
};

// Canonical team name: the alias if there is one, otherwise the name as written
function canonicalTeam(team) {
  return TEAM_ALIASES[normalizeTeamText(team)] || team;
}

function teamKey(team) {
  return normalizeTeamText(canonicalTeam(team));
}

/**
 * Points each predictor made in the finished matches of each team.
 * Returns { [teamKey]: { equipo, pointsByPredictor } }
 */
function calculatePointsByTeam(tournaments) {
  const teams = {};
  const unsplittable = new Set();
  const aliased = new Set();

  for (const tournament of tournaments) {
    for (const gameweek of tournament.gameweeks) {
      for (const match of gameweek.matches) {
        if (!match.result) continue;

        const matchTeams = splitTeams(match.description);
        if (!matchTeams) {
          unsplittable.add(match.description);
          continue;
        }

        for (const team of matchTeams) {
          const equipo = canonicalTeam(team);
          if (equipo !== team) aliased.add(`${team} -> ${equipo}`);

          const key = teamKey(team);
          if (!teams[key]) teams[key] = { equipo, pointsByPredictor: {} };

          const pointsByPredictor = teams[key].pointsByPredictor;
          for (const prediction of match.predictions) {
            const { points } = compareResult(prediction.result, match.result);
            pointsByPredictor[prediction.predictor] = (pointsByPredictor[prediction.predictor] || 0) + points;
          }
        }
      }
    }
  }

  if (unsplittable.size > 0) {
    console.warn(`[OTHER TABLES] Puntos por equipo: skipped ${unsplittable.size} match descriptions without "Equipo - Equipo" format: ${[...unsplittable].join(' | ')}`);
  }
  if (aliased.size > 0) {
    console.log(`[OTHER TABLES] Puntos por equipo: merged team aliases: ${[...aliased].join(' | ')}`);
  }

  return teams;
}

// The predictors with the most points for a team (ties list all). puntos 0 = nobody scored yet.
function teamLeaders({ equipo, pointsByPredictor }) {
  const puntos = Math.max(0, ...Object.values(pointsByPredictor));
  const participantes = Object.keys(pointsByPredictor)
    .filter(predictor => pointsByPredictor[predictor] === puntos)
    .sort();
  return { equipo, participantes, puntos };
}

/**
 * For each team, the predictor who made the most points in the matches that team played.
 * Ties list every leader. Returns [{ equipo, participantes: [...], puntos }] sorted by team.
 */
function calculateBestPredictorPerTeam(tournaments) {
  const rows = Object.values(calculatePointsByTeam(tournaments))
    .map(teamLeaders)
    .filter(row => row.puntos > 0)
    .sort((a, b) => a.equipo.localeCompare(b.equipo));

  console.log(`[OTHER TABLES] Puntos por equipo: ${rows.length} teams`);
  return rows;
}

/**
 * For every gameweek (newest first), each match with what the best predictor(s) of each of its
 * two teams predicted. A leader without a prediction for that match comes out with result null.
 * Returns [{ id, label, matches: [{ id, description, result, equipos: [{ equipo, puntos, predicciones: [{ predictor, result }] }] }] }]
 */
function calculateTeamLeaderPredictionsByGameweek(tournaments) {
  const leadersByTeam = {};
  for (const [key, team] of Object.entries(calculatePointsByTeam(tournaments))) {
    leadersByTeam[key] = teamLeaders(team);
  }

  const gameweeks = tournaments
    .flatMap(tournament => tournament.gameweeks.map(gameweek => ({ gameweek, tournament })))
    .sort((a, b) => b.gameweek.id - a.gameweek.id)
    .map(({ gameweek, tournament }) => ({
      id: gameweek.id,
      label: gameweekLabel(tournament, gameweek),
      matches: gameweek.matches.map(match => {
        const predictionByPlayer = new Map(match.predictions.map(p => [p.predictor, p.result]));
        const matchTeams = splitTeams(match.description) || [];

        const equipos = matchTeams.map(team => {
          const leaders = leadersByTeam[teamKey(team)];
          const hasLeaders = leaders && leaders.puntos > 0;
          return {
            equipo: canonicalTeam(team),
            puntos: hasLeaders ? leaders.puntos : 0,
            predicciones: hasLeaders
              ? leaders.participantes.map(predictor => ({ predictor, result: predictionByPlayer.get(predictor) || null }))
              : []
          };
        });

        return { id: match.id, description: match.description, result: match.result, equipos };
      })
    }));

  console.log(`[OTHER TABLES] Puntos por equipo por fecha: ${gameweeks.length} gameweeks`);
  return gameweeks;
}

module.exports = {
  calculateTableWithoutPlenos,
  buildTimelines,
  calculatePlenoStreaks,
  calculateHitStreaks,
  calculateBestGameweekPerPredictor,
  calculateBestPredictorPerTeam,
  calculateTeamLeaderPredictionsByGameweek
};
