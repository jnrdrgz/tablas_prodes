#!/usr/bin/env node
/**
 * Wipe all data from the database
 * Usage: node src/scripts/wipe-db.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function wipeDatabase() {
  console.log('[WIPE] Starting database wipe...');
  console.log('[WIPE] WARNING: This will delete ALL data!');

  try {
    // Delete in order to respect foreign key constraints
    console.log('[WIPE] Deleting predictions...');
    const predictions = await prisma.prediction.deleteMany();
    console.log(`[WIPE] Deleted ${predictions.count} predictions`);

    console.log('[WIPE] Deleting whatsapp inputs...');
    const whatsappInputs = await prisma.whatsappInput.deleteMany();
    console.log(`[WIPE] Deleted ${whatsappInputs.count} whatsapp inputs`);

    console.log('[WIPE] Deleting matches...');
    const matches = await prisma.match.deleteMany();
    console.log(`[WIPE] Deleted ${matches.count} matches`);

    console.log('[WIPE] Deleting gameweeks...');
    const gameweeks = await prisma.gameweek.deleteMany();
    console.log(`[WIPE] Deleted ${gameweeks.count} gameweeks`);

    console.log('[WIPE] Deleting tournaments...');
    const tournaments = await prisma.tournament.deleteMany();
    console.log(`[WIPE] Deleted ${tournaments.count} tournaments`);

    console.log('[WIPE] Deleting mappings...');
    const mappings = await prisma.mapping.deleteMany();
    console.log(`[WIPE] Deleted ${mappings.count} mappings`);

    console.log('[WIPE] Database wiped successfully!');
  } catch (error) {
    console.error('[WIPE] Error wiping database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  wipeDatabase();
}

module.exports = { wipeDatabase };
