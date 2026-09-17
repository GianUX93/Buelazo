---
name: Buelazo
description: Marketplace peruano de endoso de pasajes aéreos — look cálido y directo tipo inDrive/Airbnb, no "tech", con buscador funcional real en el home.
colors:
  ink: "#1A1E2B"
  primary-coral: "#FF5B49"
  secondary-teal: "#00C2A8"
  warning-yellow: "#FFC93C"
  accent-purple: "#7C5CFC"
  surface: "#FFFFFF"
  surface-2: "#F7F7F9"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  data-mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
rounded:
  card: "1.75rem"
  pill: "9999px"
components:
  cta-primary:
    backgroundColor: "{colors.primary-coral}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  dark-panel:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.card}"
---

## Overview

Buelazo is a Peruvian P2P marketplace for transferring (endosando) domestic airline tickets, with an AI search agent ("lucIA"). The home page's look and feel targets mass-market trust-first marketplaces (inDrive, Airbnb) — warm, light, direct, never "techy" (no monospace-heavy panels, no dark instrument/terminal chrome as the default register). Dark panels are used sparingly, only for the lucIA showcase and closing CTA, as accents against a light, friendly base.

## Colors

Four named roles, fixed meaning across the product:

- **`primary-coral` (#FF5B49)** — primary actions and the price/discount emphasis.
- **`secondary-teal` (#00C2A8)** — verified/trust signals (escrow badges, verified seller, checkmarks).
- **`accent-purple` (#7C5CFC)** — lucIA's voice only (sparkle icon, agent bubbles, the lucIA panel's glow).
- **`warning-yellow` (#FFC93C)** — urgency only ("Última llamada").
- Base pages are light (`surface`/`surface-2`); `ink` is reserved for a small number of deliberately dark panels (lucIA showcase, closing CTA), not the default register.

## Typography

- **Sora (display, 700-800 weight)** — headlines, in normal sentence case (not uppercase) for a warmer, less "signage/technical" read than all-caps display type.
- **Inter (body)** — the product's shared workhorse text face; intentionally unglamorous, consistent with the rest of the app, not a per-surface decision.
- Monospace (IBM Plex Mono) stays reserved for its original use elsewhere in the product (prices/dates inside `FlightCard`) — not extended into the home page's own chrome.

## Layout

- Hero: two-column (text + real featured-offer card) on a light ground, not full-bleed dark. A functional manual search bar (origin/destination/date, real `/explore` params) sits directly under the subcopy — the home's primary invitation to search — with a secondary text link into lucIA's chat mode for people who'd rather type a sentence than fill fields.
- Sections alternate light (search, flight grid, trust grid, testimonials) with a small number of dark accent panels (lucIA pitch, closing CTA) — dark is the exception, not the rhythm.
- Lists of parallel facts ("¿Por qué confían...") render as a **grid of same-size icon cards** — this is an intentional, brief-pinned choice (the user's own reference layout), not a default reached by accident.

## Shapes

- Cards and panels: `rounded-[1.75rem]`, soft `shadow-sm`/`shadow-md`, hairline `border-border` — Airbnb-style soft geometry, no backlit glows, no hard edges, no signage-panel language.
- CTAs: pill-shaped (`rounded-full`), unchanged from the base system.
- The featured-offer card in the hero uses a photo-top / white-body split (like a listing card), built from one real active flight (`highlighted[0]`) — never a fabricated sample listing.

## Components

- **Hero search bar**: real controlled inputs bound to `/explore`'s existing `from`/`to`/`date` search params — submitting it performs a real search, not a decorative interaction.
- **Featured-offer card**: derived entirely from real flight data (`tramoVigente`, `discountPct`, `totalAPagar`, `seller.verifiedId`) plus a hand-curated destination photo — no invented seller stats, ratings, or claims (the product has no rating system by deliberate design; never introduce one visually).
- **"Cómo funciona" steps**: light numbered cards (01/02/03, colored per step) plus a dark closing strip linking to `/trust` — kept because the sequence is genuinely causal (step 2 depends on step 1 completing, payout depends on step 3).
- **Closing CTA panel**: a single dark banner restating both core actions (Explorar / Publicar) at the end of the page, for visitors who scrolled the whole way without deciding.

## Do's and Don'ts

- **Do** keep the hero's search bar wired to real `/explore` params — never let it become a decorative element that doesn't actually search.
- **Do** source the hero's featured card from real active-listing data; if none has loaded, prefer hiding the card over fabricating one.
- **Do** keep dark panels rare and deliberate (lucIA, closing CTA) — reintroducing a dark "default" register drifts back toward a cold/technical feel this direction explicitly moved away from.
- **Don't** add a rating/review UI anywhere (stars, review counts) — the product has no rating system, by a documented product decision (see `src/lib/mock-data.ts`), and adding one would fabricate a signal that doesn't exist.
- **Don't** claim absolutes not established elsewhere in the product copy (e.g. "100% garantizado", "primer marketplace del Perú") — state real mechanisms (escrow, manual review, verified ID) instead of unverifiable superlatives.
- **Don't** treat Inter as a decision point when extending this system — shared workhorse choice across the whole product, out of scope to change per-surface.

## History

An earlier pass of this redesign explored a "Señalética Aeroportuaria" (airport-wayfinding/departure-board) direction — full-bleed dark panels, monospace signage type, split-flap animation. The user reviewed it, found it under-baked and too "tech," and redirected to the warmer inDrive/Airbnb-like direction documented above, using their own Stitch mockup as a layout reference (content and claims still constrained to what the product actually has). This file reflects the current, approved direction only.
