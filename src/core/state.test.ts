import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import {
  readState,
  writeState,
  appendHistory,
  ensureStateBuckets,
  isSeen,
  markSeen,
  nowIso,
  cleanupOldSoldItems,
} from './state';
import { StateFile, SeenEntry } from '../types';

// Mock fs module
vi.mock('fs');

describe('readState', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should read and parse state file', () => {
    const stateData: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {
        ebay: { 'product-1': {} },
        reverb: {},
      },
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(stateData));

    const result = readState();

    expect(result.updatedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result.seen.ebay).toBeDefined();
    expect(result.seen.reverb).toBeDefined();
  });

  it('should initialize missing seen object', () => {
    const stateData = { updatedAt: '2024-01-01T00:00:00.000Z' };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(stateData));

    const result = readState();

    expect(result.seen).toBeDefined();
    expect(result.seen.ebay).toBeDefined();
    expect(result.seen.reverb).toBeDefined();
  });

  it('should initialize missing marketplace buckets', () => {
    const stateData = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {},
    };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(stateData));

    const result = readState();

    expect(result.seen.ebay).toEqual({});
    expect(result.seen.reverb).toEqual({});
  });
});

describe('writeState', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should write state to file as JSON', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: { ebay: {}, reverb: {} },
    };

    writeState(state);

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
    const parsed = JSON.parse((content as string).trim());
    expect(parsed.updatedAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should format JSON with 2-space indentation', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: { ebay: {}, reverb: {} },
    };

    writeState(state);

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(content).toContain('  '); // Has indentation
    expect((content as string).endsWith('\n')).toBe(true); // Ends with newline
  });
});

describe('appendHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should append record to existing history', () => {
    const existingHistory = [{ runAt: '2024-01-01T00:00:00.000Z', matches: 5 }];
    const newRecord = { runAt: '2024-01-02T00:00:00.000Z', matches: 10 };

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingHistory));

    appendHistory(newRecord);

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
    const parsed = JSON.parse((content as string).trim());
    expect(parsed).toHaveLength(2);
    expect(parsed[1].matches).toBe(10);
  });

  it('should handle empty history array', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('[]');
    const newRecord = { runAt: '2024-01-01T00:00:00.000Z' };

    appendHistory(newRecord);

    const [, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
    const parsed = JSON.parse((content as string).trim());
    expect(parsed).toHaveLength(1);
  });
});

describe('ensureStateBuckets', () => {
  it('should create market bucket if missing', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {} as StateFile['seen'],
    };

    ensureStateBuckets(state, 'ebay', 'product-1');

    expect(state.seen.ebay).toBeDefined();
    expect(state.seen.ebay['product-1']).toBeDefined();
  });

  it('should create product bucket if missing', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: { ebay: {}, reverb: {} },
    };

    ensureStateBuckets(state, 'ebay', 'product-1');

    expect(state.seen.ebay['product-1']).toBeDefined();
  });

  it('should not overwrite existing buckets', () => {
    const existingEntry: SeenEntry = {
      firstSeenAt: '2024-01-01T00:00:00.000Z',
      lastSeenAt: '2024-01-01T00:00:00.000Z',
      lastEffectivePrice: 100,
      url: 'https://example.com',
      title: 'Test',
      missedRuns: 0,
    };

    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {
        ebay: { 'product-1': { 'listing-1': existingEntry } },
        reverb: {},
      },
    };

    ensureStateBuckets(state, 'ebay', 'product-1');

    expect(state.seen.ebay['product-1']['listing-1']).toBe(existingEntry);
  });
});

describe('isSeen', () => {
  const baseEntry: SeenEntry = {
    firstSeenAt: '2024-01-01T00:00:00.000Z',
    lastSeenAt: '2024-01-01T00:00:00.000Z',
    lastEffectivePrice: 100,
    url: 'https://example.com',
    title: 'Test',
    missedRuns: 0,
  };

  it('should return true for existing listing', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {
        ebay: { 'product-1': { 'listing-1': baseEntry } },
        reverb: {},
      },
    };

    expect(isSeen(state, 'ebay', 'product-1', 'listing-1')).toBe(true);
  });

  it('should return false for non-existent listing', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {
        ebay: { 'product-1': { 'listing-1': baseEntry } },
        reverb: {},
      },
    };

    expect(isSeen(state, 'ebay', 'product-1', 'listing-2')).toBe(false);
  });

  it('should return false for non-existent product', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: { ebay: {}, reverb: {} },
    };

    expect(isSeen(state, 'ebay', 'product-1', 'listing-1')).toBe(false);
  });

  it('should return false for non-existent marketplace', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {} as StateFile['seen'],
    };

    expect(isSeen(state, 'ebay', 'product-1', 'listing-1')).toBe(false);
  });
});

