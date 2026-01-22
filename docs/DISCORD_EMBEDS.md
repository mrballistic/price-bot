
# Discord embed layout

The bot uses a scannable embed format that’s quick to evaluate:

- Message header:
  - 🎹 Deal alert: <Product> (<= $threshold)
  - Found N matching listing(s)

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

## Why embeds are chunked
Discord webhook messages are limited in embeds per message (commonly 10). The bot chunks alerts accordingly.
