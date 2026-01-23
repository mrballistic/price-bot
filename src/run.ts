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
  isSeen,
  ensureStateBuckets,
} from './core/state';
import { sendDiscordAlerts } from './notify/discord';
import { Listing, MarketplaceId, MarketStats, Match, RunRecord, SeenEntry } from './types';

function groupMatchesByProduct(matches: Match[]): Record<string, Match[]> {
  const m: Record<string, Match[]> = {};
  for (const x of matches) {
    m[x.productId] = m[x.productId] || [];
    m[x.productId].push(x);
  }
  for (const k of Object.keys(m)) {
    m[k].sort((a, b) => a.effectivePriceUsd - b.effectivePriceUsd);
  }
  return m;
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function calculateMarketStats(listings: Listing[], cfg: { settings: { includeShippingInThreshold: boolean } }): MarketStats {
  if (listings.length === 0) {
    return { count: 0, minPrice: null, maxPrice: null, avgPrice: null, medianPrice: null, samples: [] };
  }

  // Calculate effective prices for all USD listings
  const priced = listings
    .filter((l) => l.price.currency.toUpperCase() === 'USD')
    .map((l) => {
      const { effective } = computeEffectivePriceUsd(l, cfg as any);
      return { listing: l, price: effective };
    })
    .sort((a, b) => a.price - b.price);

  if (priced.length === 0) {
    return { count: 0, minPrice: null, maxPrice: null, avgPrice: null, medianPrice: null, samples: [] };
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
      };
      // If we already saw it, preserve firstSeenAt if present.
      const existing = state.seen?.[m.listing.source]?.[product.id]?.[m.listing.sourceId];
      if (existing?.firstSeenAt) entry.firstSeenAt = existing.firstSeenAt;
      markSeen(state, m.listing.source, product.id, m.listing.sourceId, entry);
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
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
