export type MarketplaceId = 'ebay' | 'reverb' | 'amazon';

export type Money = {
  amount: number;
  currency: string;
  known?: boolean; // for optional shipping
};

export type Listing = {
  source: MarketplaceId;
  sourceId: string;
  url: string;
  title: string;
  price: Money;
  shipping?: Money;
  imageUrl?: string;
  condition?: string;
  location?: string;
  listedAt?: string; // ISO if available
};

export type ProductConfig = {
  id: string;
  name: string;
  minPriceUsd?: number;
  maxPriceUsd: number;
  marketplaces: MarketplaceId[];
  includeTerms?: string[];
  excludeTerms?: string[];
  reverbProductSlugs?: string[]; // Reverb CSP slugs for direct product queries
};

export type WatchlistConfig = {
  products: ProductConfig[];
  settings: {
    currency: string;
    includeShippingInThreshold: boolean;
    maxResultsPerMarketplace: number;
    requestDelayMs: number;
    maxEmbedsPerDiscordMessage: number;
    maxListingsPerProductPerRun: number;
  };
};

export type SeenEntry = {
  firstSeenAt: string;
  lastSeenAt: string;
  lastEffectivePrice: number;
  url: string;
  title: string;
  // Sold tracking
  missedRuns?: number; // consecutive runs where listing wasn't found
  soldAt?: string; // ISO timestamp when marked as sold (after 3 missed runs)
};

export type StateFile = {
  version: number;
  updatedAt: string | null;
  seen: Record<MarketplaceId, Record<string, Record<string, SeenEntry>>>;
};

export type Match = {
  productId: string;
  productName: string;
  maxPriceUsd: number;
  listing: Listing;
  effectivePriceUsd: number;
  shippingNote?: string;
  priceDrop?: {
    previousPrice: number;
    dropAmount: number;
  };
};

export type MarketStats = {
  count: number;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  medianPrice: number | null;
  // Sample listings at different price points (low, mid, high)
  samples: Array<{
    title: string;
    price: number;
    url: string;
    source: MarketplaceId;
    listedAt?: string; // ISO timestamp if available
  }>;
};

export type RunRecord = {
  runAt: string;
  durationMs: number;
  scanned: number;
  matches: number;
  alerts: number;
  errors: Array<{ marketplace: MarketplaceId; productId: string; message: string }>;
  byProduct: Array<{
    productId: string;
    productName: string;
    thresholdUsd: number;
    scanned: number;
    matches: Match[];
    marketStats?: MarketStats;
  }>;
};
