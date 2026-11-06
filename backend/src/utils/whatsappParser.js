/**
 * Parse WhatsApp predictions text
 *
 * Input format example:
 * [1/21, 21:39] PMolina: Aldosivi 1-1 Defensa
 * Banfield 0-2 Huracán
 * Unión 1-1 Platense
 * [1/21, 23:13] +54 9 381 574-8792: Aldosivi 1-0 Defensa
 * Banfield 0-0 Huracán
 * ...
 *
 * Returns { predictions, warnings }
 *   predictions: [{ predictor: string, results: string[] }]  results are like "1-1", "0-2"
 *   warnings: [{ predictor, position, score, message }]      double digit scores (probable typos)
 */

// One message: "] Nombre: contenido" up to the "[" that opens the next message.
// The name is anything after "]" that is not a colon or a bracket, so accented
// names (Soberón, Villafañe) and phone numbers work the same.
const MESSAGE_REGEX = /\]([^:\[]+):(.+?)\[/g;

// WhatsApp Web copy: every message starts on its own line with "[hora, fecha] Nombre: ..."
// e.g. "[15:19, 9/4/2026] Juan Rodríguez: Estudiantes RC 0-1 Sarmiento"
// The bracket must contain a d/m/y date so a "[" typed inside a message is never a header.
const WPWEB_HEADER_REGEX = /^\[[^\]]*\d+\/\d+\/\d+[^\]]*\]\s*([^:]+):(.*)$/;

// WhatsApp sometimes pastes invisible direction marks around names and phone numbers
const INVISIBLE_MARKS_REGEX = /[\u200e\u200f\u202a-\u202e]/g;

// A score is digits-dash-digits, tolerating spaces around the dash ("1 - 0")
const SCORE_REGEX = /(\d+)\s*-\s*(\d+)/g;

function parseWhatsappPredictions(text, mappings = {}) {
  console.log('[PARSER] Parsing WhatsApp predictions text');
  console.log('[PARSER] Input length:', text.length);

  // Collapse everything into a single line (\r included: "." never matches \r)
  let processedText = text.replace(/\r/g, '').replace(/\n/g, '');
  processedText += '['; // trailing bracket so the last message also closes

  const messages = [...processedText.matchAll(MESSAGE_REGEX)]
    .map(match => ({ name: match[1], content: match[2] }));
  console.log(`[PARSER] Found ${messages.length} messages`);

  return buildPredictions(messages, mappings);
}

/**
 * Parse text copied from WhatsApp Web, line by line.
 * A header line opens a new message; any other line belongs to the previous message.
 */
function parseWhatsappWebPredictions(text, mappings = {}) {
  console.log('[PARSER] Parsing WhatsApp Web predictions text');
  console.log('[PARSER] Input length:', text.length);

  const lines = text.replace(INVISIBLE_MARKS_REGEX, '').replace(/\r/g, '').split('\n');
  const messages = [];

  for (const line of lines) {
    const header = line.match(WPWEB_HEADER_REGEX);

    if (header) {
      messages.push({ name: header[1], content: header[2] });
    } else if (messages.length > 0) {
      messages[messages.length - 1].content += '\n' + line;
    } else if (line.trim()) {
      console.warn(`[PARSER] Ignoring line before the first message header: "${line}"`);
    }
  }

  console.log(`[PARSER] Found ${messages.length} messages`);

  return buildPredictions(messages, mappings, { onePerPredictor: true });
}

/**
 * Turn [{ name, content }] messages into predictions + warnings.
 * Names go through the mappings; messages without scores (chat) are skipped.
 * onePerPredictor: keep only each predictor's prode message (see keepLongestMessagePerPredictor).
 */
function buildPredictions(messages, mappings, { onePerPredictor = false } = {}) {
  let candidates = [];

  for (const message of messages) {
    let name = message.name.replace(/~/g, '').trim();

    console.log(`[PARSER] Raw name extracted: "${name}"`);

    if (mappings[name]) {
      console.log(`[PARSER] Mapping "${name}" -> "${mappings[name]}"`);
      name = mappings[name];
    }

    const { scores, suspicious } = extractScores(message.content);

    if (scores.length === 0) {
      console.log(`[PARSER] Skipping "${name}": message has no scores`);
      continue;
    }

    candidates.push({ name, scores, suspicious });
  }

  if (onePerPredictor) {
    candidates = keepLongestMessagePerPredictor(candidates);
  }

  const predictions = [];
  const warnings = [];

  for (const { name, scores, suspicious } of candidates) {
    console.log(`[PARSER] ${name}: ${scores.length} predictions -> ${scores.join(', ')}`);

    for (const s of suspicious) {
      const warningText = `${name}: resultado con doble digito "${s.score}" en el partido ${s.position}`;
      console.warn(`[PARSER] WARNING - ${warningText}`);
      warnings.push({ predictor: name, position: s.position, score: s.score, message: warningText });
    }

    predictions.push({ predictor: name, results: scores });
  }

  console.log(`[PARSER] Done: ${predictions.length} prediction sets, ${warnings.length} warnings`);

  return { predictions, warnings };
}

/**
 * A predictor can send chat with a score after the prode ("vamos 2-0"), which would
 * overwrite their first match. Keep only the message with the most scores per predictor;
 * on a tie the later one wins, so a full prode re-sent as a correction still replaces the first.
 */
function keepLongestMessagePerPredictor(candidates) {
  const bestByName = new Map();

  for (const candidate of candidates) {
    const best = bestByName.get(candidate.name);

    if (!best) {
      bestByName.set(candidate.name, candidate);
    } else if (candidate.scores.length >= best.scores.length) {
      console.log(`[PARSER] ${candidate.name}: later message with ${candidate.scores.length} scores replaces earlier one with ${best.scores.length}`);
      bestByName.set(candidate.name, candidate);
    } else {
      console.log(`[PARSER] ${candidate.name}: ignoring message with ${candidate.scores.length} scores (${candidate.scores.join(', ')}), keeping the one with ${best.scores.length}`);
    }
  }

  return [...bestByName.values()];
}

/**
 * Extract scores from a message body (content after "Nombre:")
 * Returns { scores: ["1-0", ...], suspicious: [{ position, score }] }
 * A score with more than one digit per side is almost always a typo (0-25 instead of 0-2),
 * so it is reported instead of being silently accepted.
 */
function extractScores(contentStr) {
  const scores = [];
  const suspicious = [];

  for (const match of contentStr.matchAll(SCORE_REGEX)) {
    const home = match[1];
    const away = match[2];
    const score = `${home}-${away}`;

    scores.push(score);

    if (home.length > 1 || away.length > 1) {
      suspicious.push({ position: scores.length, score });
    }
  }

  return { scores, suspicious };
}

/**
 * Parse simple match list
 * Input: "Team A - Team B\nTeam C - Team D"
 * Returns array of match descriptions
 */
function parseMatchList(text) {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => line.trim());
}

module.exports = {
  parseWhatsappPredictions,
  parseWhatsappWebPredictions,
  parseMatchList
};
