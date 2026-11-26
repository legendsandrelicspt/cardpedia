# Cardpedia data architecture and source licensing

Status: implementation blueprint, not legal clearance. No third-party card dataset, artwork, logo, or price feed is bundled by this change.

## Selected architecture
- Frontend: current static HTML/CSS/JavaScript prototype.
- Backend: Supabase (managed PostgreSQL, Auth, Storage, Edge Functions).
- Canonical catalogue: Cardpedia-owned normalized records in PostgreSQL.
- External feeds: provider adapters run server-side only; never expose provider secrets in browser JavaScript.
- Marketplace content: seller-created listings and seller-uploaded photographs, separate from canonical card metadata.
- Currency: EUR as listing default; source prices retain original currency, source, timestamp and provenance.

## Data model
First migration: `supabase/migrations/202611260001_initial_schema.sql`.
`cards` represents a canonical card concept. `printings` represents a particular set/collector-number/language/finish/edition. Listings point to a printing where known, but may remain unlinked for sealed products.
External identifiers retain source provenance. Seller descriptions remain separate from imported catalogue values. Unknown image rights means do not render the external image.

## Selected games
- Pokémon; Magic: The Gathering; Yu-Gi-Oh!; One Piece Card Game; Disney Lorcana; Riftbound.

## Source review — 26 November 2026

### Scrydex
- Docs list Pokémon, Magic, Lorcana, One Piece and Riftbound coverage.
- Starter is advertised at USD 29/month for 5,000 credits.
- Its Terms prohibit resale, sublicensing, redistribution or commercial exploitation of the Services without prior written authorization, and prohibit use as substitute backend/wholesale source for a competing commercial product without written authorization.
- Decision: no production integration or caching/display of its catalogue/images until written permission explicitly covers a commercial multi-vendor marketplace, customer-facing search, caching, image display, derived records and export/termination rights. A paid plan alone is not this permission.
- References: https://scrydex.com/docs ; https://scrydex.com/terms ; https://scrydex.com/pricing

### Legacy Pokémon TCG API
- Deprecated; new registrations unavailable; existing keys expected to function only until 1 March 2027.
- Decision: do not build a new integration on it. Reference: https://dev.pokemontcg.io/terms

### Scryfall
- Candidate specialist source for MTG metadata. API availability is not a blanket licence for Wizards artwork or trademarks.
- Decision: confirm current API guidelines and obtain written confirmation for commercial marketplace display/caching before production use. Candidate adapter only.
- Reference: https://scryfall.com/docs/api

### Riftbound / Riot
- Riot requires registration of player-facing products. Riftbound assets must come only from Riot's API. Monetization conditions include product approval, a free tier and transformative paid content. Resale/licensing or charging for access to Game Information requires prior written approval.
- Decision: register Cardpedia and obtain written approval before Riftbound assets or monetized Riftbound functionality go live.
- References: https://developer.riotgames.com/docs/riftbound ; https://developer.riotgames.com/policies/riftbound ; https://developer.riotgames.com/terms

### Disney Lorcana
- Community APIs do not grant rights to Disney/Ravensburger artwork, trademarks or proprietary assets.
- Decision: use seller-uploaded photos for listings; do not mirror official card art or logos. Review the Ravensburger digital asset policy before official artwork or branded marketing.
- References: https://disneylorcana.com/en/resources/ ; https://brand.ravensburger-group.com/d/e1vhRSQ7WeNy

### Pokémon / Yu-Gi-Oh! / One Piece and other providers
- A public endpoint or displayed Cardmarket/TCGplayer prices do not by themselves establish redistribution rights.
- Decision: evaluate commercial use, image rights, caching, attribution, price redistribution, rate limits and termination rights per source before enabling each adapter.

## Budget: EUR 50/month
- Supabase Free is suitable for development/low-volume proof of concept, with 500 MB database, 1 GB storage, 5 GB egress and inactivity pausing. Pro starts at USD 25/month.
- Scrydex Starter is advertised at USD 29/month, but it is not approved for this marketplace without written permission.
- Decision: do not subscribe to a card-data plan yet. Start on Supabase Free and seller-uploaded photos; reserve paid spend for a provider with suitable written terms or production infrastructure.
- References: https://supabase.com/pricing ; https://scrydex.com/pricing

## Implementation sequence
1. Owner creates Supabase project and configures environment secrets. Never commit service-role keys or API keys.
2. Apply SQL migration.
3. Add Auth, email verification, profile onboarding and Storage bucket with per-user upload policies.
4. Replace browser-only localStorage listings with authenticated database CRUD.
5. Add server-side provider adapters only after written licensing approval.
6. Build search over canonical local records, retaining source IDs, timestamps and provenance.
7. Add moderation, takedown workflow, seller status, order lifecycle and message controls.
8. Before commercial launch, complete privacy, consumer, DSA, tax and IP legal review.

## Explicit non-goals
- No payments or escrow.
- No automated market-price publication.
- No scraping of Cardmarket, TCGplayer, publisher sites or other catalogues.
- No copying official artwork into Cardpedia storage.
- No claim of publisher affiliation or endorsement.
