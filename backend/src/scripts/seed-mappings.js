#!/usr/bin/env node
/**
 * Seed mappings from mappings.txt file
 * Format: key=value (one per line)
 * Usage: node src/scripts/seed-mappings.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedMappings() {
  const mappingsFile = path.join(__dirname, '../../../mappings.txt');

  console.log('[SEED] Reading mappings from:', mappingsFile);

  if (!fs.existsSync(mappingsFile)) {
    console.error('[SEED] mappings.txt not found at:', mappingsFile);
    process.exit(1);
  }

  const content = fs.readFileSync(mappingsFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && line.includes('='));

  console.log(`[SEED] Found ${lines.length} mappings to seed`);

  let created = 0;
  let updated = 0;

  for (const line of lines) {
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.substring(0, eqIndex).trim();
    const value = line.substring(eqIndex + 1).trim();

    if (!key || !value) continue;

    try {
      const existing = await prisma.mapping.findUnique({ where: { key } });

      if (existing) {
        if (existing.value !== value) {
          await prisma.mapping.update({
            where: { id: existing.id },
            data: { value }
          });
          console.log(`[SEED] Updated: "${key}" -> "${value}"`);
          updated++;
        }
      } else {
        await prisma.mapping.create({ data: { key, value } });
        console.log(`[SEED] Created: "${key}" -> "${value}"`);
        created++;
      }
    } catch (error) {
      console.error(`[SEED] Error processing "${key}":`, error.message);
    }
  }

  console.log(`[SEED] Done! Created: ${created}, Updated: ${updated}`);
}

seedMappings()
  .catch(error => {
    console.error('[SEED] Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
