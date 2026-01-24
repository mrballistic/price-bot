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

describe('createReverbAdapter', () => {
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
    marketplaces: ['reverb'],
    includeTerms: ['synth'],
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.REVERB_TOKEN = 'test-reverb-token';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('should create adapter with correct id', async () => {
    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    expect(adapter.id).toBe('reverb');
  });

  it('should throw if token is missing', async () => {
    delete process.env.REVERB_TOKEN;

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow('Missing REVERB_TOKEN');
  });

  it('should search and return listings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          listings: [
            {
              id: 123456,
              title: 'Great Synth',
              price: { amount: 299.99, currency: 'USD' },
              shipping: { rate: { amount: 25, currency: 'USD' } },
              condition: 'Excellent',
              shop: { country: 'US' },
              created_at: '2024-01-15T10:00:00Z',
              photos: [{ _links: { full: { href: 'https://images.reverb.com/full.jpg' } } }],
              _links: { web: { href: 'https://reverb.com/item/123456' } },
            },
          ],
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].sourceId).toBe('123456');
    expect(listings[0].title).toBe('Great Synth');
    expect(listings[0].price.amount).toBe(299.99);
    expect(listings[0].shipping?.amount).toBe(25);
    expect(listings[0].shipping?.known).toBe(true);
    expect(listings[0].condition).toBe('Excellent');
    expect(listings[0].location).toBe('US');
  });

  it('should handle unknown shipping', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          listings: [
            {
              id: 123457,
              title: 'Another Synth',
              price: { amount: 199.99, currency: 'USD' },
              // No shipping info
              _links: { web: { href: 'https://reverb.com/item/123457' } },
            },
          ],
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].shipping?.known).toBe(false);
  });

  it('should handle empty search results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ listings: [] }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(0);
  });

  it('should throw on search request failure', async () => {
    const errorResponse = {
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    };

    const fetchMock = vi.fn().mockResolvedValue(errorResponse);

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();

    await expect(adapter.search({ product, cfg: config })).rejects.toThrow(
      'Reverb search error: 401',
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
          listings: [
            {
              id: 'same-id',
              title: 'Synth',
              price: { amount: 100, currency: 'USD' },
              _links: { web: { href: 'https://reverb.com/item/same-id' } },
            },
          ],
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product: productWithMultipleTerms, cfg: config });

    // Both queries return same item, should dedupe
    expect(listings).toHaveLength(1);
  });

  it('should skip items with missing required fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          listings: [
            { id: 'no-title' }, // Missing title, url, price
            {
              id: 'valid',
              title: 'Valid Item',
              price: { amount: 50, currency: 'USD' },
              _links: { web: { href: 'https://reverb.com/item/valid' } },
            },
          ],
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(1);
    expect(listings[0].sourceId).toBe('valid');
  });

  it('should use product name when no include terms', async () => {
    const productNoTerms: ProductConfig = {
      id: 'no-terms',
      name: 'Roland System-8',
      maxPriceUsd: 1000,
      marketplaces: ['reverb'],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ listings: [] }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    await adapter.search({ product: productNoTerms, cfg: config });

    // Check that the URL contains the product name (may use + or %20 for spaces)
    const searchUrl = fetchMock.mock.calls[0][0];
    expect(searchUrl).toMatch(/Roland[+%20]System-8/);
  });

  it('should search by CSP slugs when provided', async () => {
    const productWithSlugs: ProductConfig = {
      ...product,
      reverbProductSlugs: ['roland-system-8'],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          listings: [
            {
              id: 'csp-result',
              title: 'Roland System-8',
              price: { amount: 800, currency: 'USD' },
              _links: { web: { href: 'https://reverb.com/item/csp-result' } },
            },
          ],
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product: productWithSlugs, cfg: config });

    expect(listings.length).toBeGreaterThanOrEqual(1);

    // First call should be to CSP endpoint
    const firstCallUrl = fetchMock.mock.calls[0][0];
    expect(firstCallUrl).toContain('/csps/roland-system-8/listings');
  });

  it('should continue with keyword search if CSP fails', async () => {
    const productWithSlugs: ProductConfig = {
      ...product,
      reverbProductSlugs: ['invalid-slug'],
    };

    const fetchMock = vi
      .fn()
      // CSP request fails
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      })
      // Keyword search succeeds
      .mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            listings: [
              {
                id: 'keyword-result',
                title: 'Synth from keyword',
                price: { amount: 300, currency: 'USD' },
                _links: { web: { href: 'https://reverb.com/item/keyword-result' } },
              },
            ],
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product: productWithSlugs, cfg: config });

    // Should still get results from keyword search
    expect(listings.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle alternative URL formats', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          listings: [
            {
              id: 'alt-url-1',
              title: 'Synth 1',
              price: { amount: 100, currency: 'USD' },
              url: 'https://reverb.com/item/alt-url-1', // Direct url field
            },
            {
              id: 'alt-url-2',
              title: 'Synth 2',
              price: { amount: 200, currency: 'USD' },
              permalink: 'https://reverb.com/item/alt-url-2', // Permalink field
            },
          ],
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(2);
    expect(listings[0].url).toBe('https://reverb.com/item/alt-url-1');
    expect(listings[1].url).toBe('https://reverb.com/item/alt-url-2');
  });

  it('should handle alternative price formats', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          listings: [
            {
              id: 'price-format-1',
              title: 'Synth 1',
              price_with_shipping: { amount: 150, currency: 'USD' },
              _links: { web: { href: 'https://reverb.com/item/price-format-1' } },
            },
            {
              id: 'price-format-2',
              title: 'Synth 2',
              listing_price: { value: '250', currency_code: 'USD' },
              _links: { web: { href: 'https://reverb.com/item/price-format-2' } },
            },
          ],
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings).toHaveLength(2);
    expect(listings[0].price.amount).toBe(150);
    expect(listings[1].price.amount).toBe(250);
  });

  it('should include proper headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ listings: [] }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    await adapter.search({ product, cfg: config });

    const headers = fetchMock.mock.calls[0][1]?.headers;
    expect(headers).toHaveProperty('Authorization', 'Bearer test-reverb-token');
    expect(headers).toHaveProperty('Accept', 'application/json');
    expect(headers).toHaveProperty('Accept-Version', '3.0');
  });

  it('should handle array response format', async () => {
    // Some Reverb endpoints return an array directly instead of { listings: [...] }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'array-item',
            title: 'Synth from array',
            price: { amount: 350, currency: 'USD' },
            _links: { web: { href: 'https://reverb.com/item/array-item' } },
          },
        ]),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { createReverbAdapter } = await import('./reverb');
    const adapter = createReverbAdapter();
    const listings = await adapter.search({ product, cfg: config });

    expect(listings.length).toBeGreaterThanOrEqual(1);
  });
});
