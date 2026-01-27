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
 * Returns array of { predictor: string, results: string[] }
 * where results are like "1-1", "0-2", etc.
 */
function parseWhatsappPredictions(text, mappings = {}) {
  console.log('[PARSER] Parsing WhatsApp predictions text');
  console.log('[PARSER] Input length:', text.length);

  // Remove all newlines to work with a single line (like old site does)
  let processedText = text.replace(/\n/g, '');
  processedText += '['; // Add trailing bracket for regex matching (like old site)

  // Extract names - everything between ] and :
  const namesRegex = /\].+?:/g;
  // Extract predictions - everything from 3 alphanumeric chars + : until next [
  // This captures "xxx: content here["
  const prodesRegex = /[a-zA-Z0-9][a-zA-Z0-9][a-zA-Z0-9]:.+?\[/g;

  const namesMatches = [...processedText.matchAll(namesRegex)];
  const prodesMatches = [...processedText.matchAll(prodesRegex)];

  console.log(`[PARSER] Found ${namesMatches.length} names, ${prodesMatches.length} prediction sets`);

  const results = [];

  for (let i = 0; i < namesMatches.length; i++) {
    // Clean name - remove ], :, ~, and trim
    let name = namesMatches[i][0]
      .replace(/]/g, '')
      .replace(/:/g, '')
      .replace(/~/g, '')
      .trim();

    console.log(`[PARSER] Raw name extracted: "${name}"`);

    // Apply mapping if exists
    if (mappings[name]) {
      console.log(`[PARSER] Mapping "${name}" -> "${mappings[name]}"`);
      name = mappings[name];
    }

    if (i < prodesMatches.length) {
      const prodeStr = prodesMatches[i][0];
      console.log(`[PARSER] Raw prode string: "${prodeStr.substring(0, 50)}..."`);

      // IMPORTANT: Extract only the content AFTER the colon
      // The prodeStr is like "792: Aldosivi 1-0 Defensa..." where 792 is part of phone
      // We need to skip everything before and including the first ":"
      const colonIndex = prodeStr.indexOf(':');
      const contentAfterColon = colonIndex >= 0 ? prodeStr.substring(colonIndex + 1) : prodeStr;

      console.log(`[PARSER] Content after colon: "${contentAfterColon.substring(0, 50)}..."`);

      // Extract scores from the content only (not from the name/number part)
      const scoreResults = extractScores(contentAfterColon);

      console.log(`[PARSER] ${name}: ${scoreResults.length} predictions -> ${scoreResults.join(', ')}`);

      results.push({
        predictor: name,
        results: scoreResults
      });
    }
  }

  return results;
}

/**
 * Extract scores from a prediction string (content after the name:)
 * Input should NOT include the name/number part
 * Handles formats like "Team1 1-0 Team2Team3 2-1 Team4["
 */
function extractScores(contentStr) {
  // Remove the trailing [
  const cleanStr = contentStr.replace(/\[$/g, '');

  // Extract all single digits (scores are typically 0-9)
  // This approach extracts digit by digit and pairs them
  const numbers = cleanStr.replace(/\D/g, '').split('');

  console.log(`[PARSER] Extracted digits: ${numbers.join(',')}`);

  const scores = [];
  for (let i = 0; i < numbers.length; i += 2) {
    if (numbers[i] !== undefined && numbers[i + 1] !== undefined) {
      scores.push(`${numbers[i]}-${numbers[i + 1]}`);
    }
  }

  return scores;
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
