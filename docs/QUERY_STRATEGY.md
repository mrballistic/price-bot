# Query strategy & false-positive control

The bot uses a two-phase approach:

1. **Broad retrieval** from marketplaces using 2–4 search queries per product (derived from `includeTerms`).
2. **Local filtering** with include/exclude terms + heuristics, then price checks.

This approach is more robust than relying on marketplace “advanced query” syntax.

## General tuning tips

- Keep `includeTerms` short but specific (model + brand when possible).
- Put common accessory/bundle words in `excludeTerms`.
- Prefer excluding a few obvious accessory terms over overly complex regex early on.
- If you see a recurring false positive, add its distinctive word(s) to `excludeTerms`.

## Roland System-8

Common false positives:

- Decksaver / cover / case
- Overlays / templates
- Patch packs / “plug-out” content
- “For parts” or broken units

Recommended includes (already in config):

- "roland system-8"
- "roland system 8"
- "system-8"
- "system 8"

Recommended excludes:

- case, decksaver, overlay, template, patches, plug-out, for parts, broken, power supply, adapter

Extra heuristic you can add later:

- Require "system-8" or "system 8" AND ( "roland" OR "system-8 synthesizer" )
- Reject if title contains accessory words and does NOT contain "roland"

## Roland S-1

Common false positives:

- cases/overlays
- lots/bundles (multiple items)
- "S1" can collide with unrelated items if brand isn't present

Recommended includes:

- "roland s-1"
- "aira s-1"
- "roland s1"
- "s-1 aira"

Recommended excludes:

- case, decksaver, overlay, manual, bundle, lot, for parts, broken

Extra heuristic you can add later:

- Require "roland" OR "aira" to appear
- For "s1" shorthand, require "roland" in title to reduce collisions
