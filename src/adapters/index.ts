import { MarketplaceAdapter } from './types';
import { createEbayAdapter } from './ebay';
import { createReverbAdapter } from './reverb';

export function getAdapters(): Record<string, MarketplaceAdapter> {
  return {
    ebay: createEbayAdapter(),
    reverb: createReverbAdapter(),
  };
}
