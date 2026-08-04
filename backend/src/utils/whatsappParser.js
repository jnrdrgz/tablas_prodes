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

// A score is digits-dash-digits, tolerating spaces around the dash ("1 - 0")
const SCORE_REGEX = /(\d+)\s*-\s*(\d+)/g;

function parseWhatsappPredictions(text, mappings = {}) {
  console.log('[PARSER] Parsing WhatsApp predictions text');
  console.log('[PARSER] Input length:', text.length);

  // Collapse everything into a single line (\r included: "." never matches \r)
  let processedText = text.replace(/\r/g, '').replace(/\n/g, '');
  processedText += '['; // trailing bracket so the last message also closes

  const messages = [...processedText.matchAll(MESSAGE_REGEX)];
  console.log(`[PARSER] Found ${messages.length} messages`);

  const predictions = [];
  const warnings = [];

  for (const message of messages) {
    let name = message[1].replace(/~/g, '').trim();
    const content = message[2];

    console.log(`[PARSER] Raw name extracted: "${name}"`);

    if (mappings[name]) {
      console.log(`[PARSER] Mapping "${name}" -> "${mappings[name]}"`);
      name = mappings[name];
    }

    const { scores, suspicious } = extractScores(content);

    if (scores.length === 0) {
      console.log(`[PARSER] Skipping "${name}": message has no scores`);
      continue;
    }

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
  parseMatchList
};
