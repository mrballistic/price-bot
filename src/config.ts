
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { WatchlistConfig } from './types';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'watchlist.yml');

export function loadConfig(): WatchlistConfig {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const cfg = YAML.parse(raw) as WatchlistConfig;

  if (!cfg?.products || !Array.isArray(cfg.products)) {
    throw new Error('Invalid config: products missing');
  }
  if (!cfg.settings) {
    throw new Error('Invalid config: settings missing');
  }
  return cfg;
}
