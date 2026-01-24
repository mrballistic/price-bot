/**
 * @fileoverview Reverb marketplace adapter using the Reverb API.
 *
 * This adapter searches Reverb's marketplace for listings using their
 * REST API with Bearer token authentication. Supports both keyword
 * search and CSP (Canonical Standard Product) slug-based queries.
 * Results are normalized to the common Listing format.
 *
 * Required environment variables:
 * - REVERB_TOKEN: Reverb API bearer token
 *
 * @module adapters/reverb
 */

import { Listing } from '../types';
import { logger } from '../core/logger';
import { sleep } from '../core/sleep';
import { retry } from '../core/retry';
import { MarketplaceAdapter, SearchParams } from './types';

/**
 * Parses a money value from Reverb's various price formats.
 *
 * Handles { amount, currency }, { value, currency_code }, and similar variations.
 *
 * @param val - The raw money value from Reverb API
 * @returns Parsed money object or null if invalid
 * @private
 */
function parseMoney(val: any): { amount: number; currency: string } | null {
  const v = val?.amount ?? val?.value ?? val;
  const c = val?.currency ?? val?.currency_code ?? val?.currencyCode;
  const num = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (Number.isNaN(num) || !c) return null;
  return { amount: num, currency: String(c) };
}

/**
 * Extracts the web URL from a Reverb listing's _links object.
 *
 * Tries multiple possible locations for the URL field.
 *
 * @param listing - Raw listing object from Reverb API
 * @returns The listing's web URL or null if not found
 * @private
 */
function pickWebUrl(listing: any): string | null {
  const href = listing?._links?.web?.href || listing?._links?.web?.url;
  if (href) return String(href);
  if (listing?.url) return String(listing.url);
  if (listing?.permalink) return String(listing.permalink);
  return null;
}

/**
 * Converts a Reverb listing to a normalized Listing object.
 *
 * Extracts relevant fields from Reverb's listing format and
 * normalizes them to the common Listing structure.
 *
 * @param item - Raw listing object from Reverb API
 * @returns Normalized listing or null if required fields missing
 * @private
 */
function toListing(item: any): Listing | null {
  const id = item?.id;
  const title = item?.title;
  const url = pickWebUrl(item);
  const price =
    parseMoney(item?.price) ||
    parseMoney(item?.price_with_shipping) ||
    parseMoney(item?.listing_price);

  if (!id || !title || !url || !price) return null;

  // Reverb shipping can be nested; best-effort extraction.
  const ship = parseMoney(item?.shipping?.rate) || parseMoney(item?.shipping_price) || null;
  const shipping = ship
    ? { ...ship, known: true }
    : { amount: 0, currency: price.currency, known: false };

  const img = item?.photos?.[0]?._links?.full?.href || item?.photos?.[0]?._links?.thumbnail?.href;

  return {
    source: 'reverb',
    sourceId: String(id),
    title: String(title),
    url: String(url),
    price,
    shipping,
    imageUrl: img ? String(img) : undefined,
    condition: item?.condition ? String(item.condition) : undefined,
    location: item?.shop?.country ? String(item.shop.country) : undefined,
    listedAt: item?.created_at ? String(item.created_at) : undefined,
  };
}

/**
 * Performs a keyword search on Reverb's listings API.
 *
 * Searches for items matching the query, filtered to US sellers only.
 *
 * @param q - Search query string
 * @param limit - Maximum number of results to return (max 50 per request)
 * @returns Array of normalized listings
 * @throws Error if the API request fails
 * @private
 */
