import { Listing, MarketplaceId, ProductConfig, WatchlistConfig } from '../types';

export type SearchParams = {
  product: ProductConfig;
  cfg: WatchlistConfig;
};

export interface MarketplaceAdapter {
  id: MarketplaceId;
  search(params: SearchParams): Promise<Listing[]>;
}
