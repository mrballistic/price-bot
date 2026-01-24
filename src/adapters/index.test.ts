import { describe, it, expect } from 'vitest';
import { getAdapters } from './index';

describe('getAdapters', () => {
  it('should return adapters for all supported marketplaces', () => {
    const adapters = getAdapters();

    expect(adapters.ebay).toBeDefined();
    expect(adapters.reverb).toBeDefined();
    expect(adapters.amazon).toBeDefined();
  });

  it('should return adapters with correct IDs', () => {
    const adapters = getAdapters();

    expect(adapters.ebay.id).toBe('ebay');
    expect(adapters.reverb.id).toBe('reverb');
    expect(adapters.amazon.id).toBe('amazon');
  });

  it('should return adapters with search functions', () => {
    const adapters = getAdapters();

    expect(typeof adapters.ebay.search).toBe('function');
    expect(typeof adapters.reverb.search).toBe('function');
    expect(typeof adapters.amazon.search).toBe('function');
  });

  it('should return new adapter instances each call', () => {
    const adapters1 = getAdapters();
    const adapters2 = getAdapters();

    expect(adapters1.ebay).not.toBe(adapters2.ebay);
    expect(adapters1.reverb).not.toBe(adapters2.reverb);
  });
});
