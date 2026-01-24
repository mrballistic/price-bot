import fs from 'fs';
import path from 'path';
import { MarketplaceId, SeenEntry, StateFile } from '../types';

const STATE_PATH = path.join(process.cwd(), 'data', 'state.json');
const HISTORY_PATH = path.join(process.cwd(), 'data', 'history.json');

export function readState(): StateFile {
  const raw = fs.readFileSync(STATE_PATH, 'utf-8');
  const state = JSON.parse(raw) as StateFile;
  // minimal guards
  if (!state.seen) {
    state.seen = { ebay: {}, reverb: {} } as any;
  }
  if (!state.seen.ebay) state.seen.ebay = {};
  if (!state.seen.reverb) state.seen.reverb = {};
  return state;
}

export function writeState(state: StateFile): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

export function appendHistory(record: unknown): void {
  const raw = fs.readFileSync(HISTORY_PATH, 'utf-8');
  const arr = JSON.parse(raw) as unknown[];
  arr.push(record);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(arr, null, 2) + '\n', 'utf-8');
}

export function ensureStateBuckets(
  state: StateFile,
  market: MarketplaceId,
  productId: string,
): void {
  state.seen[market] = state.seen[market] || ({} as any);
  state.seen[market][productId] = state.seen[market][productId] || {};
}

export function isSeen(
  state: StateFile,
  market: MarketplaceId,
  productId: string,
  listingId: string,
): boolean {
  return Boolean(state.seen?.[market]?.[productId]?.[listingId]);
}

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

export function nowIso(): string {
  return new Date().toISOString();
}

const SOLD_RETENTION_DAYS = 5;

/**
 * Remove sold items older than SOLD_RETENTION_DAYS from state
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
