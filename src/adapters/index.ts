/**
 * @fileoverview Marketplace adapter registry and factory.
 *
 * This module provides the central registry of all available marketplace
 * adapters. It instantiates and exports adapters for each supported
 * marketplace (eBay, Reverb, Amazon).
 *
 * @module adapters/index
 */

import { MarketplaceAdapter } from './types';
import { createEbayAdapter } from './ebay';
import { createReverbAdapter } from './reverb';
import { createAmazonAdapter } from './amazon';

/**
 * Creates and returns all available marketplace adapters.
 *
 * Each adapter is instantiated with its default configuration.
 * The returned record maps marketplace IDs to their adapter instances.
 *
 * @returns Map of marketplace ID to adapter instance
 *
 * @example
 * ```typescript
 * const adapters = getAdapters();
 *
 * // Search a specific marketplace
 * const listings = await adapters.ebay.search({ product, cfg });
 *
 * // Iterate all adapters
 * for (const [id, adapter] of Object.entries(adapters)) {
 *   const results = await adapter.search({ product, cfg });
 * }
 * ```
 */
export function getAdapters(): Record<string, MarketplaceAdapter> {
  return {
    ebay: createEbayAdapter(),
    reverb: createReverbAdapter(),
    amazon: createAmazonAdapter(),
  };
}
