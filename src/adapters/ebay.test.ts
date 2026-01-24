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

describe('createEbayAdapter', () => {
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
    marketplaces: ['ebay'],
    includeTerms: ['synth'],
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.EBAY_CLIENT_ID = 'test-client-id';
    process.env.EBAY_CLIENT_SECRET = 'test-client-secret';
    delete process.env.EBAY_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('should create adapter with correct id', async () => {
    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    expect(adapter.id).toBe('ebay');
  });

  it('should throw if credentials are missing', async () => {
    delete process.env.EBAY_CLIENT_ID;
    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow(
      'Missing EBAY_CLIENT_ID/EBAY_CLIENT_SECRET',
    );
  });

  it('should authenticate and search', async () => {
    const fetchMock = vi
      .fn()
      // Token response
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 7200,
          }),
      })
      // Search response
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                itemId: 'item-123',
                title: 'Great Synth',
                itemWebUrl: 'https://ebay.com/item/123',
                price: { value: '299.99', currency: 'USD' },
                shippingOptions: [{ shippingCost: { value: '15.00', currency: 'USD' } }],
                image: { imageUrl: 'https://example.com/image.jpg' },
                condition: 'Used',
                itemLocation: { country: 'US' },
              },
            ],
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].sourceId).toBe('item-123');
    expect(listings[0].title).toBe('Great Synth');
    expect(listings[0].price.amount).toBe(299.99);
    expect(listings[0].shipping?.amount).toBe(15);
    expect(listings[0].shipping?.known).toBe(true);
  });

  it('should handle missing shipping info', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                itemId: 'item-456',
                title: 'Another Synth',
                itemWebUrl: 'https://ebay.com/item/456',
                price: { value: '199.99', currency: 'USD' },
              },
            ],
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].shipping?.known).toBe(false);
  });

  it('should handle empty search results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(0);
  });

  it('should use sandbox URL when EBAY_ENV=sandbox', async () => {
    process.env.EBAY_ENV = 'sandbox';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ itemSummaries: [] }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    await adapter.search({ product, cfg: config });

    expect(fetchMock.mock.calls[0][0]).toContain('api.sandbox.ebay.com');
  });

  it('should deduplicate listings across queries', async () => {
    const productWithMultipleTerms: ProductConfig = {
      ...product,
      includeTerms: ['synth', 'synthesizer'],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 7200 }),
      })
      // First query
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                itemId: 'same-item',
                title: 'Synth',
                itemWebUrl: 'https://ebay.com/item/same',
                price: { value: '100', currency: 'USD' },
              },
            ],
          }),
      })
      // Second query returns the same item
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              {
                itemId: 'same-item',
                title: 'Synth',
                itemWebUrl: 'https://ebay.com/item/same',
                price: { value: '100', currency: 'USD' },
              },
            ],
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    const listings = await adapter.search({ product: productWithMultipleTerms, cfg: config });

    expect(listings).toHaveLength(1);
  });

  it('should skip items with missing required fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            itemSummaries: [
              { itemId: 'no-title' }, // Missing title, url, price
              {
                itemId: 'valid',
                title: 'Valid Item',
                itemWebUrl: 'https://ebay.com/valid',
                price: { value: '50', currency: 'USD' },
              },
            ],
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].sourceId).toBe('valid');
  });

  it('should throw on search request failure', async () => {
    const errorResponse = {
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 7200 }),
      })
      // Retry mechanism will call search multiple times
      .mockResolvedValue(errorResponse);

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow(
      'eBay search error: 500',
    );
  });

  it('should use product name when no include terms', async () => {
    const productNoTerms: ProductConfig = {
      id: 'no-terms',
      name: 'Roland System-8',
      maxPriceUsd: 1000,
      marketplaces: ['ebay'],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token', expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ itemSummaries: [] }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createEbayAdapter } = await import('./ebay');
    const adapter = createEbayAdapter();
    await adapter.search({ product: productNoTerms, cfg: config });

    const searchCall = fetchMock.mock.calls[1];
    // URL may use + or %20 for spaces
    expect(searchCall[0]).toMatch(/Roland[+%20]System-8/);
  });
});
