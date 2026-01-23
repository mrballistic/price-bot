# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-22

### Added
- Initial release
- **Marketplace adapters**: Reverb, eBay, Amazon (PA-API 5.0)
- **Discord notifications**: Rich embeds with listing details
- **Price-drop alerts**: Re-alerts when previously-seen listings drop below threshold
- **Matching**: Include/exclude terms with regex support (`/pattern/`)
- **Filtering**: Min/max price thresholds, US sellers only
- **Market stats**: Track min/max/avg/median prices outside thresholds
- **Dashboard**: Next.js app with MUI, charts, dark mode, glassmorphism
- **GitHub Actions**: Scheduled watcher + CI + GitHub Pages deployment
- **State management**: De-duplication via `data/state.json`
- **History tracking**: Run logs in `data/history.json`
