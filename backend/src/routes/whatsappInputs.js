const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get all whatsapp inputs
router.get('/', async (req, res) => {
  console.log('[WHATSAPP_INPUTS] Fetching all inputs');
  try {
    const inputs = await prisma.whatsappInput.findMany({
      include: {
        tournament: { select: { description: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`[WHATSAPP_INPUTS] Found ${inputs.length} inputs`);
    res.json(inputs);
  } catch (error) {
    console.error('[WHATSAPP_INPUTS] Error fetching inputs:', error);
    res.status(500).json({ error: 'Failed to fetch inputs' });
  }
});

// Get single input
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[WHATSAPP_INPUTS] Fetching input ${id}`);
  try {
    const input = await prisma.whatsappInput.findUnique({
      where: { id: parseInt(id) },
      include: {
        tournament: { select: { description: true } }
      }
    });
    if (!input) {
      return res.status(404).json({ error: 'Input not found' });
    }
    res.json(input);
  } catch (error) {
    console.error('[WHATSAPP_INPUTS] Error fetching input:', error);
    res.status(500).json({ error: 'Failed to fetch input' });
  }
});

// Delete input
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[WHATSAPP_INPUTS] Deleting input ${id}`);
  try {
    await prisma.whatsappInput.delete({ where: { id: parseInt(id) } });
    console.log(`[WHATSAPP_INPUTS] Deleted input ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[WHATSAPP_INPUTS] Error deleting input:', error);
    res.status(500).json({ error: 'Failed to delete input' });
  }
});

module.exports = router;
