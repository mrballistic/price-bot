# Task Plan

## MVP

- [x] Repo scaffold (TS, config, data)
- [x] Adapter interface
- [x] eBay adapter (Buy Browse API)
- [x] Reverb adapter
- [x] Matching + threshold + optional shipping
- [x] De-dupe state + history
- [x] Discord notifications (embeds, batching)
- [x] GitHub Actions workflow

## Next iterations

- [x] Price-drop alerts (alert if an existing listing drops below threshold)
- [x] ~~Better currency handling (FX)~~ Not needed - US sellers only, all USD
- [x] Stronger product matching (include/exclude terms, min price filtering)
- [x] More marketplaces via adapters (Amazon PA-API)
- [x] Dashboard improvements (MUI, charts, filters, dark mode, market stats)

## Future ideas

- [x] Regex support for matching
- [ ] Email/SMS notifications
- [ ] Saved searches / user accounts
- [ ] Price history tracking per listing
