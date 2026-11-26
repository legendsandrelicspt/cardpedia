# Cardpedia Roadmap

## Backlog — revisit later

### Photo-based card identification
**Status:** Paused; not part of the current listing flow.

Revisit only when exact-printing accuracy can be validated, especially for vintage Pokémon cards and variants.

Required capabilities before relaunch:
- Distinguish Pokémon recognition from exact card/printing identification.
- Identify set, collector number, language, edition (1st Edition / Unlimited), and relevant artwork or print variants (e.g. Red Cheeks / Yellow Cheeks).
- Compare multiple candidate printings and show confidence/evidence.
- Never auto-confirm an edition or variant from Pokémon-name recognition alone.
- Validate against a representative test set covering WOTC/vintage, modern, promos, reverse/holo, and multiple languages.
- Reassess provider licensing, API costs, and data-retention terms before enabling.

The existing Supabase Edge Function `identify-pokemon` and CardSight secret are retained for possible future evaluation. They are not used by the current listing interface.
