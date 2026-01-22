import { Listing } from '../types';
import { logger } from '../core/logger';
import { sleep } from '../core/sleep';
import { retry } from '../core/retry';
import { MarketplaceAdapter, SearchParams } from './types';

function parseMoney(val: any): { amount: number; currency: string } | null {
  const v = val?.amount ?? val?.value ?? val;
  const c = val?.currency ?? val?.currency_code ?? val?.currencyCode;
  const num = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (Number.isNaN(num) || !c) return null;
  return { amount: num, currency: String(c) };
}

function pickWebUrl(listing: any): string | null {
  const href = listing?._links?.web?.href || listing?._links?.web?.url;
  if (href) return String(href);
  if (listing?.url) return String(listing.url);
  if (listing?.permalink) return String(listing.permalink);
  return null;
}

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

export function createReverbAdapter(): MarketplaceAdapter {
  return {
    id: 'reverb',
    search: async ({ product, cfg }: SearchParams) => {
      const max = cfg.settings.maxResultsPerMarketplace;
      const delayMs = cfg.settings.requestDelayMs;

      const queries = (
        product.includeTerms && product.includeTerms.length > 0
          ? product.includeTerms
          : [product.name]
      ).slice(0, 4);

      const all: Listing[] = [];
      const seen = new Set<string>();

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
