/**
 * @fileoverview eBay marketplace adapter using the Buy Browse API.
 *
 * This adapter searches eBay's marketplace for listings using the
 * Buy Browse API with OAuth2 client credentials authentication.
 * Results are normalized to the common Listing format.
 *
 * Required environment variables:
 * - EBAY_CLIENT_ID: eBay application client ID
 * - EBAY_CLIENT_SECRET: eBay application client secret
 * - EBAY_ENV (optional): 'production' (default) or 'sandbox'
 * - EBAY_MARKETPLACE_ID (optional): defaults to 'EBAY_US'
 *
 * @module adapters/ebay
 */

import { Listing } from '../types';
import { logger } from '../core/logger';
import { sleep } from '../core/sleep';
import { retry } from '../core/retry';
import { MarketplaceAdapter, SearchParams } from './types';

/**
 * eBay OAuth2 token response structure.
 */
interface EbayToken {
  /** The bearer token for API requests */
  access_token: string;
  /** Token lifetime in seconds */
  expires_in: number;
  /** Token type (usually "Application Access Token") */
  token_type: string;
}

/** Cached OAuth token to avoid re-authentication on every request. */
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Returns the appropriate eBay API base URL based on environment.
 *
 * @returns The base URL for eBay API requests
 * @private
 */
function getEbayBaseUrl(): string {
  const env = (process.env.EBAY_ENV || 'production').toLowerCase();
  return env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

/**
 * Obtains an OAuth2 access token from eBay using client credentials.
 *
 * Tokens are cached and reused until they expire (with a 60-second buffer).
 * Uses the client credentials grant type for application-level access.
 *
 * @returns The access token for API requests
 * @throws If credentials are missing or token request fails
 * @private
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60_000) return cachedToken.token;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing EBAY_CLIENT_ID/EBAY_CLIENT_SECRET');

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  });

  const url = `${getEbayBaseUrl()}/identity/v1/oauth2/token`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`eBay token error: ${resp.status} ${txt}`);
  }

  const json = (await resp.json()) as EbayToken;
  cachedToken = {
    token: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return cachedToken.token;
}

/**
 * Parses a money value from eBay's various price formats.
 *
 * Handles both { value, currency } and { amount, currencyCode } formats.
 *
 * @param val - The raw money value from eBay API
 * @returns Parsed money or null if invalid
 * @private
 */
function parseMoney(val: unknown): { amount: number; currency: string } | null {
  const o = val as Record<string, unknown> | undefined;
  const v = o?.value ?? o?.amount ?? val;
  const c = o?.currency ?? o?.currencyCode;
  const num = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (Number.isNaN(num) || !c) return null;
  return { amount: num, currency: String(c) };
}

/**
 * Converts an eBay item summary to a normalized Listing.
 *
 * Extracts relevant fields from eBay's item summary format and
 * normalizes them to the common Listing structure.
 *
 * @param item - Raw item summary from eBay API
 * @returns Normalized listing or null if required fields missing
 * @private
 */
function toListing(item: unknown): Listing | null {
  const i = item as Record<string, unknown> | undefined;
  const id = (i?.itemId || i?.legacyItemId) as string | undefined;
  const title = i?.title as string | undefined;
  const url = i?.itemWebUrl as string | undefined;
  const price = parseMoney(i?.price);
  if (!id || !title || !url || !price) return null;

  const shippingOptions = i?.shippingOptions as Array<Record<string, unknown>> | undefined;
  const ship0 = shippingOptions?.[0]?.shippingCost;
  const shippingParsed = parseMoney(ship0);
  const shipping = shippingParsed
    ? { ...shippingParsed, known: true }
    : { amount: 0, currency: price.currency, known: false };

  const imageObj = i?.image as Record<string, unknown> | undefined;
  const img = imageObj?.imageUrl as string | undefined;
  const itemLocation = i?.itemLocation as Record<string, unknown> | undefined;

  return {
    source: 'ebay',
    sourceId: String(id),
    title: String(title),
    url: String(url),
    price,
    shipping,
    imageUrl: img ? String(img) : undefined,
    condition: i?.condition ? String(i.condition) : undefined,
    location: itemLocation?.country ? String(itemLocation.country) : undefined,
    listedAt: i?.itemCreationDate ? String(i.itemCreationDate) : undefined,
  };
}

/**
 * Performs a single search request to eBay's Browse API.
 *
 * Searches for items matching the query, filtered to US sellers only.
 *
 * @param q - Search query string
 * @param limit - Maximum number of results to return
 * @returns Array of normalized listings
 * @throws If the API request fails
 * @private
 */
async function searchEbayOnce(q: string, limit: number): Promise<Listing[]> {
  const token = await getAccessToken();
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';

  const url = new URL(`${getEbayBaseUrl()}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  // Filter to US sellers only (avoid tariff issues)
  url.searchParams.set('filter', 'itemLocationCountry:US');

  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`eBay search error: ${resp.status} ${txt}`);
  }

  const json = (await resp.json()) as Record<string, unknown>;
  const items = Array.isArray(json?.itemSummaries) ? (json.itemSummaries as unknown[]) : [];
  const listings: Listing[] = [];
  for (const it of items) {
    const l = toListing(it);
    if (l) listings.push(l);
  }
  return listings;
}

/**
 * Creates an eBay marketplace adapter instance.
 *
 * The adapter searches eBay using the product's include terms (or name if
 * no terms specified). Multiple queries are executed with deduplication,
 * and results are limited to the configured maximum.
 *
 * @returns Configured eBay adapter
 *
 * @example
 * ```typescript
 * const ebayAdapter = createEbayAdapter();
 * const listings = await ebayAdapter.search({ product, cfg });
 * ```
 */
export function createEbayAdapter(): MarketplaceAdapter {
  return {
    id: 'ebay',
    search: async ({ product, cfg }: SearchParams) => {
      const max = cfg.settings.maxResultsPerMarketplace;
      const delayMs = cfg.settings.requestDelayMs;

      // Use first 4 include terms as search queries
      const queries = (
        product.includeTerms && product.includeTerms.length > 0
          ? product.includeTerms
          : [product.name]
      ).slice(0, 4);

      const all: Listing[] = [];
      const seen = new Set<string>();

      for (const q of queries) {
        await sleep(delayMs);
        const listings = await retry(() => searchEbayOnce(q, max), {
          retries: 3,
          baseDelayMs: 500,
          label: `ebay.search(${q})`,
        });

        // Deduplicate by sourceId
        for (const l of listings) {
          if (seen.has(l.sourceId)) continue;
          seen.add(l.sourceId);
          all.push(l);
        }
      }

      logger.debug(`eBay returned ${all.length} raw listings for ${product.id}`);
      return all.slice(0, cfg.settings.maxListingsPerProductPerRun);
    },
  };
}
