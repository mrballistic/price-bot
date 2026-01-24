import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { loadConfig } from './config';

// Mock fs module
vi.mock('fs');

describe('loadConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load and parse valid YAML config', () => {
    const validConfig = `
products:
  - id: test-product
    name: Test Product
    maxPriceUsd: 500
    marketplaces:
      - ebay
settings:
  currency: USD
  includeShippingInThreshold: true
  maxResultsPerMarketplace: 50
  requestDelayMs: 500
  maxEmbedsPerDiscordMessage: 10
  maxListingsPerProductPerRun: 100
`;

    vi.mocked(fs.readFileSync).mockReturnValue(validConfig);

    const config = loadConfig();

    expect(config.products).toHaveLength(1);
    expect(config.products[0].id).toBe('test-product');
    expect(config.settings.currency).toBe('USD');
  });

  it('should throw if products is missing', () => {
    const invalidConfig = `
settings:
  currency: USD
`;

    vi.mocked(fs.readFileSync).mockReturnValue(invalidConfig);

    expect(() => loadConfig()).toThrow('Invalid config: products missing');
  });

  it('should throw if products is not an array', () => {
    const invalidConfig = `
products: "not an array"
settings:
  currency: USD
`;

    vi.mocked(fs.readFileSync).mockReturnValue(invalidConfig);

    expect(() => loadConfig()).toThrow('Invalid config: products missing');
  });

  it('should throw if settings is missing', () => {
    const invalidConfig = `
products:
  - id: test
    name: Test
    maxPriceUsd: 100
    marketplaces:
      - ebay
`;

    vi.mocked(fs.readFileSync).mockReturnValue(invalidConfig);

    expect(() => loadConfig()).toThrow('Invalid config: settings missing');
  });

  it('should handle products with all optional fields', () => {
    const fullConfig = `
products:
  - id: full-product
    name: Full Product
    maxPriceUsd: 1000
    minPriceUsd: 100
    marketplaces:
      - ebay
      - reverb
    includeTerms:
      - synth
      - keyboard
    excludeTerms:
      - case
      - cover
settings:
  currency: USD
  includeShippingInThreshold: true
  maxResultsPerMarketplace: 50
  requestDelayMs: 500
  maxEmbedsPerDiscordMessage: 10
  maxListingsPerProductPerRun: 100
`;

    vi.mocked(fs.readFileSync).mockReturnValue(fullConfig);

    const config = loadConfig();

    expect(config.products[0].minPriceUsd).toBe(100);
    expect(config.products[0].includeTerms).toContain('synth');
    expect(config.products[0].excludeTerms).toContain('case');
    expect(config.products[0].marketplaces).toHaveLength(2);
  });

  it('should handle empty products array', () => {
    const emptyProducts = `
products: []
settings:
  currency: USD
  includeShippingInThreshold: true
  maxResultsPerMarketplace: 50
  requestDelayMs: 500
  maxEmbedsPerDiscordMessage: 10
  maxListingsPerProductPerRun: 100
`;

    vi.mocked(fs.readFileSync).mockReturnValue(emptyProducts);

    const config = loadConfig();

    expect(config.products).toHaveLength(0);
  });
});
