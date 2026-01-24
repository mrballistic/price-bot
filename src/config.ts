/**
 * @fileoverview Configuration loader for the price-bot application.
 *
 * This module handles loading and validating the watchlist configuration
 * from the YAML config file. The configuration defines which products
 * to watch, price thresholds, and application settings.
 *
 * @module config
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { WatchlistConfig } from './types';

/** Path to the watchlist configuration file. */
const CONFIG_PATH = path.join(process.cwd(), 'config', 'watchlist.yml');

/**
 * Loads and validates the watchlist configuration from disk.
 *
 * Reads the YAML configuration file from config/watchlist.yml,
 * parses it, and performs basic validation to ensure required
 * fields are present.
 *
 * @returns The parsed and validated configuration
 * @throws If the config file cannot be read or is invalid
 *
 * @example
 * ```typescript
 * const config = loadConfig();
 * console.log(`Watching ${config.products.length} products`);
 * ```
 */
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
