# AGENTS.md — Working Agreement for Coding Agents

This repository is intended to be iterated on by coding agents (Claude, Codex, etc.). Please follow these rules.

## Prime directive

**Preserve the bot’s reliability and avoid duplicate alerts.** Any change that could increase false positives or duplicate pings must be tested and documented.

## What matters most

1. **Correctness over cleverness**
   - Prefer simple, explicit logic that can be reasoned about.
2. **Respect marketplace ToS**
   - Prefer official APIs.
   - Do not add scraping that violates ToS or bypasses auth walls.
3. **No breaking changes to persisted data without a migration**
   - `data/state.json` and `data/history.json` are persisted across runs.
   - If you change their shape, bump `version` and implement a migration path.
4. **Keep GitHub Actions stable**
   - The scheduled workflow should be deterministic and not require manual intervention.

## Commands

- Build:
  ```bash
  npm run build
  ```
- Run watcher:
  ```bash
  npm run watch
  ```
- Format:
  ```bash
  npm run format
  ```
- Typecheck:
  ```bash
  npm run typecheck
  ```

### Dashboard (apps/dashboard)

- Dev server:
  ```bash
  cd apps/dashboard && npm run dev
  ```
- Build:
  ```bash
  cd apps/dashboard && npm run build
  ```

## Environment variables (required for live runs)

- `DISCORD_WEBHOOK_URL`
- `REVERB_TOKEN`

Optional (enable additional marketplaces):

- `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` - eBay Buy Browse API
- `AMAZON_ACCESS_KEY` / `AMAZON_SECRET_KEY` / `AMAZON_PARTNER_TAG` - Amazon PA-API 5.0

Optional settings:

- `EBAY_ENV` = `production` (default) or `sandbox`
- `LOG_LEVEL` = `debug|info|warn|error` (default `info`)

## Output contracts

- End of run must print a single summary line:
  - `scanned=<N> matches=<N> alerts=<N> errors=<N> durationMs=<N>`
- History is appended to `data/history.json` (array).
- State is updated in `data/state.json` with:
  - `updatedAt`
  - per-marketplace, per-product seen listing IDs and last effective price.

## How to add a new marketplace adapter

1. Add `src/adapters/<market>.ts` implementing `MarketplaceAdapter`
2. Register it in `src/adapters/index.ts`
3. Extend `MarketplaceId` union in `src/types.ts`
4. Update docs: `docs/ARCHITECTURE.md` and `docs/QUERY_STRATEGY.md`

## Testing strategy (lightweight)

- Add fixtures under `fixtures/` as raw JSON responses
- Add a small script or unit test that maps fixtures into normalized `Listing` objects
- Ensure matching and de-dupe behave as expected for those fixtures

## Style

- TypeScript, Node 20+
- Prefer built-in `fetch` over adding HTTP deps
- Avoid large dependencies unless clearly worth it
