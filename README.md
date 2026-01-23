# price-bot (Used Gear Price Watcher)

Headless price watcher for used music gear across marketplaces (**Reverb**, **eBay**, and **Amazon**), with alerts to **Discord** and an optional dashboard.

## What it does

- Loads a watchlist from `config/watchlist.yml`
- Queries marketplaces via adapters (US sellers only to avoid tariff issues)
- Normalizes listings and applies keyword matching with include/exclude terms (supports regex)
- Filters by min/max price thresholds (optionally including shipping)
- Calculates market stats (min/max/avg/median) for price tracking outside thresholds
- De-duplicates alerts using `data/state.json`
- **Price-drop alerts**: Re-alerts when a previously-seen listing drops below threshold
- Writes run history to `data/history.json`
- Sends Discord webhook alerts for new matches and price drops
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
      - '/product\s*v\d+/i'  # Regex pattern (wrapped in /.../)
    excludeTerms:         # None can match
      - 'case'
      - 'cover'
      - 'parts'
      - '/\bfor\s+parts\b/'  # Regex pattern
```

**Regex support:** Terms wrapped in `/pattern/` are treated as regular expressions. Flags can be added after the closing slash (e.g., `/pattern/i` for case-insensitive). By default, all regex patterns are case-insensitive.

## Marketplace APIs

- **Reverb**: Reverb API with Bearer token auth
- **eBay**: Buy Browse API with OAuth2 client credentials
- **Amazon**: Product Advertising API 5.0 with AWS Signature v4 (requires Associate account)

All adapters filter to US-based sellers only. If a marketplace fails, the run continues and reports errors in the summary.

## Discord alerts

Alerts are sent as rich embeds with:
- Listing title, image, and link
- Price, shipping, and effective total
- Marketplace and condition
- Threshold comparison

**Price-drop alerts** are highlighted with:
- Green color and 📉 emoji
- Previous price → new price with savings amount
- "PRICE DROP" label in footer

## Dashboard

The Next.js dashboard in `apps/dashboard` provides:
- **Stats overview**: Last run time, items scanned, alerts sent, errors
- **Product cards**: Each watched product with alert thresholds and market stats
- **Market pricing**: Live min/max/avg/median prices with sample listings
- **Hits section**: All matches under threshold, sorted by price
- **Activity charts**: Scan activity and alerts over time (Recharts)
- **Product filtering**: Filter all views by product
- **Dark mode**: Automatic via system preference (no toggle needed)

Built with MUI (Material UI) and deployed as a static site.

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

## License

MIT License - see [LICENSE](LICENSE) for details.
