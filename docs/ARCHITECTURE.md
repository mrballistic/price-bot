# Architecture

## Runtime

- Node.js 20
- TypeScript compiled to `dist/`
- Headless operation in GitHub Actions

## Marketplace adapters

- **Reverb** (`src/adapters/reverb.ts`) - Bearer token auth
- **eBay** (`src/adapters/ebay.ts`) - OAuth2 client credentials
- **Amazon** (`src/adapters/amazon.ts`) - PA-API 5.0 with AWS Signature v4

All adapters filter to US-based sellers only.

## Data flow

1. Load `config/watchlist.yml`
2. For each product:
   - For each marketplace:
     - adapter.search() => normalized Listing[]
3. Filter listings to matches (include/exclude terms + price thresholds)
4. Calculate market stats (min/max/avg/median) from filtered listings
5. De-dupe with persisted state (`data/state.json`)
6. Detect price drops (re-alert if previously-seen listing drops below threshold)
7. Send Discord webhook alerts for **fresh** matches and **price drops**
8. Update state and append run history (`data/history.json`)

## Persistence

- `data/state.json`
  - seen listing IDs per marketplace and product
  - last effective price (used for price-drop detection)
- `data/history.json`
  - array of RunRecord objects (one per run)
  - includes market stats per product

## Dashboard

Next.js app in `apps/dashboard/`:

- Reads `data/history.json` and `data/state.json`
- MUI components with glassmorphism styling
- Charts via Recharts
- Dark mode via system preference
- Deployed to GitHub Pages

## Extensibility

- Add new marketplaces by implementing `MarketplaceAdapter` in `src/adapters/`
- Improve matching by extending `src/core/match.ts`
- Matching supports regex patterns (`/pattern/` syntax)
