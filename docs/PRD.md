# PRD — price-bot (Used Gear Price Watcher)

## Problem

Monitor multiple marketplaces for specific used products and alert when a listing appears under a threshold price.

## Goals

- Watch specific products (e.g., Roland System-8, Elektron Analog Heat).
- Support multiple marketplaces via adapter pattern.
- Run headless via GitHub Actions.
- Notify via Discord webhook.
- Avoid duplicate alerts through persisted state.
- Provide lightweight history of runs and matches.
- Track market pricing trends.
- Alert on price drops for previously-seen listings.

## Non-goals

- Automated purchasing.
- Scraping behind auth barriers / bypassing ToS.
- Perfect semantic matching across all listing variations.

## Functional requirements

1. Watchlist in `config/watchlist.yml`
2. Marketplace adapters: Reverb, eBay, Amazon
3. Matching:
   - include/exclude keyword rules (with regex support)
   - min/max price thresholds; optionally include shipping
   - US sellers only (tariff avoidance)
4. De-dupe:
   - do not re-alert same listing ID
   - track last effective price for price-drop detection
5. Discord alerts:
   - batched embeds, scannable information
   - price-drop alerts with visual distinction
6. Market stats:
   - calculate min/max/avg/median from all matching listings
   - track pricing outside alert thresholds
7. Dashboard:
   - Next.js app with MUI
   - stats, charts, product filtering, dark mode
   - deployed to GitHub Pages
8. Scheduling:
   - GitHub Actions cron (every 30 min) + manual dispatch
   - CI workflow for build validation (lint, typecheck, tests)

## Success criteria

- Alerts fire for new listings under threshold.
- Price-drop alerts fire when existing listings become deals.
- Duplicate alerts are rare.
- False positives manageable via config tuning.
- Dashboard provides visibility into market pricing.
