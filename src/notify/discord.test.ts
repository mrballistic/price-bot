import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendDiscordAlerts } from './discord';
import { Match, WatchlistConfig } from '../types';

// Mock the logger
vi.mock('../core/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('sendDiscordAlerts', () => {
  const originalEnv = process.env.DISCORD_WEBHOOK_URL;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const config: WatchlistConfig = {
    products: [],
    settings: {
      currency: 'USD',
      includeShippingInThreshold: true,
      maxResultsPerMarketplace: 50,
      requestDelayMs: 500,
      maxEmbedsPerDiscordMessage: 10,
      maxListingsPerProductPerRun: 100,
    },
  };

  const makeMatch = (overrides: Partial<Match> = {}): Match => ({
    productId: 'test-product',
    productName: 'Test Product',
    maxPriceUsd: 500,
    listing: {
      source: 'ebay',
      sourceId: 'listing-123',
      url: 'https://ebay.com/item/123',
      title: 'Great Synth Deal',
      price: { amount: 300, currency: 'USD' },
      shipping: { amount: 20, currency: 'USD', known: true },
      imageUrl: 'https://example.com/image.jpg',
      condition: 'Used',
    },
    effectivePriceUsd: 320,
    ...overrides,
  });

  beforeEach(() => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    } as Response);
  });

  afterEach(() => {
    process.env.DISCORD_WEBHOOK_URL = originalEnv;
    fetchSpy.mockRestore();
  });

  it('should throw if DISCORD_WEBHOOK_URL is not set', async () => {
    delete process.env.DISCORD_WEBHOOK_URL;

    await expect(
      sendDiscordAlerts([makeMatch()], config, '2024-01-01T00:00:00.000Z'),
    ).rejects.toThrow('Missing DISCORD_WEBHOOK_URL');
  });

  it('should return 0 for empty matches array', async () => {
    const result = await sendDiscordAlerts([], config, '2024-01-01T00:00:00.000Z');

    expect(result).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should send webhook with correct payload structure', async () => {
    const matches = [makeMatch()];

    await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);

    expect(body.content).toContain('Test Product');
    expect(body.embeds).toHaveLength(1);
    expect(body.embeds[0].title).toBe('Great Synth Deal');
    expect(body.embeds[0].url).toBe('https://ebay.com/item/123');
  });

  it('should include price fields in embed', async () => {
    const matches = [makeMatch()];

    await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    const fields = body.embeds[0].fields;

    const priceField = fields.find((f: { name: string }) => f.name === 'Price');
    const shippingField = fields.find((f: { name: string }) => f.name === 'Shipping');
    const effectiveField = fields.find((f: { name: string }) => f.name === 'Effective');

    expect(priceField.value).toBe('$300.00');
    expect(shippingField.value).toBe('$20.00');
    expect(effectiveField.value).toBe('$320.00');
  });

  it('should show Unknown for unknown shipping', async () => {
    const matches = [
      makeMatch({
        listing: {
          source: 'ebay',
          sourceId: 'listing-123',
          url: 'https://ebay.com/item/123',
          title: 'Test Item',
          price: { amount: 300, currency: 'USD' },
          shipping: { amount: 0, currency: 'USD', known: false },
        },
      }),
    ];

    await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    const shippingField = body.embeds[0].fields.find(
      (f: { name: string }) => f.name === 'Shipping',
    );

    expect(shippingField.value).toBe('Unknown');
  });

  it('should include image in embed when available', async () => {
    const matches = [makeMatch()];

    await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);

    expect(body.embeds[0].image).toEqual({ url: 'https://example.com/image.jpg' });
  });

  it('should handle price drops with special formatting', async () => {
    const matches = [
      makeMatch({
        priceDrop: {
          previousPrice: 400,
          dropAmount: 80,
        },
      }),
    ];

    await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);

    // Price drop title prefix
    expect(body.embeds[0].title).toContain('\u{1F4C9}'); // 📉
    // Green color for price drops
    expect(body.embeds[0].color).toBe(0x00ff00);
    // Price drop field
    const dropField = body.embeds[0].fields.find((f: { name: string }) =>
      f.name.includes('Price Drop'),
    );
    expect(dropField).toBeDefined();
    expect(dropField.value).toContain('$400.00');
    expect(dropField.value).toContain('$80.00');
  });

  it('should chunk messages when exceeding maxEmbedsPerDiscordMessage', async () => {
    const configWithSmallChunk: WatchlistConfig = {
      ...config,
      settings: { ...config.settings, maxEmbedsPerDiscordMessage: 2 },
    };

    const matches = [
      makeMatch({ listing: { ...makeMatch().listing, sourceId: '1' } }),
      makeMatch({ listing: { ...makeMatch().listing, sourceId: '2' } }),
      makeMatch({ listing: { ...makeMatch().listing, sourceId: '3' } }),
    ];

    await sendDiscordAlerts(matches, configWithSmallChunk, '2024-01-01T00:00:00.000Z');

    // Should send 2 webhook calls (2 embeds + 1 embed)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should return count of sent alerts', async () => {
    const matches = [
      makeMatch({ listing: { ...makeMatch().listing, sourceId: '1' } }),
      makeMatch({ listing: { ...makeMatch().listing, sourceId: '2' } }),
    ];

    const result = await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    expect(result).toBe(2);
  });

  it('should throw on webhook failure', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    } as Response);

    await expect(
      sendDiscordAlerts([makeMatch()], config, '2024-01-01T00:00:00.000Z'),
    ).rejects.toThrow('Discord webhook failed: 429');
  });

  it('should include condition in embed when available', async () => {
    const matches = [makeMatch()];

    await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    const conditionField = body.embeds[0].fields.find(
      (f: { name: string }) => f.name === 'Condition',
    );

    expect(conditionField).toBeDefined();
    expect(conditionField.value).toBe('Used');
  });

  it('should include shipping note when present', async () => {
    const matches = [
      makeMatch({
        shippingNote: 'Shipping unknown (verify on listing)',
      }),
    ];

    await sendDiscordAlerts(matches, config, '2024-01-01T00:00:00.000Z');

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);
    const noteField = body.embeds[0].fields.find((f: { name: string }) => f.name === 'Note');

    expect(noteField).toBeDefined();
    expect(noteField.value).toContain('unknown');
  });
});