async function searchReverbOnce(q: string, limit: number): Promise<Listing[]> {
  const token = process.env.REVERB_TOKEN;
  if (!token) throw new Error('Missing REVERB_TOKEN');

  // Reverb API base
  const url = new URL('https://api.reverb.com/api/listings');
  url.searchParams.set('query', q);
  url.searchParams.set('per_page', String(Math.min(limit, 50)));
  // Filter to US sellers only (avoid tariff issues)
  url.searchParams.set('ships_to', 'US');
  url.searchParams.set('item_region', 'US');

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Version': '3.0',
    },
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Reverb search error: ${resp.status} ${txt}`);
  }

  const json = (await resp.json()) as any;
  const items = Array.isArray(json?.listings) ? json.listings : Array.isArray(json) ? json : [];
  const listings: Listing[] = [];
  for (const it of items) {
    const l = toListing(it);
    if (l) listings.push(l);
  }
  return listings;
}

/**
 * Searches Reverb using a CSP (Canonical Standard Product) slug.
 *
 * CSP queries are more accurate than keyword searches as they target
 * a specific product type directly. Useful for well-known products
 * with established Reverb product pages.
 *
 * @param slug - The Reverb CSP slug (e.g., "roland-system-8")
 * @param limit - Maximum number of results to return (max 50 per request)
 * @returns Array of normalized listings
 * @throws Error if the API request fails
 * @private
 */
async function searchReverbByProductSlug(slug: string, limit: number): Promise<Listing[]> {
  const token = process.env.REVERB_TOKEN;
  if (!token) throw new Error('Missing REVERB_TOKEN');

  // Reverb CSP (Canonical Standard Product) endpoint
  const url = new URL(`https://api.reverb.com/api/csps/${encodeURIComponent(slug)}/listings`);
  url.searchParams.set('per_page', String(Math.min(limit, 50)));
  // Filter to US sellers only
  url.searchParams.set('ships_to', 'US');
  url.searchParams.set('item_region', 'US');

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Version': '3.0',
    },
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Reverb CSP search error: ${resp.status} ${txt}`);
  }

  const json = (await resp.json()) as any;
  const items = Array.isArray(json?.listings) ? json.listings : Array.isArray(json) ? json : [];
  const listings: Listing[] = [];
  for (const it of items) {
    const l = toListing(it);
    if (l) listings.push(l);
  }
  return listings;
}

/**
 * Creates a Reverb marketplace adapter instance.
 *
 * The adapter first searches by CSP slugs (if provided in product config),
 * then performs keyword searches using include terms. Results are deduplicated
 * and limited to the configured maximum.
 *
 * @returns Configured Reverb adapter
 *
 * @example
 * ```typescript
 * const reverbAdapter = createReverbAdapter();
 * const listings = await reverbAdapter.search({ product, cfg });
 * ```
 */
export function createReverbAdapter(): MarketplaceAdapter {
  return {
    id: 'reverb',
    search: async ({ product, cfg }: SearchParams) => {
      const max = cfg.settings.maxResultsPerMarketplace;
      const delayMs = cfg.settings.requestDelayMs;

      const all: Listing[] = [];
      const seen = new Set<string>();

      // First, search by product slugs if provided (most accurate)
      const slugs = product.reverbProductSlugs ?? [];
      for (const slug of slugs.slice(0, 2)) {
        await sleep(delayMs);
        try {
          const listings = await retry(() => searchReverbByProductSlug(slug, max), {
            retries: 3,
            baseDelayMs: 500,
            label: `reverb.csp(${slug})`,
          });

          for (const l of listings) {
            if (seen.has(l.sourceId)) continue;
            seen.add(l.sourceId);
            all.push(l);
          }
        } catch (err) {
          // CSP endpoint might 404 if slug is invalid; fall through to keyword search
          logger.debug(`Reverb CSP search failed for ${slug}: ${err}`);
        }
      }

      // Then do keyword searches
      const queries = (
        product.includeTerms && product.includeTerms.length > 0
          ? product.includeTerms
          : [product.name]
      ).slice(0, 4);

      for (const q of queries) {
        await sleep(delayMs);
        const listings = await retry(() => searchReverbOnce(q, max), {
          retries: 3,
          baseDelayMs: 500,
          label: `reverb.search(${q})`,
        });

        for (const l of listings) {
          if (seen.has(l.sourceId)) continue;
          seen.add(l.sourceId);
          all.push(l);
        }
      }

      logger.debug(`Reverb returned ${all.length} raw listings for ${product.id}`);
      return all.slice(0, cfg.settings.maxListingsPerProductPerRun);
    },
  };
}
