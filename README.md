# price-bot (Used Gear Price Watcher)

Headless price watcher for used music gear across marketplaces (**Reverb**, **eBay**, and **Amazon**), with alerts to **Discord** and an optional dashboard.

## What it does

- Loads a watchlist from `config/watchlist.yml`
- Queries marketplaces via adapters (US sellers only to avoid tariff issues)
- Normalizes listings and applies keyword matching with include/exclude terms
- Filters by min/max price thresholds (optionally including shipping)
- Calculates market stats (min/max/avg/median) for price tracking outside thresholds
- De-duplicates alerts using `data/state.json`
- Writes run history to `data/history.json`
- Sends Discord webhook alerts for new matches
- Designed to run on a schedule via **GitHub Actions**

## Quick start (local)

1. Install and build:
   ```bash
   npm install
   npm run build
   ```
2. Copy env and fill in values:
   ```bash
   cp .env.example .env
   ```
3. Run:
   ```bash
   source .env && npm run watch
   ```

## Environment variables

Required:
- `DISCORD_WEBHOOK_URL` - Discord webhook for alerts
- `REVERB_TOKEN` - Reverb API token

Optional (enable additional marketplaces):
- `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` - eBay Buy Browse API credentials
- `AMAZON_ACCESS_KEY` / `AMAZON_SECRET_KEY` / `AMAZON_PARTNER_TAG` - Amazon PA-API 5.0 (requires Associate account)

Optional settings:
- `EBAY_ENV` - `production` (default) or `sandbox`
- `LOG_LEVEL` - `debug`, `info` (default), `warn`, or `error`

## GitHub Actions setup

1. Create a Discord webhook for the channel you want alerts in
2. Add GitHub repo secrets (Settings > Secrets):
   - `DISCORD_WEBHOOK_URL`
   - `REVERB_TOKEN`
   - `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` (optional)
   - `AMAZON_ACCESS_KEY` / `AMAZON_SECRET_KEY` / `AMAZON_PARTNER_TAG` (optional)
3. Adjust products & thresholds in `config/watchlist.yml`
4. Workflows:
   - `.github/workflows/watcher.yml` - Scheduled price watching + dashboard deployment
   - `.github/workflows/ci.yml` - Build validation on push/PR

## Watchlist configuration

Products are configured in `config/watchlist.yml`:

```yaml
products:
  - id: my-product
    name: 'Product Name'
    minPriceUsd: 100      # Skip listings below this (filters accessories)
    maxPriceUsd: 500      # Alert threshold
    marketplaces: ['reverb', 'ebay', 'amazon']
    includeTerms:         # At least one must match
      - 'product name'
      - 'alternate name'
    excludeTerms:         # None can match
      - 'case'
      - 'cover'
      - 'parts'
```

## Marketplace APIs

- **Reverb**: Reverb API with Bearer token auth
- **eBay**: Buy Browse API with OAuth2 client credentials
- **Amazon**: Product Advertising API 5.0 with AWS Signature v4 (requires Associate account)

All adapters filter to US-based sellers only. If a marketplace fails, the run continues and reports errors in the summary.

## Dashboard

The Next.js dashboard in `apps/dashboard` provides:
- Run history and statistics
- Market pricing trends with charts
- Product filtering
- Recent alerts/hits
- Dark mode (via system preference)

**Run locally:**
```bash
cd apps/dashboard
npm install
npm run dev
```

**GitHub Pages:** The dashboard auto-deploys to GitHub Pages on each watcher run.

## Docs

- `docs/PRD.md` - Product requirements
- `docs/ARCHITECTURE.md` - System architecture
- `docs/QUERY_STRATEGY.md` - Search strategy details
- `docs/DISCORD_EMBEDS.md` - Discord message format
- `AGENTS.md` - Instructions for coding agents
