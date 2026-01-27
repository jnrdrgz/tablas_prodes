const express = require('express');
const { parseWhatsappPredictions } = require('../utils/whatsappParser');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Debug endpoint to test WhatsApp parsing without saving
router.post('/parse-preview', async (req, res) => {
  const { whatsappText } = req.body;
  console.log('[DEBUG] Testing WhatsApp parser');
  console.log('[DEBUG] Input text:', whatsappText);

  try {
    // Get all mappings
    const mappings = await prisma.mapping.findMany();
    const mappingDict = {};
    for (const m of mappings) {
      mappingDict[m.key] = m.value;
    }
    console.log('[DEBUG] Loaded mappings:', Object.keys(mappingDict).length);

    // Parse without saving
    const parsed = parseWhatsappPredictions(whatsappText, mappingDict);

    console.log('[DEBUG] Parse result:');
    parsed.forEach(p => {
      console.log(`[DEBUG]   ${p.predictor}: ${p.results.join(', ')}`);
    });

    res.json({
      success: true,
      parsed,
      mappingsUsed: Object.keys(mappingDict).length
    });
  } catch (error) {
    console.error('[DEBUG] Parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
