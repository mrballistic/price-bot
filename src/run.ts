/**
 * @fileoverview Main entry point for the price bot.
 *
 * This module orchestrates the complete price monitoring workflow:
 * 1. Loads configuration from the watchlist YAML file
 * 2. Initializes marketplace adapters (eBay, Reverb, Amazon)
 * 3. Searches each marketplace for configured products
 * 4. Filters listings that match price thresholds
 * 5. Detects price drops on previously seen listings
 * 6. Sends Discord alerts for new matches and price drops
 * 7. Tracks sold items (listings that disappear)
 * 8. Persists state and appends run history
 *
 * The bot is designed to run on a schedule (e.g., via GitHub Actions or
 * GitHub Actions cron) and will only alert once per listing unless the price drops.
 *
 * @module run
 */

import { loadConfig } from './config';
import { getAdapters } from './adapters';
import { logger } from './core/logger';
import { filterMatches, computeEffectivePriceUsd, titlePasses } from './core/match';
import {
  appendHistory,
  markSeen,
  nowIso,
  readState,
  writeState,
  ensureStateBuckets,
  cleanupOldSoldItems,
} from './core/state';
import { sendDiscordAlerts } from './notify/discord';
import {
  Listing,
  MarketplaceId,
  MarketStats,
  Match,
  RunRecord,
  SeenEntry,
  WatchlistConfig,
} from './types';

/**
 * Converts an unknown error value to a string message.
 *
 * @param err - The error value to stringify
 * @returns Error message string
 * @private
 */
function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Calculates market statistics from a set of listings.
 *
 * Computes min, max, average, and median effective prices for USD listings.
 * Also selects representative samples at key percentiles (lowest, 25th, median,
 * 75th, and highest) for display in the dashboard.
 *
 * @param listings - Array of listings to analyze (all price points, not filtered by threshold)
 * @param cfg - Configuration object with shipping inclusion setting
 * @returns Market statistics including price range, averages, and sample listings
 * @private
 */
function calculateMarketStats(
  listings: Listing[],
  cfg: { settings: { includeShippingInThreshold: boolean } },
): MarketStats {
  if (listings.length === 0) {
    return {
      count: 0,
      minPrice: null,
      maxPrice: null,
      avgPrice: null,
      medianPrice: null,
      samples: [],
    };
  }

  // Calculate effective prices for all USD listings
  const priced = listings
    .filter((l) => l.price.currency.toUpperCase() === 'USD')
    .map((l) => {
      const { effective } = computeEffectivePriceUsd(l, cfg as WatchlistConfig);
      return { listing: l, price: effective };
    })
    .sort((a, b) => a.price - b.price);

  if (priced.length === 0) {
    return {
      count: 0,
      minPrice: null,
      maxPrice: null,
      avgPrice: null,
      medianPrice: null,
      samples: [],
    };
  }

  const prices = priced.map((p) => p.price);
  const sum = prices.reduce((a, b) => a + b, 0);
  const avg = sum / prices.length;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];

  // Pick samples: lowest, median, highest (and maybe a couple in between)
  const samples: MarketStats['samples'] = [];
  const addSample = (idx: number) => {
    if (idx >= 0 && idx < priced.length) {
      const p = priced[idx];
      // Avoid duplicates
      if (!samples.some((s) => s.url === p.listing.url)) {
        samples.push({
          title: p.listing.title,
          price: p.price,
          url: p.listing.url,
          source: p.listing.source,
          listedAt: p.listing.listedAt,
        });
      }
    }
  };

  addSample(0); // lowest
  addSample(Math.floor(priced.length * 0.25)); // 25th percentile
  addSample(Math.floor(priced.length * 0.5)); // median
  addSample(Math.floor(priced.length * 0.75)); // 75th percentile
  addSample(priced.length - 1); // highest

  return {
    count: priced.length,
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
    avgPrice: Math.round(avg * 100) / 100,
    medianPrice: Math.round(median * 100) / 100,
    samples,
  };
}

/**
 * Main execution function for the price bot.
 *
 * Orchestrates the complete monitoring workflow:
 *
 * 1. **Initialization**: Loads configuration and state, creates marketplace adapters
 * 2. **Search Phase**: For each product, searches configured marketplaces
 * 3. **Match Filtering**: Applies price thresholds and term filters
 * 4. **De-duplication**: Identifies new listings vs. previously seen
 * 5. **Price Drop Detection**: Compares current prices to stored prices
 * 6. **Sold Tracking**: Marks listings as sold after 3 consecutive missed runs
 * 7. **Alerting**: Sends Discord notifications for new listings and price drops
 * 8. **State Persistence**: Updates seen listings and cleans up old sold items
 * 9. **History Recording**: Appends run statistics to history file
 *
 * @returns Promise that resolves when the run completes
 * @throws Error if critical failures occur (Discord webhook fails, etc.)
 *
 * @example
 * ```bash
 * # Run via npm script
 * npm run watch
 *
 * # Or directly with tsx
 * npx tsx src/run.ts
 * ```
 */
