import { MarketplaceAdapter } from './types';
import { createEbayAdapter } from './ebay';
import { createReverbAdapter } from './reverb';
import { createAmazonAdapter } from './amazon';

export function getAdapters(): Record<string, MarketplaceAdapter> {
  return {
    ebay: createEbayAdapter(),
    reverb: createReverbAdapter(),
    amazon: createAmazonAdapter(),
  };
}
