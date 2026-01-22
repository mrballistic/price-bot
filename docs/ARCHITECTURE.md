
# Architecture

## Runtime
- Node.js 20
- TypeScript compiled to `dist/`
- Headless operation in GitHub Actions

## Data flow
1. Load `config/watchlist.yml`
2. For each product:
   - For each marketplace:
     - adapter.search() => normalized Listing[]
3. Filter listings to matches (keyword rules + price threshold)
4. De-dupe with persisted state (`data/state.json`)
5. Send Discord webhook alerts for **fresh** matches
6. Update state and append run history (`data/history.json`)

## Persistence
- `data/state.json`
  - seen listing IDs per marketplace and product
  - last effective price
- `data/history.json`
  - array of RunRecord objects (one per run)

## Extensibility
- Add new marketplaces by implementing `MarketplaceAdapter` in `src/adapters/`
- Improve matching by extending `src/core/match.ts`
