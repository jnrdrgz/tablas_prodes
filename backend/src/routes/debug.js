const express = require('express');
const { parseWhatsappPredictions, parseWhatsappWebPredictions } = require('../utils/whatsappParser');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

const PARSERS_BY_FORMAT = {
  whatsapp: parseWhatsappPredictions,
  wpweb: parseWhatsappWebPredictions
};

// Debug endpoint to test WhatsApp parsing without saving (format: "whatsapp" | "wpweb")
router.post('/parse-preview', async (req, res) => {
  const { whatsappText, format = 'whatsapp' } = req.body;
  console.log(`[DEBUG] Testing WhatsApp parser (format=${format})`);
  console.log('[DEBUG] Input text:', whatsappText);

  const parse = PARSERS_BY_FORMAT[format];
  if (!parse) {
    console.warn(`[DEBUG] Unknown parser format "${format}"`);
    return res.status(400).json({ error: `Formato desconocido: ${format}` });
  }

  try {
    // Get all mappings
    const mappings = await prisma.mapping.findMany();
    const mappingDict = {};
    for (const m of mappings) {
      mappingDict[m.key] = m.value;
    }
    console.log('[DEBUG] Loaded mappings:', Object.keys(mappingDict).length);

    // Parse without saving
    const { predictions: parsed, warnings } = parse(whatsappText, mappingDict);

    console.log('[DEBUG] Parse result:');
    parsed.forEach(p => {
      console.log(`[DEBUG]   ${p.predictor}: ${p.results.join(', ')}`);
    });
    warnings.forEach(w => console.log(`[DEBUG]   WARNING ${w.message}`));

    res.json({
      success: true,
      parsed,
      warnings,
      mappingsUsed: Object.keys(mappingDict).length
    });
  } catch (error) {
    console.error('[DEBUG] Parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
