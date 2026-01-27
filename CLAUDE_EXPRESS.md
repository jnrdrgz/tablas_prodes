# Express.js Development Guidelines

## Express Philosophy

Express.js is used for lightweight API backends paired with React frontends. Keep it simple, fast, and maintainable with clear separation of concerns.

## Project Setup

**Versions from our templates:**
- Node.js: `^22.17`
- Package Manager: `pnpm`
- Use JavaScript
- PostgreSQL as the default database unless SQLite it's explcit asked con stack.md file

**Development Tools (from template):**
- Prettier: `3.6.2`
- `eslint-config-prettier` - Prettier integration
- `globals` - Global variables for ESLint

**Setup Pattern:**
```bash
# Install dependencies
pnpm install

# Run scripts
pnpm format      # Check formatting
pnpm format:fix  # Auto-format
pnpm lint        # Check linting
pnpm lint:fix    # Auto-fix linting
pnpm validate    # Run both checks
pnpm fix         # Fix everything
```

## Project Structure

```
project/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route handlers
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── index.js         # Entry point
├── package.json
└── .env.example
```

## Basic Express Setup

```javascript
// src/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Routes
app.use('/api/example', require('./routes/examples'));

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Database Setup with Prisma (Recommended)

Prisma provides excellent type safety and migrations:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Contest {
  id         Int      @id @default(autoincrement())
  name       String
  startDate  DateTime @map("start_date")
  endDate    DateTime @map("end_date")
  status     Status   @default(DRAFT)
  createdAt  DateTime @default(now()) @map("created_at")
  entries    Entry[]
  prizes     Prize[]
  
  @@index([startDate, endDate])
  @@map("contests")
}

model Entry {
  id         Int      @id @default(autoincrement())
  contestId  Int      @map("contest_id")
  userId     Int      @map("user_id")
  email      String
  createdAt  DateTime @default(now()) @map("created_at")
  
  contest    Contest  @relation(fields: [contestId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
  
  @@unique([contestId, userId], name: "unique_entry_per_contest")
  @@index([contestId, createdAt])
  @@map("entries")
}

model Prize {
  id         Int      @id @default(autoincrement())
  contestId  Int      @map("contest_id")
  name       String
  quantity   Int
  
  contest    Contest  @relation(fields: [contestId], references: [id])
  
  @@map("prizes")
}

enum Status {
  DRAFT
  ACTIVE
  COMPLETED
}
```

### Prisma Client Usage

```javascript
// src/config/database.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error']
});

module.exports = prisma;
```

## Controllers & Routes

### Routes
```javascript
// src/routes/contests.js
const express = require('express');
const router = express.Router();
const contestController = require('../controllers/contestController');
const { authenticate } = require('../middleware/auth');

router.get('/', contestController.list);
router.get('/:id', contestController.show);
router.post('/:id/enter', authenticate, contestController.enter);

module.exports = router;
```

### Controllers
```javascript
// src/controllers/contestController.js
const contestService = require('../services/contestService');

exports.list = async (req, res, next) => {
  try {
    const contests = await contestService.getActiveContests();
    res.json(contests);
  } catch (error) {
    next(error);
  }
};

exports.show = async (req, res, next) => {
  try {
    const contest = await contestService.getContestById(req.params.id);
    if (!contest) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    res.json(contest);
  } catch (error) {
    next(error);
  }
};

exports.enter = async (req, res, next) => {
  try {
    const entry = await contestService.createEntry({
      contestId: req.params.id,
      userId: req.user.id,
      email: req.body.email
    });
    
    res.status(201).json(entry);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'You have already entered this contest'
      });
    }
    next(error);
  }
};
```

## Services (Business Logic)

Keep business logic in services:

```javascript
// src/services/contestService.js
const prisma = require('../config/database');

class ContestService {
  async getActiveContests() {
    return prisma.contest.findMany({
      where: {
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      include: {
        _count: {
          select: { entries: true }
        }
      }
    });
  }
  
  async getContestById(id) {
    return prisma.contest.findUnique({
      where: { id: parseInt(id) },
      include: {
        prizes: true,
        _count: {
          select: { entries: true }
        }
      }
    });
  }
  
  async createEntry(data) {
    const contest = await this.getContestById(data.contestId);
    
    if (!contest || contest.status !== 'ACTIVE') {
      throw new Error('Contest is not active');
    }
    
    return prisma.entry.create({
      data: {
        contestId: parseInt(data.contestId),
        userId: data.userId,
        email: data.email
      }
    });
  }
  
  // Instant win with transaction and locking
  async claimPrize(userId, contestId) {
    return prisma.$transaction(async (tx) => {
      // Lock the prize row
      const prize = await tx.$queryRaw`
        SELECT * FROM prizes 
        WHERE contest_id = ${contestId} 
        AND quantity > 0 
        ORDER BY RANDOM() 
        LIMIT 1 
        FOR UPDATE
      `;
      
      if (!prize || prize.length === 0) {
        return null;
      }
      
      // Decrement quantity
      await tx.prize.update({
        where: { id: prize[0].id },
        data: { quantity: { decrement: 1 } }
      });
      
      // Create winner record
      const winner = await tx.winner.create({
        data: {
          userId,
          prizeId: prize[0].id,
          wonAt: new Date()
        }
      });
      
      return winner;
    });
  }
}

module.exports = new ContestService();
```

## Middleware

### Authentication
```javascript
// src/middleware/auth.js
const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Rate Limiting
```javascript
// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

exports.entryLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:entry:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many entry attempts, please try again later'
});

