/**
 * @fileoverview State and history persistence for the price-bot application.
 *
 * This module handles reading and writing the application's persistent state,
 * including the seen listings database (for de-duplication and price tracking)
 * and the run history (for dashboard display).
 *
 * State is stored in data/state.json and history in data/history.json.
 *
 * @module core/state
 */

import fs from 'fs';
import path from 'path';
import { MarketplaceId, SeenEntry, StateFile } from '../types';

/** Path to the state file that tracks seen listings. */
const STATE_PATH = path.join(process.cwd(), 'data', 'state.json');

/** Path to the history file that stores run records. */
const HISTORY_PATH = path.join(process.cwd(), 'data', 'history.json');

/** Number of days to retain sold items before cleanup. */
const SOLD_RETENTION_DAYS = 5;

/**
 * Reads and parses the state file from disk.
 *
 * Performs basic initialization of missing nested structures to ensure
 * the returned state object has all required marketplace buckets.
 *
 * @returns The parsed state file with initialized structures
 * @throws If the state file cannot be read or parsed
 *
 * @example
 * ```typescript
 * const state = readState();
 * const ebayListings = state.seen.ebay['product-id'];
 * ```
 */
export function readState(): StateFile {
  const raw = fs.readFileSync(STATE_PATH, 'utf-8');
  const state = JSON.parse(raw) as StateFile;
  // Initialize missing marketplace buckets
  if (!state.seen) {
    state.seen = { ebay: {}, reverb: {} } as StateFile['seen'];
  }
  if (!state.seen.ebay) state.seen.ebay = {};
  if (!state.seen.reverb) state.seen.reverb = {};
  return state;
}

/**
 * Writes the state file to disk.
 *
 * Serializes the state object to JSON with pretty formatting
 * and writes it atomically to the state file path.
 *
 * @param state - The state object to persist
 *
 * @example
 * ```typescript
 * state.updatedAt = new Date().toISOString();
 * writeState(state);
 * ```
 */
export function writeState(state: StateFile): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

/**
 * Appends a run record to the history file.
 *
 * Reads the existing history array, appends the new record,
 * and writes the updated array back to disk.
 *
 * @param record - The run record to append (typically a RunRecord)
 *
 * @example
 * ```typescript
 * const record: RunRecord = {
 *   runAt: new Date().toISOString(),
 *   durationMs: 15000,
 *   scanned: 100,
 *   // ... other fields
 * };
 * appendHistory(record);
 * ```
 */
export function appendHistory(record: unknown): void {
  const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
  const arr = JSON.parse(raw) as unknown[];
  arr.push(record);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(arr, null, 2) + '\n', 'utf-8');
}

/**
 * Ensures that nested state buckets exist for a marketplace/product combination.
 *
 * Creates empty objects at each level of the state.seen hierarchy if they
 * don't already exist. This prevents null reference errors when accessing
 * or writing to nested paths.
 *
 * @param state - The state object to modify
 * @param market - The marketplace identifier
 * @param productId - The product identifier
 *
 * @example
 * ```typescript
 * ensureStateBuckets(state, 'ebay', 'my-product');
 * state.seen.ebay['my-product']['listing-123'] = entry;
 * ```
 */
export function ensureStateBuckets(
  state: StateFile,
  market: MarketplaceId,
  productId: string,
): void {
  state.seen[market] = state.seen[market] || ({} as Record<string, Record<string, SeenEntry>>);
  state.seen[market][productId] = state.seen[market][productId] || {};
}

/**
 * Checks if a listing has been seen before.
 *
 * @param state - The state object to check
 * @param market - The marketplace identifier
 * @param productId - The product identifier
 * @param listingId - The listing's source ID
 * @returns True if the listing exists in state, false otherwise
 *
 * @example
 * ```typescript
 * if (isSeen(state, 'reverb', 'product-1', 'listing-abc')) {
 *   console.log('Already tracked this listing');
 * }
 * ```
 */
export function isSeen(
  state: StateFile,
  market: MarketplaceId,
  productId: string,
  listingId: string,
): boolean {
  return Boolean(state.seen?.[market]?.[productId]?.[listingId]);
}

/**
 * Records a listing as seen in the state.
 *
 * Ensures the necessary nested buckets exist and then stores
 * the entry at the appropriate path in the state structure.
 *
 * @param state - The state object to modify
 * @param market - The marketplace identifier
 * @param productId - The product identifier
 * @param listingId - The listing's source ID
 * @param entry - The entry data to store
 *
 * @example
 * ```typescript
 * markSeen(state, 'ebay', 'my-product', 'item-123', {
 *   firstSeenAt: new Date().toISOString(),
 *   lastSeenAt: new Date().toISOString(),
 *   lastEffectivePrice: 199.99,
 *   url: 'https://ebay.com/...',
 *   title: 'Product Name'
 * });
 * ```
 */
export function markSeen(
  state: StateFile,
  market: MarketplaceId,
  productId: string,
  listingId: string,
  entry: SeenEntry,
): void {
  ensureStateBuckets(state, market, productId);
  state.seen[market][productId][listingId] = entry;
}

/**
 * Returns the current timestamp as an ISO 8601 string.
 *
 * Convenience function for consistent timestamp formatting
 * throughout the application.
 *
 * @returns Current time in ISO 8601 format
 *
 * @example
 * ```typescript
 * const timestamp = nowIso(); // "2024-01-15T10:30:00.000Z"
 * ```
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Removes sold items older than the retention period from state.
 *
 * Iterates through all tracked listings and removes any that have
 * a `soldAt` timestamp older than SOLD_RETENTION_DAYS (5 days).
 * This prevents the state file from growing indefinitely with
 * historical sold items.
 *
 * @param state - The state object to clean up
 * @returns The number of items removed
 *
 * @example
 * ```typescript
 * const removed = cleanupOldSoldItems(state);
 * if (removed > 0) {
 *   console.log(`Cleaned up ${removed} old sold items`);
 * }
 * writeState(state);
 * ```
 */
export function cleanupOldSoldItems(state: StateFile): number {
  const cutoff = Date.now() - SOLD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;

  for (const market of Object.keys(state.seen) as MarketplaceId[]) {
    for (const productId of Object.keys(state.seen[market] || {})) {
      const listings = state.seen[market][productId];
      for (const listingId of Object.keys(listings || {})) {
        const entry = listings[listingId];
        if (entry.soldAt && new Date(entry.soldAt).getTime() < cutoff) {
          delete listings[listingId];
          removed++;
        }
      }
    }
  }

  return removed;
}
