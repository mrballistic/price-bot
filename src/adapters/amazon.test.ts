import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProductConfig, WatchlistConfig } from '../types';

// Mock logger and sleep
vi.mock('../core/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../core/sleep', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

describe('createAmazonAdapter', () => {
  const originalEnv = { ...process.env };

  const config: WatchlistConfig = {
    products: [],
    settings: {
      currency: 'USD',
      includeShippingInThreshold: true,
      maxResultsPerMarketplace: 50,
      requestDelayMs: 100,
      maxEmbedsPerDiscordMessage: 10,
      maxListingsPerProductPerRun: 100,
    },
  };

  const product: ProductConfig = {
    id: 'test-synth',
    name: 'Test Synth',
    maxPriceUsd: 500,
    marketplaces: ['amazon'],
    includeTerms: ['synth'],
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.AMAZON_ACCESS_KEY = 'test-access-key';
    process.env.AMAZON_SECRET_KEY = 'test-secret-key';
    process.env.AMAZON_PARTNER_TAG = 'test-partner-tag';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('should create adapter with correct id', async () => {
    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    expect(adapter.id).toBe('amazon');
  });

  it('should throw if partner tag is missing', async () => {
    delete process.env.AMAZON_PARTNER_TAG;
    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow(
      'Missing AMAZON_PARTNER_TAG',
    );
  });

  it('should throw if credentials are missing', async () => {
    delete process.env.AMAZON_ACCESS_KEY;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ SearchResult: { Items: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow(
      'Missing AMAZON_ACCESS_KEY/AMAZON_SECRET_KEY',
    );
  });

  it('should search and return listings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          SearchResult: {
            Items: [
              {
                ASIN: 'B01234567',
                ItemInfo: { Title: { DisplayValue: 'Great Synth' } },
                DetailPageURL: 'https://amazon.com/dp/B01234567',
                Offers: {
                  Listings: [
                    {
                      Price: { Amount: 299.99, Currency: 'USD' },
                      Condition: { Value: 'Used' },
                      DeliveryInfo: { IsFreeShippingEligible: true },
                    },
                  ],
                },
                Images: {
                  Primary: { Large: { URL: 'https://images.amazon.com/large.jpg' } },
                },
              },
            ],
          },
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].sourceId).toBe('B01234567');
    expect(listings[0].title).toBe('Great Synth');
    expect(listings[0].price.amount).toBe(299.99);
    expect(listings[0].shipping?.known).toBe(true);
    expect(listings[0].shipping?.amount).toBe(0);
  });

  it('should handle unknown shipping', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          SearchResult: {
            Items: [
              {
                ASIN: 'B01234567',
                ItemInfo: { Title: { DisplayValue: 'Another Synth' } },
                DetailPageURL: 'https://amazon.com/dp/B01234567',
                Offers: {
                  Listings: [
                    {
                      Price: { Amount: 199.99, Currency: 'USD' },
                      Condition: { Value: 'Used' },
                      // No DeliveryInfo
                    },
                  ],
                },
              },
            ],
          },
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].shipping?.known).toBe(false);
  });

  it('should handle empty search results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ SearchResult: { Items: [] } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(0);
  });

  it('should handle API errors in response', async () => {
    const errorResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          Errors: [{ Message: 'Rate limit exceeded' }],
        }),
    };

    const fetchMock = vi.fn().mockResolvedValue(errorResponse);

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow(
      'Amazon API error: Rate limit exceeded',
    );
  });

  it('should throw on search request failure', async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    };

    const fetchMock = vi.fn().mockResolvedValue(errorResponse);

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow(
      'Amazon search error: 500',
    );
  });

  it('should deduplicate listings across queries', async () => {
    const productWithMultipleTerms: ProductConfig = {
      ...product,
      includeTerms: ['synth', 'synthesizer'],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          SearchResult: {
            Items: [
              {
                ASIN: 'same-asin',
                ItemInfo: { Title: { DisplayValue: 'Synth' } },
                DetailPageURL: 'https://amazon.com/dp/same-asin',
                Offers: {
                  Listings: [{ Price: { Amount: 100, Currency: 'USD' } }],
                },
              },
            ],
          },
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    const listings = await adapter.search({ product: productWithMultipleTerms, cfg: config });

    // Both queries return same item, should dedupe
    expect(listings).toHaveLength(1);
  });

  it('should skip items with missing required fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          SearchResult: {
            Items: [
              { ASIN: 'no-title' }, // Missing title, url, price
              {
                ASIN: 'valid',
                ItemInfo: { Title: { DisplayValue: 'Valid Item' } },
                DetailPageURL: 'https://amazon.com/dp/valid',
                Offers: {
                  Listings: [{ Price: { Amount: 50, Currency: 'USD' } }],
                },
              },
            ],
          },
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].sourceId).toBe('valid');
  });

  it('should use product name when no include terms', async () => {
    const productNoTerms: ProductConfig = {
      id: 'no-terms',
      name: 'Roland System-8',
      maxPriceUsd: 1000,
      marketplaces: ['amazon'],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ SearchResult: { Items: [] } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    await adapter.search({ product: productNoTerms, cfg: config });

    // Check that the payload contains the product name
    const callBody = JSON.parse(fetchMock.mock.calls[0][1]?.body);
    expect(callBody.Keywords).toBe('Roland System-8');
  });

  it('should include proper AWS signature headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ SearchResult: { Items: [] } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    await adapter.search({ product, cfg: config });

    const headers = fetchMock.mock.calls[0][1]?.headers;
    expect(headers).toHaveProperty('Authorization');
    expect(headers.Authorization).toContain('AWS4-HMAC-SHA256');
    expect(headers).toHaveProperty('x-amz-date');
    expect(headers).toHaveProperty('x-amz-target');
  });

  it('should use SavingBasis price when Price is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          SearchResult: {
            Items: [
              {
                ASIN: 'B01234567',
                ItemInfo: { Title: { DisplayValue: 'Synth Deal' } },
                DetailPageURL: 'https://amazon.com/dp/B01234567',
                Offers: {
                  Listings: [
                    {
                      SavingBasis: { Amount: 399.99, Currency: 'USD' },
                      Condition: { Value: 'Used' },
                    },
                  ],
                },
              },
            ],
          },
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createAmazonAdapter } = await import('./amazon');
    const adapter = createAmazonAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].price.amount).toBe(399.99);
  });
});
