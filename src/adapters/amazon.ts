/**
 * @fileoverview Amazon marketplace adapter using the Product Advertising API 5.0.
 *
 * This adapter searches Amazon's marketplace for listings using the PA-API
 * with AWS Signature Version 4 authentication. Focuses on used items in the
 * Musical Instruments category. Results are normalized to the common Listing format.
 *
 * Required environment variables:
 * - AMAZON_ACCESS_KEY: AWS access key ID
 * - AMAZON_SECRET_KEY: AWS secret access key
 * - AMAZON_PARTNER_TAG: Amazon Associates partner tag
 *
 * @module adapters/amazon
 * @see https://webservices.amazon.com/paapi5/documentation/
 */

import { createHmac, createHash } from 'crypto';
import { Listing } from '../types';
import { logger } from '../core/logger';
import { sleep } from '../core/sleep';
import { retry } from '../core/retry';
import { MarketplaceAdapter, SearchParams } from './types';

/** AWS service name for PA-API */
const SERVICE = 'ProductAdvertisingAPI';

/** AWS region for PA-API (always us-east-1 for Amazon.com) */
const REGION = 'us-east-1';

/** API endpoint host */
const HOST = 'webservices.amazon.com';

/** Full endpoint URL for SearchItems operation */
const ENDPOINT = `https://${HOST}/paapi5/searchitems`;

/**
 * Computes SHA-256 hash of a string.
 *
 * @param data - String to hash
 * @returns Hex-encoded hash
 * @private
 */
function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Computes HMAC-SHA256 of data using a key.
 *
 * @param key - HMAC key (string or Buffer)
 * @param data - Data to sign
 * @returns HMAC digest as Buffer
 * @private
 */
function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * Derives the AWS Signature Version 4 signing key.
 *
 * @param secretKey - AWS secret access key
 * @param dateStamp - Date in YYYYMMDD format
 * @param region - AWS region
 * @param service - AWS service name
 * @returns Signing key as Buffer
 * @private
 */
function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

/**
 * Signs a request payload using AWS Signature Version 4.
 *
 * Creates the necessary headers for authenticated PA-API requests,
 * including the Authorization header with the computed signature.
 *
 * @param accessKey - AWS access key ID
 * @param secretKey - AWS secret access key
 * @param payload - JSON payload to sign
 * @returns Object containing the signed headers
 * @private
 */
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

/**
 * Parses a money value from Amazon's offer structure.
 *
 * @param offer - Raw offer object from PA-API
 * @returns Parsed money object or null if invalid
 * @private
 */
function parseMoney(offer: any): { amount: number; currency: string } | null {
  const price = offer?.Price?.Amount ?? offer?.SavingBasis?.Amount;
  const currency = offer?.Price?.Currency ?? offer?.SavingBasis?.Currency ?? 'USD';
  if (typeof price !== 'number' || Number.isNaN(price)) return null;
  return { amount: price, currency };
}

/**
 * Converts an Amazon item to a normalized Listing object.
 *
 * Extracts relevant fields from PA-API's item format and
 * normalizes them to the common Listing structure.
 *
 * @param item - Raw item object from PA-API
 * @returns Normalized listing or null if required fields missing
 * @private
 */
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

/**
 * Performs a single search request to Amazon's PA-API.
 *
 * Searches the Musical Instruments category for used items matching the query.
 *
 * @param q - Search query string
 * @param limit - Maximum number of results (PA-API max is 10 per request)
 * @param partnerTag - Amazon Associates partner tag
 * @returns Array of normalized listings
 * @throws Error if credentials are missing or API request fails
 * @private
 */
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

/**
 * Creates an Amazon marketplace adapter instance.
 *
 * The adapter searches Amazon using the product's include terms (or name if
 * no terms specified). Multiple queries are executed with deduplication,
 * and results are limited to the configured maximum.
 *
 * Requires an Amazon Associates account with PA-API access.
 *
 * @returns Configured Amazon adapter
 *
 * @example
 * ```typescript
 * const amazonAdapter = createAmazonAdapter();
 * const listings = await amazonAdapter.search({ product, cfg });
 * ```
 */
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
