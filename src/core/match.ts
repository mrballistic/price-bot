import { Listing, Match, ProductConfig, WatchlistConfig } from '../types';
import { logger } from './logger';

const DEFAULT_EXCLUDES = [
  'deck saver',
  'decksaver',
  'overlay',
  'template',
  'manual',
  'knob',
  'stand',
  'parts',
  'repair',
  'broken',
  'for parts',
  'power supply',
  'adapter',
];

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Check if a term is a regex pattern (wrapped in /.../ or /.../<flags>)
 */
function isRegexPattern(term: string): boolean {
  return /^\/.*\/[gimsuy]*$/.test(term);
}

/**
 * Parse a regex pattern string like /pattern/flags into a RegExp
 */
function parseRegex(pattern: string): RegExp | null {
  const match = pattern.match(/^\/(.*)\/([gimsuy]*)$/);
  if (!match) return null;
  try {
    // Always add 'i' flag for case-insensitive matching unless already specified
    const flags = match[2].includes('i') ? match[2] : match[2] + 'i';
    return new RegExp(match[1], flags);
  } catch (e) {
    logger.warn(`Invalid regex pattern: ${pattern}`);
    return null;
  }
}

/**
 * Check if text matches a term (either literal substring or regex pattern)
 */
function matchesTerm(text: string, term: string): boolean {
  if (isRegexPattern(term)) {
    const regex = parseRegex(term);
    return regex ? regex.test(text) : false;
  }
  // Literal substring match (case-insensitive via norm)
  return text.includes(norm(term));
}

export function titlePasses(product: ProductConfig, title: string): boolean {
  const t = norm(title);

  const includeTerms = (product.includeTerms ?? []).filter(Boolean);
  const excludeTerms = Array.from(
    new Set([...(product.excludeTerms ?? []), ...DEFAULT_EXCLUDES]),
  ).filter(Boolean);

  // Must match at least one include term if provided.
  if (includeTerms.length > 0) {
    const ok = includeTerms.some((term) => matchesTerm(t, term));
    if (!ok) return false;
  }

  // Excludes
  if (excludeTerms.some((term) => term && matchesTerm(t, term))) return false;

  // Heuristic: reject listings that look like *only* accessories (e.g., "System-8 case")
  // If the title contains accessory words AND does not contain "roland" for these two products, reject.
  const accessoryWords = ['case', 'cover', 'deck', 'decksaver', 'overlay', 'template'];
  const hasAccessory = accessoryWords.some((w) => t.includes(w));
  if (hasAccessory && !t.includes('roland')) return false;

  return true;
}

export function computeEffectivePriceUsd(
  listing: Listing,
  cfg: WatchlistConfig,
): { effective: number; shippingNote?: string } {
  const price = listing.price.amount;
  const includeShipping = cfg.settings.includeShippingInThreshold;

  if (!includeShipping) return { effective: price };

  const ship = listing.shipping?.amount;
  const shipKnown = listing.shipping?.known !== false && ship !== undefined && !Number.isNaN(ship);

  if (!shipKnown) {
    // Don’t block good deals; treat unknown shipping as 0 for threshold,
    // but annotate so the user can verify quickly.
    return { effective: price, shippingNote: 'Shipping unknown (verify on listing)' };
  }

  return { effective: price + (ship ?? 0) };
}

export function filterMatches(
  product: ProductConfig,
  listings: Listing[],
  cfg: WatchlistConfig,
): Match[] {
  const out: Match[] = [];

  for (const l of listings) {
    if (!titlePasses(product, l.title)) continue;

    // Only evaluate USD thresholds for now; if currency differs, skip (future: FX).
    if (norm(l.price.currency) !== 'usd') continue;

    const { effective, shippingNote } = computeEffectivePriceUsd(l, cfg);

    // Check min price (skip accessories priced too low)
    if (product.minPriceUsd !== undefined && effective < product.minPriceUsd) continue;

    // Check max price
    if (effective <= product.maxPriceUsd) {
      out.push({
        productId: product.id,
        productName: product.name,
        maxPriceUsd: product.maxPriceUsd,
        listing: l,
        effectivePriceUsd: effective,
        shippingNote,
      });
    }
  }

  // sort best-first
  out.sort((a, b) => a.effectivePriceUsd - b.effectivePriceUsd);
  return out;
}
