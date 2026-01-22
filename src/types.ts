
export type MarketplaceId = 'ebay' | 'reverb';

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
  maxPriceUsd: number;
  marketplaces: MarketplaceId[];
  includeTerms?: string[];
  excludeTerms?: string[];
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
  }>;
};
