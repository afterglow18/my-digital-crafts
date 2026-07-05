---
name: Entitlements architecture
description: How the pricing/tier system works and where to wire in a payment provider.
---

# Entitlements Architecture

## Tiers and limits
- `free` — 20 items (`FREE_ITEM_LIMIT`), 5 outfits (`FREE_OUTFIT_LIMIT`), no mannequin.
- `unlock` — $4.99 one-time; unlimited items + outfits, no mannequin.
- `premium` — everything in unlock + 3D mannequin.

Constants live in `src/lib/entitlements.ts` — adjust there for A/B tests or promotions.

## Shared state
`useEntitlements` in `src/hooks/useEntitlements.ts` uses `useSyncExternalStore` around a module-level store (`_currentTier`, `_subscribers`). All hook instances update atomically when any component calls `purchase()`.

## Payment provider seam
Replace `runCheckout()` in `useEntitlements.ts`. On checkout success, call `setGlobalTier(product)` then return `"success"`. No other file needs to change.

## Paywall components
- `src/components/paywall/UpgradeSheet.tsx` — item or outfit limit hit; shows $4.99 unlock.
- `src/components/paywall/PremiumSheet.tsx` — mannequin gated; shows premium upgrade.

**Why:** Keeping the payment stub isolated to one function means the entire UI (limit badges, paywall screens, gating logic) is fully built and testable before choosing a provider.

**How to apply:** When the user picks a payment provider, only `runCheckout` in `useEntitlements.ts` needs to change. Everything else is already wired.
