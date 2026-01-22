import { createHmac, createHash } from 'crypto';
import { Listing } from '../types';
import { logger } from '../core/logger';
import { sleep } from '../core/sleep';
import { retry } from '../core/retry';
import { MarketplaceAdapter, SearchParams } from './types';

const SERVICE = 'ProductAdvertisingAPI';
const REGION = 'us-east-1';
const HOST = 'webservices.amazon.com';
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

function signRequest(
  accessKey: string,
  secretKey: string,
  payload: string,
): { headers: Record<string, string> } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: HOST,
    'x-amz-date': amzDate,
    'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join('');

  const canonicalRequest = [
    'POST',
    '/paapi5/searchitems',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256(canonicalRequest)].join('\n');

  const signingKey = getSignatureKey(secretKey, dateStamp, REGION, SERVICE);
  const signature = hmacSha256(signingKey, stringToSign).toString('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      ...headers,
      Authorization: authorization,
    },
  };
}

function parseMoney(offer: any): { amount: number; currency: string } | null {
  const price = offer?.Price?.Amount ?? offer?.SavingBasis?.Amount;
  const currency = offer?.Price?.Currency ?? offer?.SavingBasis?.Currency ?? 'USD';
  if (typeof price !== 'number' || Number.isNaN(price)) return null;
  return { amount: price, currency };
}

function toListing(item: any): Listing | null {
  const asin = item?.ASIN;
  const title = item?.ItemInfo?.Title?.DisplayValue;
  const url = item?.DetailPageURL;

  // Get price from offers
  const offers = item?.Offers?.Listings?.[0];
  const price = parseMoney(offers);

  if (!asin || !title || !url || !price) return null;

  // Shipping - Amazon often includes it or offers Prime
  const deliveryInfo = offers?.DeliveryInfo;
  const shipping = deliveryInfo?.IsFreeShippingEligible
    ? { amount: 0, currency: price.currency, known: true }
    : { amount: 0, currency: price.currency, known: false };

  const img = item?.Images?.Primary?.Large?.URL || item?.Images?.Primary?.Medium?.URL;
  const condition = offers?.Condition?.Value;

  return {
    source: 'amazon',
    sourceId: asin,
    title: String(title),
    url: String(url),
    price,
    shipping,
    imageUrl: img ? String(img) : undefined,
    condition: condition ? String(condition) : undefined,
    location: 'US', // Amazon US marketplace
  };
}

async function searchAmazonOnce(q: string, limit: number, partnerTag: string): Promise<Listing[]> {
  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error('Missing AMAZON_ACCESS_KEY/AMAZON_SECRET_KEY');
  }

  const payload = JSON.stringify({
    Keywords: q,
    Resources: [
      'Images.Primary.Large',
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'Offers.Listings.Condition',
      'Offers.Listings.DeliveryInfo.IsFreeShippingEligible',
    ],
    SearchIndex: 'MusicalInstruments',
    ItemCount: Math.min(limit, 10), // PA-API max is 10 per request
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.com',
    Condition: 'Used', // Focus on used items for deals
  });

  const { headers } = signRequest(accessKey, secretKey, payload);

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: payload,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Amazon search error: ${resp.status} ${txt}`);
  }

  const json = (await resp.json()) as any;

  // Check for API errors
  if (json.Errors) {
    const errMsg = json.Errors.map((e: any) => e.Message).join('; ');
    throw new Error(`Amazon API error: ${errMsg}`);
  }

  const items = json?.SearchResult?.Items ?? [];
  const listings: Listing[] = [];

  for (const item of items) {
    const l = toListing(item);
    if (l) listings.push(l);
  }

  return listings;
}

export function createAmazonAdapter(): MarketplaceAdapter {
  return {
    id: 'amazon',
    search: async ({ product, cfg }: SearchParams) => {
      const partnerTag = process.env.AMAZON_PARTNER_TAG;
      if (!partnerTag) {
        throw new Error('Missing AMAZON_PARTNER_TAG');
      }

      const max = cfg.settings.maxResultsPerMarketplace;
      const delayMs = cfg.settings.requestDelayMs;

      const queries = (
        product.includeTerms && product.includeTerms.length > 0 ? product.includeTerms : [product.name]
      ).slice(0, 4);

      const all: Listing[] = [];
      const seen = new Set<string>();

      for (const q of queries) {
        await sleep(delayMs);
        const listings = await retry(() => searchAmazonOnce(q, max, partnerTag), {
          retries: 3,
          baseDelayMs: 500,
          label: `amazon.search(${q})`,
        });

        for (const l of listings) {
          if (seen.has(l.sourceId)) continue;
          seen.add(l.sourceId);
          all.push(l);
        }
      }

      logger.debug(`Amazon returned ${all.length} raw listings for ${product.id}`);
      return all.slice(0, cfg.settings.maxListingsPerProductPerRun);
    },
  };
}