// Usage in routes
router.post('/:id/enter', entryLimiter, authenticate, contestController.enter);
```

### Error Handling
```javascript
// src/middleware/errorHandler.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        stack: err.stack,
        details: err
      }
    });
  } else {
    // Production: don't leak error details
    res.status(err.statusCode).json({
      error: {
        message: err.isOperational ? err.message : 'Something went wrong'
      }
    });
  }
};

module.exports = { AppError, errorHandler };
```

## Validation

Use express-validator:

```javascript
// src/middleware/validation.js
const { body, param, validationResult } = require('express-validator');

exports.validateEntry = [
  param('id').isInt().withMessage('Contest ID must be an integer'),
  body('email').isEmail().withMessage('Valid email required'),
  body('email').normalizeEmail(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Usage
router.post('/:id/enter', validateEntry, authenticate, contestController.enter);
```

## Background Jobs

Use Bull for job queues:

```javascript
// src/config/queue.js
const Queue = require('bull');
const redis = require('./redis');

const emailQueue = new Queue('emails', {
  redis: {
    host: redis.options.host,
    port: redis.options.port
  }
});

module.exports = { emailQueue };

// src/jobs/emailJob.js
const { emailQueue } = require('../config/queue');

emailQueue.process(async (job) => {
  const { entryId } = job.data;
  // Send email logic
  console.log(`Sending confirmation for entry ${entryId}`);
  return { sent: true };
});

// Add job
emailQueue.add({ entryId: 123 }, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});
```

### Prettier
Code formatting:
```bash
# Check
yarn format

# Auto-format
yarn format:fix
```

### Combined Workflow
```bash
# Check everything
yarn validate

# Fix everything
yarn fix
```

**Configuration files in template:**
- `eslint.config.mjs` - ESLint flat config
- `.prettierrc` or `prettier.config.js` - Prettier config

## Testing (Minimal)

For critical paths:

```javascript
// tests/services/contestService.test.js
const contestService = require('../../src/services/contestService');
const prisma = require('../../src/config/database');

describe('ContestService', () => {
  beforeEach(async () => {
    await prisma.entry.deleteMany();
    await prisma.contest.deleteMany();
  });
  
  test('prevents duplicate entries', async () => {
    const contest = await prisma.contest.create({
      data: {
        name: 'Test Contest',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        status: 'ACTIVE'
      }
    });
    
    await contestService.createEntry({
      contestId: contest.id,
      userId: 1,
      email: 'test@example.com'
    });
    
    await expect(
      contestService.createEntry({
        contestId: contest.id,
        userId: 1,
        email: 'test@example.com'
      })
    ).rejects.toThrow();
  });
});
```

## Deployment (Heroku/Render)

All express api are gonna run on a process on PM2, for bullMQ workers specify if some special config is needed

### package.json
```json
{
  "name": "contest-api",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "migrate": "npx prisma migrate deploy",
    "generate": "npx prisma generate"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.0.0",
    "@prisma/client": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "express-validator": "^7.0.0",
    "bull": "^4.11.0",
    "express-rate-limit": "^7.0.0",
    "rate-limit-redis": "^4.0.0",
    "redis": "^4.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "prisma": "^5.0.0"
  }
}
```

### Environment Variables
```
# .env.example
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=your-secret-key
FRONTEND_URL=https://frontend.example.com
```

## Common Packages

Essential:
- `express` - Web framework
- `cors` - CORS handling
- `helmet` - Security headers
- `morgan` - Logging
- `dotenv` - Environment variables
- `@prisma/client` or `sequelize` - ORM

Common additions:
- `jsonwebtoken` - JWT authentication
- `express-validator` - Input validation
- `bull` - Job queues
- `express-rate-limit` - Rate limiting
- `redis` - Caching and queues
- `axios` - HTTP client

## Anti-patterns to Avoid

- Don't put business logic in controllers
- Don't skip input validation
- Don't use `eval()` or `Function()` constructor
- Don't block the event loop with synchronous operations
- Don't forget to handle promise rejections
- Don't skip database transactions for multi-step operations
- Don't use `var` (use `const` and `let`)
- Don't deploy without setting NODE_ENV=production

## Quick Reference Commands

```bash
# Initialize project
npm init -y
npm install express cors helmet morgan dotenv

# Prisma
npm install @prisma/client
npm install -D prisma
npx prisma init
npx prisma migrate dev --name init
npx prisma generate

# Run development server
npm run dev

# Run production server
npm start
```

---

## Frontend (React) with Tailwind CSS (For AI Code Generation)

**Note: These guidelines apply to AI-generated code only. Human developers are free to use any frontend frameworks and styling libraries they prefer.**

When Claude or other AI tools generate frontend code for React projects, they should follow these standards:

# Frontend styles

### Using TailAwesome Layouts

1. Browse free templates at https://www.tailawesome.com/?price=free&type=template
2. Copy the HTML structure
3. Convert to JSX (remember: `class` → `className`, `for` → `htmlFor`)
4. Replace static content with React props/state

**Example Landing Page Component:**
```jsx
export default function LandingPage({ contest, prizes }) {
  return (
    <>
      {/* Hero Section */}
      <div className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold">{contest.name}</h1>
            <p className="py-6">{contest.description}</p>
            <a href="/enter" className="btn btn-primary btn-lg">
              Enter Now
            </a>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-base-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {prizes.map((prize) => (
              <div key={prize.id} className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h2 className="card-title">{prize.name}</h2>
                  <p>{prize.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
```

### Responsive Design with Tailwind

```jsx
<div className="container mx-auto px-4">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* Content adapts to screen size */}
  </div>
</div>

<h1 className="text-2xl md:text-4xl lg:text-5xl font-bold">
  Responsive Heading
</h1>

<button className="btn btn-sm md:btn-md lg:btn-lg">
  Responsive Button
</button>
```

No additional configuration needed - PostCSS processes Tailwind during the build automatically.