describe('markSeen', () => {
  it('should add entry to state', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: { ebay: {}, reverb: {} },
    };

    const entry: SeenEntry = {
      firstSeenAt: '2024-01-01T00:00:00.000Z',
      lastSeenAt: '2024-01-01T00:00:00.000Z',
      lastEffectivePrice: 199.99,
      url: 'https://example.com',
      title: 'Test Listing',
      missedRuns: 0,
    };

    markSeen(state, 'ebay', 'product-1', 'listing-123', entry);

    expect(state.seen.ebay['product-1']['listing-123']).toBe(entry);
  });

  it('should create buckets if needed', () => {
    const state: StateFile = {
      updatedAt: '2024-01-01T00:00:00.000Z',
      seen: {} as StateFile['seen'],
    };

    const entry: SeenEntry = {
      firstSeenAt: '2024-01-01T00:00:00.000Z',
      lastSeenAt: '2024-01-01T00:00:00.000Z',
      lastEffectivePrice: 199.99,
      url: 'https://example.com',
      title: 'Test Listing',
      missedRuns: 0,
    };

    markSeen(state, 'reverb', 'product-2', 'listing-456', entry);

    expect(state.seen.reverb['product-2']['listing-456']).toBe(entry);
  });
});

describe('nowIso', () => {
  it('should return ISO 8601 formatted string', () => {
    const result = nowIso();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should return current time', () => {
    const before = Date.now();
    const result = nowIso();
    const after = Date.now();

    const timestamp = new Date(result).getTime();
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

describe('cleanupOldSoldItems', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should remove items sold more than 5 days ago', () => {
    vi.setSystemTime(new Date('2024-01-10T00:00:00.000Z'));

    const state: StateFile = {
      updatedAt: '2024-01-10T00:00:00.000Z',
      seen: {
        ebay: {
          'product-1': {
            'old-sold': {
              firstSeenAt: '2024-01-01T00:00:00.000Z',
              lastSeenAt: '2024-01-03T00:00:00.000Z',
              lastEffectivePrice: 100,
              url: 'https://example.com/1',
              title: 'Old Sold Item',
              missedRuns: 3,
              soldAt: '2024-01-03T00:00:00.000Z', // 7 days ago
            },
          },
        },
        reverb: {},
      },
    };

    const removed = cleanupOldSoldItems(state);

    expect(removed).toBe(1);
    expect(state.seen.ebay['product-1']['old-sold']).toBeUndefined();
  });

  it('should keep items sold less than 5 days ago', () => {
    vi.setSystemTime(new Date('2024-01-10T00:00:00.000Z'));

    const recentEntry: SeenEntry = {
      firstSeenAt: '2024-01-06T00:00:00.000Z',
      lastSeenAt: '2024-01-08T00:00:00.000Z',
      lastEffectivePrice: 200,
      url: 'https://example.com/2',
      title: 'Recent Sold Item',
      missedRuns: 3,
      soldAt: '2024-01-08T00:00:00.000Z', // 2 days ago
    };

    const state: StateFile = {
      updatedAt: '2024-01-10T00:00:00.000Z',
      seen: {
        ebay: {
          'product-1': {
            'recent-sold': recentEntry,
          },
        },
        reverb: {},
      },
    };

    const removed = cleanupOldSoldItems(state);

    expect(removed).toBe(0);
    expect(state.seen.ebay['product-1']['recent-sold']).toBe(recentEntry);
  });

  it('should keep active listings (not sold)', () => {
    vi.setSystemTime(new Date('2024-01-10T00:00:00.000Z'));

    const activeEntry: SeenEntry = {
      firstSeenAt: '2024-01-01T00:00:00.000Z',
      lastSeenAt: '2024-01-10T00:00:00.000Z',
      lastEffectivePrice: 300,
      url: 'https://example.com/3',
      title: 'Active Item',
      missedRuns: 0,
    };

    const state: StateFile = {
      updatedAt: '2024-01-10T00:00:00.000Z',
      seen: {
        ebay: {
          'product-1': {
            active: activeEntry,
          },
        },
        reverb: {},
      },
    };

    const removed = cleanupOldSoldItems(state);

    expect(removed).toBe(0);
    expect(state.seen.ebay['product-1']['active']).toBe(activeEntry);
  });

  it('should handle multiple marketplaces and products', () => {
    vi.setSystemTime(new Date('2024-01-10T00:00:00.000Z'));

    const state: StateFile = {
      updatedAt: '2024-01-10T00:00:00.000Z',
      seen: {
        ebay: {
          'product-1': {
            'old-1': {
              firstSeenAt: '2024-01-01T00:00:00.000Z',
              lastSeenAt: '2024-01-02T00:00:00.000Z',
              lastEffectivePrice: 100,
              url: 'https://example.com/1',
              title: 'Old 1',
              missedRuns: 3,
              soldAt: '2024-01-02T00:00:00.000Z',
            },
          },
          'product-2': {
            'old-2': {
              firstSeenAt: '2024-01-01T00:00:00.000Z',
              lastSeenAt: '2024-01-01T00:00:00.000Z',
              lastEffectivePrice: 150,
              url: 'https://example.com/2',
              title: 'Old 2',
              missedRuns: 3,
              soldAt: '2024-01-01T00:00:00.000Z',
            },
          },
        },
        reverb: {
          'product-1': {
            'old-3': {
              firstSeenAt: '2024-01-01T00:00:00.000Z',
              lastSeenAt: '2024-01-03T00:00:00.000Z',
              lastEffectivePrice: 200,
              url: 'https://example.com/3',
              title: 'Old 3',
              missedRuns: 3,
              soldAt: '2024-01-03T00:00:00.000Z',
            },
          },
        },
      },
    };

    const removed = cleanupOldSoldItems(state);

    expect(removed).toBe(3);
  });
});
