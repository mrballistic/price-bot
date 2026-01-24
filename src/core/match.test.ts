import { describe, it, expect } from 'vitest';
import { titlePasses, computeEffectivePriceUsd, filterMatches } from './match';
import { Listing, ProductConfig, WatchlistConfig } from '../types';

describe('titlePasses', () => {
  const baseProduct: ProductConfig = {
    id: 'test',
    name: 'Test Product',
    maxPriceUsd: 500,
    marketplaces: ['ebay'],
  };

  it('should pass when no include terms are specified', () => {
    expect(titlePasses(baseProduct, 'Any random title')).toBe(true);
  });

  it('should pass when title matches an include term', () => {
    const product = { ...baseProduct, includeTerms: ['synth', 'keyboard'] };
    expect(titlePasses(product, 'Roland Synth Module')).toBe(true);
    expect(titlePasses(product, 'MIDI Keyboard Controller')).toBe(true);
  });

  it('should fail when title matches no include terms', () => {
    const product = { ...baseProduct, includeTerms: ['synth', 'keyboard'] };
    expect(titlePasses(product, 'Guitar Amplifier')).toBe(false);
  });

  it('should fail when title matches an exclude term', () => {
    const product = { ...baseProduct, excludeTerms: ['case', 'cover'] };
    expect(titlePasses(product, 'Synth Carrying Case')).toBe(false);
    expect(titlePasses(product, 'Protective Cover for Keyboard')).toBe(false);
  });

  it('should apply default excludes', () => {
    // Default excludes include 'decksaver', 'manual', 'parts', etc.
    expect(titlePasses(baseProduct, 'Decksaver Cover')).toBe(false);
    expect(titlePasses(baseProduct, 'User Manual PDF')).toBe(false);
    expect(titlePasses(baseProduct, 'For Parts or Repair')).toBe(false);
  });

  it('should support regex patterns in include terms', () => {
    const product = { ...baseProduct, includeTerms: ['/system-\\d+/i'] };
    expect(titlePasses(product, 'Roland System-8 Synthesizer')).toBe(true);
    expect(titlePasses(product, 'SYSTEM-1M Module')).toBe(true);
    expect(titlePasses(product, 'Some Other Synth')).toBe(false);
  });

  it('should support regex patterns in exclude terms', () => {
    const product = { ...baseProduct, excludeTerms: ['/mk\\s*ii/i'] };
    expect(titlePasses(product, 'Synth MK II Version')).toBe(false);
    expect(titlePasses(product, 'Synth MKII')).toBe(false);
    expect(titlePasses(product, 'Synth Original')).toBe(true);
  });

  it('should be case-insensitive for literal matches', () => {
    const product = { ...baseProduct, includeTerms: ['SYNTH'] };
    expect(titlePasses(product, 'synth module')).toBe(true);
    expect(titlePasses(product, 'SYNTH MODULE')).toBe(true);
    expect(titlePasses(product, 'Synth Module')).toBe(true);
  });
});

describe('computeEffectivePriceUsd', () => {
  const baseListing: Listing = {
    source: 'ebay',
    sourceId: '123',
    url: 'https://example.com',
    title: 'Test Item',
    price: { amount: 100, currency: 'USD' },
  };

  const configWithShipping: WatchlistConfig = {
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

  const configWithoutShipping: WatchlistConfig = {
    ...configWithShipping,
    settings: { ...configWithShipping.settings, includeShippingInThreshold: false },
  };

  it('should return just the price when shipping is not included', () => {
    const result = computeEffectivePriceUsd(baseListing, configWithoutShipping);
    expect(result.effective).toBe(100);
    expect(result.shippingNote).toBeUndefined();
  });

  it('should add shipping to price when configured', () => {
    const listing = {
      ...baseListing,
      shipping: { amount: 15, currency: 'USD', known: true },
    };
    const result = computeEffectivePriceUsd(listing, configWithShipping);
    expect(result.effective).toBe(115);
    expect(result.shippingNote).toBeUndefined();
  });

  it('should note when shipping is unknown', () => {
    const listing = {
      ...baseListing,
      shipping: { amount: 0, currency: 'USD', known: false },
    };
    const result = computeEffectivePriceUsd(listing, configWithShipping);
    expect(result.effective).toBe(100);
    expect(result.shippingNote).toContain('unknown');
  });

  it('should handle missing shipping data', () => {
    const result = computeEffectivePriceUsd(baseListing, configWithShipping);
    expect(result.effective).toBe(100);
    expect(result.shippingNote).toContain('unknown');
  });
});

describe('filterMatches', () => {
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

  const product: ProductConfig = {
    id: 'synth',
    name: 'Test Synth',
    minPriceUsd: 100,
    maxPriceUsd: 500,
    marketplaces: ['ebay'],
    includeTerms: ['synth'],
  };

  const makeListing = (overrides: Partial<Listing> = {}): Listing => ({
    source: 'ebay',
    sourceId: Math.random().toString(),
    url: 'https://example.com',
    title: 'Test Synth Module',
    price: { amount: 300, currency: 'USD' },
    shipping: { amount: 20, currency: 'USD', known: true },
    ...overrides,
  });

  it('should return matches under the threshold', () => {
    const listings = [makeListing({ price: { amount: 400, currency: 'USD' } })];
    const matches = filterMatches(product, listings, config);
    expect(matches).toHaveLength(1);
    expect(matches[0].effectivePriceUsd).toBe(420); // 400 + 20 shipping
  });

  it('should exclude listings above the threshold', () => {
    const listings = [makeListing({ price: { amount: 500, currency: 'USD' } })];
    const matches = filterMatches(product, listings, config);
    expect(matches).toHaveLength(0); // 500 + 20 = 520 > 500
  });

  it('should exclude listings below minPrice', () => {
    const listings = [makeListing({ price: { amount: 50, currency: 'USD' } })];
    const matches = filterMatches(product, listings, config);
    expect(matches).toHaveLength(0); // 50 + 20 = 70 < 100
  });

  it('should exclude listings that fail title filters', () => {
    const listings = [makeListing({ title: 'Guitar Amp' })];
    const matches = filterMatches(product, listings, config);
    expect(matches).toHaveLength(0);
  });

  it('should sort matches by effective price ascending', () => {
    const listings = [
      makeListing({ sourceId: 'a', price: { amount: 400, currency: 'USD' } }),
      makeListing({ sourceId: 'b', price: { amount: 200, currency: 'USD' } }),
      makeListing({ sourceId: 'c', price: { amount: 300, currency: 'USD' } }),
    ];
    const matches = filterMatches(product, listings, config);
    expect(matches.map((m) => m.effectivePriceUsd)).toEqual([220, 320, 420]);
  });

  it('should exclude non-USD currencies', () => {
    const listings = [makeListing({ price: { amount: 300, currency: 'EUR' } })];
    const matches = filterMatches(product, listings, config);
    expect(matches).toHaveLength(0);
  });
});
