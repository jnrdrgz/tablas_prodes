const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get all mappings
router.get('/', async (req, res) => {
  console.log('[MAPPINGS] Fetching all mappings');
  try {
    const mappings = await prisma.mapping.findMany({
      orderBy: { value: 'asc' }
    });
    console.log(`[MAPPINGS] Found ${mappings.length} mappings`);
    res.json(mappings);
  } catch (error) {
    console.error('[MAPPINGS] Error fetching mappings:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Create or update mapping
router.post('/', async (req, res) => {
  const { key, value } = req.body;
  console.log(`[MAPPINGS] Creating/updating mapping: ${key} -> ${value}`);

  try {
    const existing = await prisma.mapping.findUnique({
      where: { key }
    });

    let mapping;
    let predictionsUpdated = 0;

    if (existing) {
      const oldValue = existing.value;
      mapping = await prisma.mapping.update({
        where: { id: existing.id },
        data: { value }
      });
      console.log(`[MAPPINGS] Updated mapping ${mapping.id}`);

      // Update existing predictions from old value to new value
      if (oldValue !== value) {
        const result = await prisma.prediction.updateMany({
          where: { predictor: oldValue },
          data: { predictor: value }
        });
        predictionsUpdated = result.count;
        console.log(`[MAPPINGS] Updated ${predictionsUpdated} predictions from "${oldValue}" to "${value}"`);
      }
    } else {
      mapping = await prisma.mapping.create({
        data: { key, value }
      });
      console.log(`[MAPPINGS] Created mapping ${mapping.id}`);

      // Update existing predictions from key (unmapped) to value (mapped)
      const result = await prisma.prediction.updateMany({
        where: { predictor: key },
        data: { predictor: value }
      });
      predictionsUpdated = result.count;
      console.log(`[MAPPINGS] Updated ${predictionsUpdated} predictions from "${key}" to "${value}"`);
    }

    res.status(201).json({ ...mapping, predictionsUpdated });
  } catch (error) {
    console.error('[MAPPINGS] Error creating mapping:', error);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
});

// Delete mapping
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[MAPPINGS] Deleting mapping ${id}`);
  try {
    await prisma.mapping.delete({ where: { id: parseInt(id) } });
    console.log(`[MAPPINGS] Deleted mapping ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[MAPPINGS] Error deleting mapping:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
});

module.exports = router;
