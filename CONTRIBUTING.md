# Contributing to price-bot

Thanks for your interest in contributing! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd apps/dashboard && npm install && cd ../..
   ```
3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
4. Build the project:
   ```bash
   npm run build
   ```

### Running Locally

```bash
# Run the price watcher
source .env && npm run watch

# Run the dashboard (separate terminal)
cd apps/dashboard && npm run dev
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes

### Making Changes

1. Create a branch from `main`
2. Make your changes
3. Run tests: `npm test`
4. Run linting: `npm run lint`
5. Format code: `npm run format`
6. Commit with a descriptive message
7. Push and open a pull request

### Commit Messages

Use clear, descriptive commit messages:
- `feat: add support for new marketplace`
- `fix: handle missing shipping data`
- `docs: update API setup instructions`
- `test: add tests for match filtering`

## Code Guidelines

### Project Structure

```
src/
  adapters/     # Marketplace API integrations
  core/         # Core logic (matching, state, retry)
  notify/       # Notification channels (Discord)
  types.ts      # Shared TypeScript types
  config.ts     # Configuration loading
  run.ts        # Main entry point
apps/
  dashboard/    # Next.js dashboard app
```

### Guidelines

- **Adapters**: Keep marketplace-specific logic in `src/adapters/*`
- **Matching**: Keep matching/filtering logic in `src/core/match.ts`
- **Types**: Add new types to `src/types.ts`
- **APIs**: Prefer official APIs over scraping
- **US Sellers**: Filter to US-based sellers to avoid tariff complications
- **Error Handling**: Use retry with backoff for API calls
- **Logging**: Use `logger` from `src/core/logger.ts`

### Code Style

- TypeScript with strict mode
- Prettier for formatting (runs on commit)
- ESLint for linting
- JSDoc comments for public functions

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

When adding features or fixing bugs:
- Add tests for new functionality
- Ensure existing tests pass
- Aim for good coverage of edge cases

## Documentation

- Update `README.md` for user-facing changes
- Update `CHANGELOG.md` following Keep a Changelog format
- Add JSDoc comments for new functions
- Update `docs/` for architectural changes

## Questions?

Open an issue with the "question" label if you need help or clarification.
