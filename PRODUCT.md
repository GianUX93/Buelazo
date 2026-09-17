# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two roles on the same peer-to-peer marketplace, comprador prioritized as the primary home-page audience:

- **Compradores (primary):** people looking for last-minute or discounted domestic flights in Peru. They come to the home page wanting to find a cheap, viable ticket fast — the mini-buscador / lucIA chat is the primary entry point for this job.
- **Vendedores (secondary):** people holding a non-refundable domestic ticket they can no longer use (name-change/endoso required by the airline) who want to recover part of their money by transferring it to a buyer. Visible on the home page as a clear secondary CTA ("Vender mi pasaje" / "Vender vuelos"), not equal-weighted with the buyer flow.

## Product Purpose

Buelazo ("Traspaso") is a Peruvian P2P marketplace for transferring (endosando) domestic airline tickets between people. Sellers who can't use a non-refundable ticket list it; buyers get last-minute flights at aggressive discounts vs. the airline's current price. The platform verifies ticket validity and holds payment in escrow until the airline-side transfer (endoso) is confirmed successful.

## Positioning

Not a generic ticket resale board: it verifies each listing before it goes public, escrows the buyer's payment until the airline endorsement is confirmed, and lets buyers search in natural language via "lucIA" (an AI agent) instead of filling in filter forms. The mechanism a competitor can't casually copy is the escrow-gated verified endoso process, not just discounted listings.

## Operating Context

- Domestic Peruvian routes and airlines (LATAM, Sky Airline, JetSmart), prices in soles (S/).
- Tickets have a time-sensitive validity state tied to how many hours remain before departure and how viable the airline's endoso process still is: `active` (>24h, shown normally with countdown), `last_call` (<24h, shown only in an explicit "Última llamada" section with a risk-toned warning, never as a standard offer), `expired` (endoso no longer operationally viable — hidden everywhere automatically).
- Selling flow: upload proof of reservation (voucher) → lucIA extracts flight/passenger data automatically → seller confirms/completes → sets a resale price (lucIA suggests one based on comparable active listings) → publish → goes to manual review → appears in marketplace once approved.
- Buying flow: browse/search available listings (manual filters or lucIA natural-language chat) → flight detail page shows price breakdown, escrow protection steps, and seller info → buy → escrow holds payment → endoso confirmed with the airline → payment released to seller.
- Trust/legal explanation of the escrow + endoso process lives on a dedicated "Cómo funciona" / trust page — the home page should point to it, not duplicate it.

## Capabilities and Constraints

- lucIA is the product's AI agent, used in two places: (1) a home-page hero demo/pitch for "search by talking instead of filling forms," and (2) the real chat mode inside `/explore` that returns real listing cards from active inventory.
- The home-page lucIA hero interaction is illustrative/demo content (mock conversation, mock discount example) — this is confirmed intentional, not a gap to fill with real data. Do not present it as a live result feed; it's a taste of the real `/explore` chat.
- Testimonials and "trusted by" style proof on the current home page are simulated/mock data (site footer already discloses "Prototipo con datos simulados"). Any new testimonial-style content on the redesigned home must stay clearly within that same illustrative, non-fabricated-claim spirit — no new invented metrics, review counts, or company logos presented as real.
- Redesign scope for this round is the home page (`/` route) only. The rest of the flow (explore, flight detail, publish, dashboard, profile, auth) is out of scope and must not change behavior, copy source-of-truth, or routes.
- Existing color tokens/design system must be preserved — this is a layout/art-direction/motion redesign, not a rebrand or new palette.

## Brand Commitments

- Product name: Buelazo (marketing/app name), internal doc name "Traspaso" (P2P transfer/endoso concept it's built around).
- AI agent name/brand: "lucIA" — always styled with the "IA" suffix emphasized (as seen across the app, e.g. gradient sparkle icon, pink/purple accent), positioned as "agente de IA, no un formulario."
- Tone: confident, direct, benefit-first Spanish (Peru) copy — e.g. "Vuelos que otros no pueden usar, a mitad de precio."

## Evidence on Hand

- Existing implementation at `src/routes/index.tsx`, `src/routes/explore.tsx`, `src/routes/flight.$id.tsx`, `src/routes/publish.tsx` shows the real product mechanics, copy voice, and data shapes (see `src/lib/mock-data.ts`, `src/lib/flight-utils.ts`).
- `README.md` documents the full product spec, ticket lifecycle states, and page-by-page requirements in Spanish — treat as authoritative product truth for anything not covered above.
- No real testimonials, press mentions, or verified metrics exist yet; footer/hero content on the current home page is explicitly mock/prototype data.

## Product Principles

1. Buyer-first funnel: the home page's job is to get a comprador into `/explore` (manual or lucIA chat) as fast and as invitingly as possible; selling is a strong secondary path, not equal-weighted.
2. Trust is earned through mechanism, not decoration: escrow, verification, and review steps should read as real product safeguards, not generic trust badges.
3. lucIA is the differentiator, not a gimmick: any hero treatment of it should feel like a preview of a genuinely useful natural-language search, not a chatbot toy bolted onto a form-first page.
4. Never let redesign drift into new product claims: no new fabricated stats, reviews, or partner logos — illustrative demo content must stay legible as illustrative.
5. Preserve everything downstream: the home page redesign must not touch tokens, routes, or behavior outside `/` route.

## Accessibility & Inclusion

No product-specific requirement established beyond standard web accessibility practice (not explicitly confirmed with the user; treat as a baseline to maintain, not to newly define).
