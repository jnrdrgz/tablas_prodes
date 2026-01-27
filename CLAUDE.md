# Claude Development Guidelines

## Project Context

You are assisting with development at a single developer making personal projects

## Core Development Priorities

These priorities guide ALL development decisions, in order:

1. **Speed and Simplicity** - Fast iteration is critical. Choose the simplest solution that works.
2. **Understandable Code** - Code must be easily understood by other developers who may need to pivot quickly.
3. **Deployment Ease** - Must work seamlessly with my hosting infrastructure.

## Infrastructure

1. Assume that all the code will run on a single vps running linux with 4gb of ram that is running other applications, dont do anything too process heavy

## What I Don't Prioritize

- Heavy documentation (code should be self-documenting)
- Over-engineering or premature optimization
- Complex architectural patterns when simple ones suffice

## Technology Stack

Read stack.md

### Project Structure:
- **Monorepo** (frontend + backend together)

### Hosting:
- a single vps running linux with 4gb of ram that is running other applications

## Code Style
- Prioritize readability over cleverness
- Use clear, descriptive variable and function names
- Keep functions small and focused
- Favor explicit over implicit behavior
- Comment only when the "why" isn't obvious from the code

## Architecture Patterns
- Start with the simplest architecture that could work
- For API projects, use clear separation between backend and frontend
- Avoid microservices unless absolutely necessary
- Database operations should be straightforward and use ORM patterns

## Data Integrity
- Use transactions for multi-step operations
- Validate at both database and application layers
- Log all critical actions with timestamps and user context

## Error Handling
- Fail fast and loudly in development
- Graceful degradation in production
- Log errors with sufficient context for debugging
- Return user-friendly error messages

## Performance Considerations
- Optimize database queries (use indexes, avoid N+1)

## Security Basics
- Sanitize all user inputs
- Use parameterized queries
- Implement CORS appropriately

## Deployment Considerations

- Use environment variables for configuration
- Set up scheduled tasks using platform scheduler

## Project-Specific Files

Check for language-specific CLAUDE_[LANGUAGE].md files that provide additional context:
- CLAUDE_RAILS.md for Ruby on Rails projects
- CLAUDE_DJANGO.md for Django projects
- CLAUDE_EXPRESS.md for Express.js projects

## Development Workflow

1. Understand the requirements and timeline that are on the SPEC.md file
2. Choose the simplest technical approach
3. Build iteratively with frequent check-ins
4. Focus on core functionality first
5. Document any non-obvious decisions
6. Add instructions to run to README.md but don't execute any command, all testing and running will be human

## Communication

When working on code:
- Ask clarifying questions about requirements early
- Propose the simplest solution first
- Explain tradeoffs when suggesting approaches
- Highlight any data integrity concerns
- Note deployment requirements or environment variables needed

## Red Flags to Avoid

- Over-complicated abstractions
- Tight coupling between components
- Lack of data validation in critical flows
- Missing database constraints for business rules
- Deployment configurations that won't work on a single vps running linux

---

## Frontend & Styling Standards (For AI Code Generation)

**Note: These guidelines apply to AI-generated code only. Human developers are free to use any frontend frameworks and styling libraries they prefer.**

When Claude or other AI tools generate frontend code, they should choose an appropriate styling approach:

### Styling Options

- Utility-first CSS for rapid development
- Minimal custom CSS needed

#### TailAwesome Layouts (https://www.tailawesome.com/)
- **Use for page layouts when AI generates code**: https://www.tailawesome.com/?price=free&type=template
- Filter by: Free, Template type
- Use for landing pages, dashboards, full page layouts
- AI should copy and adapt layouts rather than building from scratch

### Styling Approach (For AI-Generated Code)
1. Start with Tailwind utility classes
3. Use TailAwesome layouts for full page structures
4. Keep custom CSS minimal
5. Ensure responsive design (use Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`)


# Logs

It's very important that ALL operations are heavily logged, you can use simple console.logs but it's very important that programmers can audit what failed by seeing the console log