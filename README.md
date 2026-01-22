
# price-bot (Used Gear Price Watcher)

Headless price watcher for used music gear across marketplaces (initially **eBay** and **Reverb**), with alerts to **Discord**.

## What it does
- Loads a watchlist from `config/watchlist.yml`
- Queries marketplaces via adapters
- Normalizes listings
- Applies keyword + heuristic matching and a price threshold (optionally including shipping)
- De-duplicates alerts using `data/state.json`
- Writes run history to `data/history.json`
- Sends Discord webhook alerts for new matches
- Designed to run on a schedule via **GitHub Actions**

## Quick start (local)
1. Install:
   ```bash
   npm install
   npm run build
   ```
2. Copy env:
   ```bash
   cp .env.example .env
   # fill in values
   ```
3. Run:
   ```bash
   npm run watch
   ```

## GitHub Actions setup
1. Create a Discord webhook for the channel you want alerts in.
   - Discord “webhooks” are intended for automated messages to channels.
2. Add GitHub repo secrets:
   - `DISCORD_WEBHOOK_URL`
   - `EBAY_CLIENT_ID`
   - `EBAY_CLIENT_SECRET`
   - `REVERB_TOKEN`
3. Adjust products & thresholds in `config/watchlist.yml`
4. The workflow is in `.github/workflows/watcher.yml`

## Notes on marketplace APIs
- **eBay**: uses the Buy Browse API. This requires an OAuth2 client credentials token.
- **Reverb**: uses the Reverb API token.

If either marketplace fails (auth, transient error, etc.), the run continues and reports errors in the final summary.

## Optional dashboard (Next.js)
There’s an optional Next.js dashboard in `apps/dashboard` that reads `data/history.json` and `data/state.json`.

Run it locally:
```bash
cd apps/dashboard
npm install
npm run dev
```

## Docs
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/TASKS.md`
- `docs/QUERY_STRATEGY.md`
- `docs/DISCORD_EMBEDS.md`
- `AGENTS.md` (instructions for coding agents / bots)
