
# PRD — price-bot (Used Gear Price Watcher)

## Problem
Monitor multiple marketplaces for specific used products and alert when a listing appears under a threshold price.

## Goals
- Watch specific products (starting with Roland System-8 and Roland S-1).
- Support multiple marketplaces via adapter pattern.
- Run headless via GitHub Actions.
- Notify via Discord webhook.
- Avoid duplicate alerts through persisted state.
- Provide lightweight history of runs and matches.

## Non-goals (MVP)
- Automated purchasing.
- Scraping behind auth barriers / bypassing ToS.
- Perfect semantic matching across all listing variations.

## Functional requirements
1. Watchlist in `config/watchlist.yml`
2. Marketplace adapters: eBay + Reverb
3. Matching:
   - include/exclude keyword rules
   - threshold check; optionally include shipping
4. De-dupe:
   - do not re-alert same listing ID
5. Discord alerts:
   - batched embeds, scannable information
6. Scheduling:
   - GitHub Actions cron + manual dispatch

## Success criteria
- Alerts fire for new listings under threshold.
- Duplicate alerts are rare.
- False positives manageable via config tuning.
