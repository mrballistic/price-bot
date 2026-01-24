/**
 * @fileoverview Discord webhook notification sender.
 *
 * This module handles sending deal alerts to Discord via webhooks.
 * It formats matching listings as rich embeds with images, pricing
 * information, and marketplace details. Supports both new listing
 * alerts and price drop notifications.
 *
 * @module notify/discord
 */

import { Match, WatchlistConfig } from '../types';
import { logger } from '../core/logger';

/**
 * Discord embed object structure.
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
type DiscordEmbed = {
  /** Embed title (listing title) */
  title?: string;
  /** URL the title links to */
  url?: string;
  /** Embed description text */
  description?: string;
  /** ISO 8601 timestamp */
  timestamp?: string;
  /** Embed color as decimal (e.g., 0x00ff00 for green) */
  color?: number;
  /** Array of field objects */
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  /** Image object with url property */
  image?: { url: string };
  /** Footer object with text property */
  footer?: { text: string };
};

/**
 * Discord webhook payload structure.
 */
type DiscordPayload = {
  /** Plain text message content */
  content?: string;
  /** Array of embed objects (max 10) */
  embeds?: DiscordEmbed[];
};

/**
 * Formats a number as USD currency string.
 *
 * @param n - The number to format
 * @returns Formatted string like "$199.99"
 * @private
 */
function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Sends Discord webhook alerts for matching listings.
 *
 * Creates rich embed messages for each match, including:
 * - Listing title with link to marketplace
 * - Price, shipping, and effective price fields
 * - Marketplace and condition information
 * - Product image if available
 * - Price drop highlighting (green color, special emoji)
 *
 * Messages are chunked to respect Discord's 10 embed per message limit.
 * The DISCORD_WEBHOOK_URL environment variable must be set.
 *
 * @param matches - Array of matches to send alerts for
 * @param cfg - Configuration with embed settings
 * @param runAtIso - ISO 8601 timestamp of the run (for embed timestamps)
 * @returns Number of alerts successfully sent
 * @throws If DISCORD_WEBHOOK_URL is not set or webhook request fails
 *
 * @example
 * ```typescript
 * const matches = filterMatches(product, listings, config);
 * const freshMatches = matches.filter(m => !isSeen(...));
 *
 * const sent = await sendDiscordAlerts(freshMatches, config, new Date().toISOString());
 * console.log(`Sent ${sent} Discord alerts`);
 * ```
 */
export async function sendDiscordAlerts(
  matches: Match[],
  cfg: WatchlistConfig,
  runAtIso: string,
): Promise<number> {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) throw new Error('Missing DISCORD_WEBHOOK_URL');

  if (matches.length === 0) return 0;

  const maxEmbeds = cfg.settings.maxEmbedsPerDiscordMessage ?? 10;

  // Discord supports up to 10 embeds per message for webhooks; we chunk accordingly.
  const chunks: Match[][] = [];
  for (let i = 0; i < matches.length; i += maxEmbeds) {
    chunks.push(matches.slice(i, i + maxEmbeds));
  }

  let sent = 0;

  for (const chunk of chunks) {
    const productName = chunk[0]?.productName ?? 'Deal';
    const threshold = chunk[0]?.maxPriceUsd ?? 0;

    const embeds: DiscordEmbed[] = chunk.map((m) => {
      const l = m.listing;
      const shippingText =
        l.shipping?.known === false
          ? 'Unknown'
          : l.shipping
            ? fmtUsd(l.shipping.amount)
            : 'Unknown';

      const fields = [
        { name: 'Price', value: fmtUsd(l.price.amount), inline: true },
        { name: 'Shipping', value: shippingText, inline: true },
        { name: 'Effective', value: fmtUsd(m.effectivePriceUsd), inline: true },
        { name: 'Marketplace', value: l.source, inline: true },
      ];

      if (l.condition) fields.push({ name: 'Condition', value: l.condition, inline: true });
      if (m.shippingNote) fields.push({ name: 'Note', value: m.shippingNote, inline: false });

      // Add price drop info if applicable
      if (m.priceDrop) {
        fields.push({
          name: '📉 Price Drop',
          value: `Was ${fmtUsd(m.priceDrop.previousPrice)} → Now ${fmtUsd(m.effectivePriceUsd)} (−${fmtUsd(m.priceDrop.dropAmount)})`,
          inline: false,
        });
      }

      const isPriceDrop = !!m.priceDrop;
      const footerText = isPriceDrop
        ? `${productName} • PRICE DROP • threshold <= $${threshold}`
        : `${productName} • threshold <= $${threshold}`;

      return {
        title: isPriceDrop ? `📉 ${l.title}` : l.title,
        url: l.url,
        timestamp: runAtIso,
        color: isPriceDrop ? 0x00ff00 : undefined, // Green for price drops
        fields,
        image: l.imageUrl ? { url: l.imageUrl } : undefined,
        footer: { text: footerText },
      };
    });

    const priceDropCount = chunk.filter((m) => m.priceDrop).length;
    const newListingCount = chunk.length - priceDropCount;

    let content = `🎹 **Deal alert:** ${productName} (<= $${threshold})\n`;
    if (newListingCount > 0 && priceDropCount > 0) {
      content += `Found **${newListingCount}** new listing(s) and **${priceDropCount}** price drop(s).`;
    } else if (priceDropCount > 0) {
      content += `📉 **${priceDropCount}** price drop(s) detected!`;
    } else {
      content += `Found **${newListingCount}** new listing(s).`;
    }

    const payload: DiscordPayload = {
      content,
      embeds,
    };

    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      logger.error(`Discord webhook failed: ${resp.status} ${txt}`);
      throw new Error(`Discord webhook failed: ${resp.status} ${txt}`);
    }

    sent += chunk.length;
  }

  return sent;
}
