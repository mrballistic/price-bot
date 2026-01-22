
import { Listing } from '../types';
import { logger } from '../core/logger';
import { sleep } from '../core/sleep';
import { retry } from '../core/retry';
import { MarketplaceAdapter, SearchParams } from './types';

type EbayToken = { access_token: string; expires_in: number; token_type: string };

let cachedToken: { token: string; expiresAt: number } | null = null;

function getEbayBaseUrl(): string {
  const env = (process.env.EBAY_ENV || 'production').toLowerCase();
  return env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
}

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

function parseMoney(val: any): { amount: number; currency: string } | null {
  const v = val?.value ?? val?.amount ?? val;
  const c = val?.currency ?? val?.currencyCode;
  const num = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (Number.isNaN(num) || !c) return null;
  return { amount: num, currency: String(c) };
}

function toListing(item: any): Listing | null {
  const id = item?.itemId || item?.legacyItemId;
  const title = item?.title;
  const url = item?.itemWebUrl;
  const price = parseMoney(item?.price);
  if (!id || !title || !url || !price) return null;

  const ship0 = item?.shippingOptions?.[0]?.shippingCost;
  const shippingParsed = parseMoney(ship0);
  const shipping = shippingParsed
    ? { ...shippingParsed, known: true }
    : { amount: 0, currency: price.currency, known: false };

  const img = item?.image?.imageUrl;

  return {
    source: 'ebay',
    sourceId: String(id),
    title: String(title),
    url: String(url),
    price,
    shipping,
    imageUrl: img ? String(img) : undefined,
    condition: item?.condition ? String(item.condition) : undefined,
    location: item?.itemLocation?.country ? String(item.itemLocation.country) : undefined,
    listedAt: item?.itemCreationDate ? String(item.itemCreationDate) : undefined,
  };
}

async function searchEbayOnce(q: string, limit: number): Promise<Listing[]> {
  const token = await getAccessToken();
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';

  const url = new URL(`${getEbayBaseUrl()}/buy/browse/v1/item_summary/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  // You can optionally add browse API filters later; we keep it minimal for robustness.

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

  const json = (await resp.json()) as any;
  const items = Array.isArray(json?.itemSummaries) ? json.itemSummaries : [];
  const listings: Listing[] = [];
  for (const it of items) {
    const l = toListing(it);
    if (l) listings.push(l);
  }
  return listings;
}

export function createEbayAdapter(): MarketplaceAdapter {
  return {
    id: 'ebay',
    search: async ({ product, cfg }: SearchParams) => {
      const max = cfg.settings.maxResultsPerMarketplace;
      const delayMs = cfg.settings.requestDelayMs;

      const queries = (product.includeTerms && product.includeTerms.length > 0
        ? product.includeTerms
        : [product.name]
      ).slice(0, 4);

      const all: Listing[] = [];
      const seen = new Set<string>();

      for (const q of queries) {
        await sleep(delayMs);
        const listings = await retry(
          () => searchEbayOnce(q, max),
          { retries: 3, baseDelayMs: 500, label: `ebay.search(${q})` },
        );

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
