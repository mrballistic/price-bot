/**
 * @fileoverview Type definitions for marketplace adapters.
 *
 * This module defines the common interface that all marketplace adapters
 * must implement, ensuring consistent behavior across different marketplaces
 * (eBay, Reverb, Amazon).
 *
 * @module adapters/types
 */

import { Listing, MarketplaceId, ProductConfig, WatchlistConfig } from '../types';

/**
 * Parameters passed to adapter search functions.
 */
export type SearchParams = {
  /** The product configuration with search terms and thresholds */
  product: ProductConfig;
  /** Global application configuration */
  cfg: WatchlistConfig;
};

/**
 * Interface that all marketplace adapters must implement.
 *
 * Each marketplace (eBay, Reverb, Amazon) has an adapter that implements
 * this interface, providing a consistent way to search for listings
 * across different platforms.
 *
 * @example
 * ```typescript
 * const adapter: MarketplaceAdapter = {
 *   id: 'ebay',
 *   async search({ product, cfg }) {
 *     // Implement eBay-specific search logic
 *     return listings;
 *   }
 * };
 * ```
 */
export interface MarketplaceAdapter {
  /** The unique marketplace identifier. */
  id: MarketplaceId;

  /**
   * Searches the marketplace for listings matching the product criteria.
   *
   * Should query the marketplace's API using the product's include terms,
   * normalize the results to the common Listing format, and filter to
   * US-based sellers only.
   *
   * @param params - Search parameters including product config and global settings
   * @returns Array of normalized listings from this marketplace
   * @throws If the API request fails or authentication is invalid
   */
  search(params: SearchParams): Promise<Listing[]>;
}
