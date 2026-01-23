# Discord embed layout

The bot uses a scannable embed format that's quick to evaluate:

## New listing alerts

- Message header:
  - 🎹 **Deal alert:** <Product> (<= $threshold)
  - Found **N** new listing(s).

- Each listing is an **embed**:
  - **Title**: listing title (clickable)
  - **Fields**:
    - Price
    - Shipping (Unknown if not available)
    - Effective (price + shipping if known)
    - Marketplace
    - Condition (if available)
    - Note (e.g., shipping unknown)
  - **Image** (if provided)
  - **Footer**: Product name • threshold <= $X

## Price-drop alerts

When a previously-seen listing drops below threshold:

- Message header:
  - 🎹 **Deal alert:** <Product> (<= $threshold)
  - 📉 **N** price drop(s) detected!

- Price-drop embeds have:
  - **Title**: 📉 listing title
  - **Color**: Green (0x00ff00)
  - **Extra field**: "📉 Price Drop" showing `Was $X → Now $Y (−$Z)`
  - **Footer**: Product name • PRICE DROP • threshold <= $X

## Why embeds are chunked

Discord webhook messages are limited in embeds per message (commonly 10). The bot chunks alerts accordingly.
