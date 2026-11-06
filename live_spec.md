# Live section (En Vivo) — agreed spec, implemented 2026-11-06 (pending manual testing)

Design mockup: `mockups/live.html` (approved as reference, 14 players / 15 matches).
Original request: `t.txt`.

## Public site (frontend-public)
- `/en-vivo`: one button per category (Serie A–D, Temporada 16) with live badge / next kickoff and current leader.
- `/en-vivo/:tournamentId`:
  - Live match cards (score, minute/ET/FINAL, goals, red cards, "Aciertan n/14" with names).
    Order: in play → finished → scheduled → not linked ("sin datos en vivo").
  - Live points table: gameweek points (in-play matches counted as if they ended now, shown as `(+n)`),
    plenos, season total, ▲▼ position change caused by in-play matches.
  - Full-width predictions grid (sticky player column, red top line on in-play columns, green exact / yellow winner).
  - Mobile: tabs Partidos / Tabla.

## ESPN data
- Source: `https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard?dates=YYYYMMDD` (one day per request).
- Only league needed: `arg.1` (Liga Profesional).
- Poll every **60 seconds**, server side, with a plain `setInterval` inside the Express backend process
  (no BullMQ/Redis — decided to keep the VPS light; this is a deliberate exception to stack.md).
  Each tick: if there are linked matches today that aren't finished, fetch the ESPN scoreboard for those days; otherwise do nothing.
  Cache result in memory (lost on restart, refilled on next tick); the public site never calls ESPN directly.

## Linking ESPN ↔ our matches (admin, frontend)
- New nullable `Match.espnEventId`.
- Screen inside a gameweek: pick date range → fetch ESPN matches → auto-suggest by team-name similarity → manual dropdown to fix / "no vincular".
- **All Series A–D predict the same matches.** Subscriber tournaments hold *copies* of the parent's matches
  (separate rows, matched by gameweek description + match description, see `backend/src/routes/matches.js`).
  So: link on the parent tournament only and propagate `espnEventId` to the subscriber copies the same way matches are propagated.

## Results
- **Final score is NOT saved automatically.**
- Points use ESPN's score (live or final) for a linked match **until the admin sets `Match.result`**; once `result` is set, it always wins over ESPN.
- Unlinked matches only count once `result` is set manually.

## Scoring
- Same as `backend/src/utils/points.js`: 3 exact, 1 winner, `9-9` = blank. Calculated on the fly, nothing stored.
