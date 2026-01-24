/**
 * @fileoverview Core type definitions for the price-bot application.
 *
 * This module defines all shared TypeScript types used across the application,
 * including marketplace identifiers, listing data structures, configuration types,
 * state management types, and run record types for history tracking.
 *
 * @module types
 */

/**
 * Supported marketplace identifiers.
 * Each marketplace has a corresponding adapter in the adapters directory.
 */
export type MarketplaceId = 'ebay' | 'reverb' | 'amazon';

/**
 * Represents a monetary value with currency information.
 * Used for prices, shipping costs, and other financial data.
 */
export type Money = {
  /** The numeric value of the money */
  amount: number;
  /** ISO 4217 currency code (e.g., 'USD', 'EUR') */
  currency: string;
  /** Whether the value is confirmed (used for shipping where cost may be unknown) */
  known?: boolean;
};

/**
 * Represents a single listing from any marketplace.
 * This is the normalized format that all marketplace adapters convert their data to.
 */
export type Listing = {
  /** Which marketplace this listing came from */
  source: MarketplaceId;
  /** The unique identifier from the source marketplace */
  sourceId: string;
  /** Direct link to the listing on the marketplace */
  url: string;
  /** The listing title/name */
  title: string;
  /** The asking price */
  price: Money;
  /** Shipping cost if available */
  shipping?: Money;
  /** URL to the listing's primary image */
  imageUrl?: string;
  /** Item condition (e.g., 'Used', 'Excellent', 'Mint') */
  condition?: string;
  /** Seller location/country */
  location?: string;
  /** ISO 8601 timestamp of when the item was listed */
  listedAt?: string;
};

/**
 * Configuration for a single product to watch.
 * Defines search terms, price thresholds, and which marketplaces to search.
 */
export type ProductConfig = {
  /** Unique identifier for this product (used in state tracking) */
  id: string;
  /** Human-readable product name for display */
  name: string;
  /** Minimum price filter (excludes accessories/parts priced too low) */
  minPriceUsd?: number;
  /** Maximum price threshold for alerts */
  maxPriceUsd: number;
  /** Which marketplaces to search */
  marketplaces: MarketplaceId[];
  /** Search terms (at least one must match). Supports regex patterns wrapped in /pattern/flags */
  includeTerms?: string[];
  /** Exclusion terms (none can match). Supports regex patterns */
  excludeTerms?: string[];
  /** Reverb CSP slugs for direct product queries (advanced) */
  reverbProductSlugs?: string[];
};

/**
 * Root configuration loaded from config/watchlist.yml.
 * Contains all products to watch and global settings.
 */
export type WatchlistConfig = {
  /** Array of products to monitor */
  products: ProductConfig[];
  /** Global application settings */
  settings: {
    /** Default currency for price comparisons */
    currency: string;
    /** Whether to add shipping to price when comparing to threshold */
    includeShippingInThreshold: boolean;
    /** Max listings to fetch per marketplace per product */
    maxResultsPerMarketplace: number;
    /** Delay between API requests to avoid rate limiting */
    requestDelayMs: number;
    /** Max embeds per Discord webhook call */
    maxEmbedsPerDiscordMessage: number;
    /** Max listings to process per product per run */
    maxListingsPerProductPerRun: number;
  };
};

/**
 * Represents a previously-seen listing in the state file.
 * Used for de-duplication, price drop detection, and sold tracking.
 */
export type SeenEntry = {
  /** ISO 8601 timestamp of first discovery */
  firstSeenAt: string;
  /** ISO 8601 timestamp of most recent sighting */
  lastSeenAt: string;
  /** Last known effective price (including shipping if configured) */
  lastEffectivePrice: number;
  /** Listing URL for reference */
  url: string;
  /** Listing title for reference */
  title: string;
  /** Count of consecutive runs where this listing wasn't found (for sold tracking) */
  missedRuns?: number;
  /** ISO 8601 timestamp when marked as sold (after 3 consecutive missed runs) */
  soldAt?: string;
};

/**
 * Structure of the data/state.json file.
 * Persists seen listings across runs for de-duplication and tracking.
 */
export type StateFile = {
  /** Schema version for future migrations */
  version: number;
  /** ISO 8601 timestamp of last update */
  updatedAt: string | null;
  /** Nested map: marketplace -> productId -> listingSourceId -> SeenEntry */
  seen: Record<MarketplaceId, Record<string, Record<string, SeenEntry>>>;
};

/**
 * Represents a listing that matched a product's criteria.
 * Contains the listing data plus matching context.
 */
export type Match = {
  /** ID of the product this matched */
  productId: string;
  /** Name of the product for display */
  productName: string;
  /** The threshold this listing was under */
  maxPriceUsd: number;
  /** The full listing data */
  listing: Listing;
  /** Price including shipping (if configured) */
  effectivePriceUsd: number;
  /** Note about shipping (e.g., "Shipping unknown") */
  shippingNote?: string;
  /** Present if this is a price drop alert */
  priceDrop?: {
    /** The previous effective price */
    previousPrice: number;
    /** How much the price dropped */
    dropAmount: number;
  };
};

/**
 * Market statistics for a product across all searched listings.
 * Calculated from all listings that pass title filters (ignoring price thresholds).
 */
export type MarketStats = {
  /** Total number of listings found */
  count: number;
  /** Lowest effective price found */
  minPrice: number | null;
  /** Highest effective price found */
  maxPrice: number | null;
  /** Average effective price */
  avgPrice: number | null;
  /** Median effective price */
  medianPrice: number | null;
  /** Sample listings at various price points for reference */
  samples: Array<{
    /** Listing title */
    title: string;
    /** Effective price */
    price: number;
    /** Listing URL */
    url: string;
    /** Which marketplace */
    source: MarketplaceId;
    /** When the item was listed (ISO 8601) */
    listedAt?: string;
  }>;
};

/**
 * A single run record stored in data/history.json.
 * Contains summary statistics and per-product details for dashboard display.
 */
export type RunRecord = {
  /** ISO 8601 timestamp of when the run started */
  runAt: string;
  /** How long the run took in milliseconds */
  durationMs: number;
  /** Total listings scanned across all products/marketplaces */
  scanned: number;
  /** Total matches found (under threshold) */
  matches: number;
  /** Total Discord alerts sent (new matches only) */
  alerts: number;
  /** Any errors that occurred during the run */
  errors: Array<{
    /** Which marketplace failed */
    marketplace: MarketplaceId;
    /** Which product was being searched */
    productId: string;
    /** Error message */
    message: string;
  }>;
  /** Per-product breakdown */
  byProduct: Array<{
    /** Product identifier */
    productId: string;
    /** Product display name */
    productName: string;
    /** Alert threshold for this product */
    thresholdUsd: number;
    /** Listings scanned for this product */
    scanned: number;
    /** All matches found */
    matches: Match[];
    /** Market pricing statistics */
    marketStats?: MarketStats;
  }>;
};
