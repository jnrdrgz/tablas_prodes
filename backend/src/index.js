require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const tournamentsRouter = require('./routes/tournaments');
const gameweeksRouter = require('./routes/gameweeks');
const matchesRouter = require('./routes/matches');
const predictionsRouter = require('./routes/predictions');
const mappingsRouter = require('./routes/mappings');
const debugRouter = require('./routes/debug');
const whatsappInputsRouter = require('./routes/whatsappInputs');

app.use('/api/tournaments', tournamentsRouter);
app.use('/api/gameweeks', gameweeksRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/mappings', mappingsRouter);
app.use('/api/debug', debugRouter);
app.use('/api/whatsapp-inputs', whatsappInputsRouter);

app.get('/api/health', (req, res) => {
  console.log('[HEALTH] Health check requested');
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[SERVER] Tablador backend running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
