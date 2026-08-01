/**
 * Entitlement tier definitions — single source of truth for limits and capabilities.
 *
 * Tiers:
 *   "free"   — default; up to FREE_ITEM_LIMIT items, FREE_COLLECTION_LIMIT saved collections.
 *   "unlock" — $9.99 one-time (or subscription); unlimited items + collections.
 */

export type Tier = "free" | "unlock";

/** Adjust these constants to run promotions or A/B tests without touching logic. */
export const FREE_ITEM_LIMIT       = 20;
export const FREE_COLLECTION_LIMIT = 5;

export interface TierCapabilities {
  /** Maximum craft items, or null for unlimited. */
  maxItems:       number | null;
  /** Maximum saved collections, or null for unlimited. */
  maxCollections: number | null;
}

export const TIER_CAPS: Record<Tier, TierCapabilities> = {
  free:   { maxItems: FREE_ITEM_LIMIT,  maxCollections: FREE_COLLECTION_LIMIT },
  unlock: { maxItems: null,             maxCollections: null                  },
};

/** Products available for purchase. */
export type PurchaseProduct = "unlock";

export const PRODUCT_PRICES: Record<PurchaseProduct, string> = {
  unlock: "$9.99",
};
