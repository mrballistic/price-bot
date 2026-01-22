
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

export function ensureStateBuckets(state: StateFile, market: MarketplaceId, productId: string): void {
  state.seen[market] = state.seen[market] || ({} as any);
  state.seen[market][productId] = state.seen[market][productId] || {};
}

export function isSeen(state: StateFile, market: MarketplaceId, productId: string, listingId: string): boolean {
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