async function main(): Promise<void> {
  const started = Date.now();
  const runAt = nowIso();

  const cfg = loadConfig();
  const adapters = getAdapters();

  const state = readState();
  const errors: RunRecord['errors'] = [];

  let totalScanned = 0;
  let totalMatches = 0;
  let totalAlerts = 0;

  const byProduct: RunRecord['byProduct'] = [];

  for (const product of cfg.products) {
    let productScanned = 0;

    const rawListings = [];

    for (const market of product.marketplaces) {
      const adapter = adapters[market];
      if (!adapter) {
        errors.push({
          marketplace: market as MarketplaceId,
          productId: product.id,
          message: `No adapter for ${market}`,
        });
        continue;
      }

      try {
        const listings = await adapter.search({ product, cfg });
        rawListings.push(...listings);
        productScanned += listings.length;
      } catch (err) {
        errors.push({ marketplace: market, productId: product.id, message: stringifyError(err) });
        logger.warn(`Adapter failed for ${market}/${product.id}: ${stringifyError(err)}`);
      }
    }

    totalScanned += productScanned;

    // Filter + sort matches
    const matches = filterMatches(product, rawListings, cfg);
    totalMatches += matches.length;

    // De-dupe: only alert for unseen listing IDs OR price drops
    const fresh: Match[] = [];
    for (const m of matches) {
      ensureStateBuckets(state, m.listing.source, product.id);
      const existing = state.seen?.[m.listing.source]?.[product.id]?.[m.listing.sourceId];

      if (!existing) {
        // New listing
        fresh.push(m);
      } else if (m.effectivePriceUsd < existing.lastEffectivePrice) {
        // Price drop! Alert again with price drop info
        const dropAmount = existing.lastEffectivePrice - m.effectivePriceUsd;
        fresh.push({
          ...m,
          priceDrop: {
            previousPrice: existing.lastEffectivePrice,
            dropAmount,
          },
        });
        logger.info(
          `Price drop detected: ${m.listing.title} dropped $${dropAmount.toFixed(2)} (was $${existing.lastEffectivePrice}, now $${m.effectivePriceUsd})`,
        );
      }
    }

    // Update state for ALL matches (so future runs don't re-alert),
    // but only alert for fresh matches.
    for (const m of matches) {
      const entry: SeenEntry = {
        firstSeenAt: runAt,
        lastSeenAt: runAt,
        lastEffectivePrice: m.effectivePriceUsd,
        url: m.listing.url,
        title: m.listing.title,
        missedRuns: 0, // Reset since we saw it this run
      };
      // If we already saw it, preserve firstSeenAt if present.
      const existing = state.seen?.[m.listing.source]?.[product.id]?.[m.listing.sourceId];
      if (existing?.firstSeenAt) entry.firstSeenAt = existing.firstSeenAt;
      markSeen(state, m.listing.source, product.id, m.listing.sourceId, entry);
    }

    // Track sold items: check previously-seen listings that weren't found this run
    const seenThisRunByMarket: Record<string, Set<string>> = {};
    for (const l of rawListings) {
      if (!seenThisRunByMarket[l.source]) seenThisRunByMarket[l.source] = new Set();
      seenThisRunByMarket[l.source].add(l.sourceId);
    }

    for (const market of product.marketplaces) {
      const productListings = state.seen?.[market]?.[product.id];
      if (!productListings) continue;

      const seenThisRun = seenThisRunByMarket[market] || new Set();

      for (const [listingId, entry] of Object.entries(productListings)) {
        // Skip already-sold items
        if (entry.soldAt) continue;

        if (!seenThisRun.has(listingId)) {
          // Listing not found this run - increment missed count
          entry.missedRuns = (entry.missedRuns || 0) + 1;

          if (entry.missedRuns >= 3) {
            // Mark as sold after 3 consecutive missed runs
            entry.soldAt = runAt;
            logger.info(`Marked as sold: ${entry.title} (missed ${entry.missedRuns} runs)`);
          }
        }
      }
    }

    // Send alerts (batched) for this product
    if (fresh.length > 0) {
      const sent = await sendDiscordAlerts(fresh, cfg, runAt);
      totalAlerts += sent;
      logger.info(`Sent ${sent} Discord alert(s) for ${product.id}`);
    } else {
      logger.info(`No new alerts for ${product.id} (matches=${matches.length}, fresh=0)`);
    }

    // Calculate market stats from listings that pass title filters (but ignore price thresholds)
    const filteredForStats = rawListings.filter((l) => titlePasses(product, l.title));
    const marketStats = calculateMarketStats(filteredForStats, cfg);

    byProduct.push({
      productId: product.id,
      productName: product.name,
      thresholdUsd: product.maxPriceUsd,
      scanned: productScanned,
      matches: matches.slice(0, 50),
      marketStats,
    });
  }

  // Clean up sold items older than 5 days
  const removedSold = cleanupOldSoldItems(state);
  if (removedSold > 0) {
    logger.info(`Cleaned up ${removedSold} sold item(s) older than 5 days`);
  }

  state.updatedAt = runAt;
  writeState(state);

  const durationMs = Date.now() - started;

  const record: RunRecord = {
    runAt,
    durationMs,
    scanned: totalScanned,
    matches: totalMatches,
    alerts: totalAlerts,
    errors,
    byProduct,
  };

  appendHistory(record);

  logger.info(
    `summary scanned=${totalScanned} matches=${totalMatches} alerts=${totalAlerts} errors=${errors.length} durationMs=${durationMs}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
