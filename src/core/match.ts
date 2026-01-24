/**
 * @fileoverview Listing matching and filtering logic for the price-bot application.
 *
 * This module provides functions for evaluating whether listings match
 * a product's criteria, including title matching (with regex support),
 * price calculations, and exclusion filtering.
 *
 * @module core/match
 */

import { Listing, Match, ProductConfig, WatchlistConfig } from '../types';
import { logger } from './logger';

/**
 * Default exclusion terms applied to all products.
 * These filter out common accessories, parts, and non-product listings.
 */
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

/**
 * Normalizes a string for case-insensitive comparison.
 *
 * Converts to lowercase, collapses multiple spaces into single spaces,
 * and trims leading/trailing whitespace.
 *
 * @param s - The string to normalize
 * @returns The normalized string
 * @private
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Checks if a term is a regex pattern (wrapped in /.../ or /.../<flags>).
 *
 * Regex patterns allow for more flexible matching than literal substrings.
 * Supported flags: g, i, m, s, u, y
 *
 * @param term - The term to check
 * @returns True if the term is a regex pattern
 *
 * @example
 * ```typescript
 * isRegexPattern('/test/i')     // true
 * isRegexPattern('/\\d+/')      // true
 * isRegexPattern('plain text')  // false
 * ```
 *
 * @private
 */
function isRegexPattern(term: string): boolean {
  return /^\/.*\/[gimsuy]*$/.test(term);
}

/**
 * Parses a regex pattern string into a RegExp object.
 *
 * Extracts the pattern and flags from the string format /pattern/flags.
 * Automatically adds the 'i' flag for case-insensitive matching if not present.
 *
 * @param pattern - The regex pattern string (e.g., "/test/gi")
 * @returns The compiled RegExp, or null if invalid
 *
 * @example
 * ```typescript
 * parseRegex('/test/');      // /test/i
 * parseRegex('/test/g');     // /test/gi
 * parseRegex('/\\d{3}/m');   // /\d{3}/mi
 * parseRegex('invalid');     // null
 * ```
 *
 * @private
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
 * Checks if text matches a term (either literal substring or regex pattern).
 *
 * If the term is a regex pattern (detected by isRegexPattern), it's compiled
 * and tested against the text. Otherwise, a case-insensitive substring
 * search is performed.
 *
 * @param text - The text to search in (should be pre-normalized)
 * @param term - The term to search for (literal or regex pattern)
 * @returns True if the text matches the term
 *
 * @example
 * ```typescript
 * matchesTerm('roland system-8', 'system-8')     // true
 * matchesTerm('roland system-8', '/system-\\d/') // true
 * matchesTerm('roland juno', 'system-8')         // false
 * ```
 *
 * @private
 */
function matchesTerm(text: string, term: string): boolean {
  if (isRegexPattern(term)) {
    const regex = parseRegex(term);
    return regex ? regex.test(text) : false;
  }
  // Literal substring match (case-insensitive via norm)
  return text.includes(norm(term));
}

/**
 * Checks if a listing title passes the product's include/exclude filters.
 *
 * A title passes if:
 * 1. At least one include term matches (if include terms are specified)
 * 2. No exclude terms match (includes DEFAULT_EXCLUDES)
 * 3. Doesn't appear to be an accessory-only listing
 *
 * Both include and exclude terms support regex patterns (wrapped in /.../).
 *
 * @param product - The product configuration with filter terms
 * @param title - The listing title to evaluate
 * @returns True if the title passes all filters
 *
 * @example
 * ```typescript
 * const product = {
 *   id: 'synth',
 *   name: 'Synth',
 *   maxPriceUsd: 500,
 *   marketplaces: ['ebay'],
 *   includeTerms: ['synthesizer', '/synth-\\d+/'],
 *   excludeTerms: ['case', 'cover']
 * };
 *
 * titlePasses(product, 'Roland Synth-8 Synthesizer'); // true
 * titlePasses(product, 'Synth-8 Protective Case');    // false
 * ```
 */
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

/**
 * Result of computing effective price for a listing.
 */
interface EffectivePriceResult {
  /** The calculated effective price in USD */
  effective: number;
  /** Optional note about shipping (e.g., if unknown) */
  shippingNote?: string;
}

/**
 * Computes the effective USD price for a listing.
 *
 * If the configuration specifies to include shipping in the threshold,
 * shipping costs are added to the base price. If shipping is unknown,
 * the base price is used but a note is added to alert the user.
 *
 * @param listing - The listing to compute price for
 * @param cfg - The configuration with shipping settings
 * @returns The effective price and optional shipping note
 *
 * @example
 * ```typescript
 * const result = computeEffectivePriceUsd(listing, config);
 * console.log(`Effective price: $${result.effective}`);
 * if (result.shippingNote) {
 *   console.log(`Note: ${result.shippingNote}`);
 * }
 * ```
 */
export function computeEffectivePriceUsd(
  listing: Listing,
  cfg: WatchlistConfig,
): EffectivePriceResult {
  const price = listing.price.amount;
  const includeShipping = cfg.settings.includeShippingInThreshold;

  if (!includeShipping) return { effective: price };

  const ship = listing.shipping?.amount;
  const shipKnown = listing.shipping?.known !== false && ship !== undefined && !Number.isNaN(ship);

  if (!shipKnown) {
    // Don't block good deals; treat unknown shipping as 0 for threshold,
    // but annotate so the user can verify quickly.
    return { effective: price, shippingNote: 'Shipping unknown (verify on listing)' };
  }

  return { effective: price + (ship ?? 0) };
}

/**
 * Filters listings to find matches for a product based on configured criteria.
 *
 * A listing matches if:
 * 1. Title passes include/exclude filters (titlePasses)
 * 2. Price is in USD (other currencies not yet supported)
 * 3. Effective price is >= minPriceUsd (if set)
 * 4. Effective price is <= maxPriceUsd
 *
 * Results are sorted by effective price (lowest first).
 *
 * @param product - The product configuration with criteria
 * @param listings - Array of listings to filter
 * @param cfg - Global configuration settings
 * @returns Array of matching listings, sorted by price ascending
 *
 * @example
 * ```typescript
 * const matches = filterMatches(product, listings, config);
 * console.log(`Found ${matches.length} matches`);
 * matches.forEach(m => {
 *   console.log(`${m.listing.title}: $${m.effectivePriceUsd}`);
 * });
 * ```
 */
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
