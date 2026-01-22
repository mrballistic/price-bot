
import { loadConfig } from './config';
import { getAdapters } from './adapters';
import { logger } from './core/logger';
import { filterMatches } from './core/match';
import { appendHistory, markSeen, nowIso, readState, writeState, isSeen, ensureStateBuckets } from './core/state';
import { sendDiscordAlerts } from './notify/discord';
import { MarketplaceId, Match, RunRecord, SeenEntry } from './types';

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
        errors.push({ marketplace: market as MarketplaceId, productId: product.id, message: `No adapter for ${market}` });
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

    // De-dupe: only alert for unseen listing IDs
    const fresh: Match[] = [];
    for (const m of matches) {
      ensureStateBuckets(state, m.listing.source, product.id);
      if (!isSeen(state, m.listing.source, product.id, m.listing.sourceId)) {
        fresh.push(m);
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

    byProduct.push({
      productId: product.id,
      productName: product.name,
      thresholdUsd: product.maxPriceUsd,
      scanned: productScanned,
      matches: matches.slice(0, 50),
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
