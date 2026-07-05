/**
 * useEntitlements
 *
 * Reads the user's current tier from localStorage and exposes capability
 * helpers.  Uses useSyncExternalStore so every mounted instance of this hook
 * shares the same tier and updates atomically when a purchase completes —
 * even across components that each call the hook independently.
 *
 * Tier is persisted locally so it survives page refreshes without a network
 * round-trip; a real payment provider should also verify server-side before
 * gating any sensitive data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAYMENT PROVIDER SEAM
 *
 * Replace the `runCheckout` stub below to wire in your payment provider.
 * The rest of the app (paywalls, limit checks, UI) requires no changes.
 *
 * Whop example:
 *   import { whop } from "@whop-apps/sdk";
 *   const result = await whop.checkout({ planId: WHOP_PLAN_IDS[product] });
 *   if (result.status === "paid") { setGlobalTier(product); return "success"; }
 *   return "cancelled";
 *
 * Stripe example:
 *   window.location.href = STRIPE_CHECKOUT_URLS[product];
 *   // On return from Stripe's success_url, verify server-side and call
 *   // setGlobalTier("unlock") or setGlobalTier("premium").
 *
 * After integrating, remove the "not yet configured" comment and the stub.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useSyncExternalStore } from "react";
import {
  Tier,
  TIER_CAPS,
  TierCapabilities,
  PurchaseProduct,
} from "@/lib/entitlements";

// ── Shared external store ─────────────────────────────────────────────────────
// All hook instances share a single in-memory value so a purchase in any
// component (e.g. UpgradeSheet) immediately updates all others.

const STORAGE_KEY = "mdc_tier";

function readStoredTier(): Tier {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "unlock" || v === "premium") return v;
  } catch {
    // localStorage unavailable (private browsing with strict settings, etc.)
  }
  return "free";
}

let _currentTier: Tier = readStoredTier();
const _subscribers = new Set<() => void>();

function subscribeTier(notify: () => void) {
  _subscribers.add(notify);
  return () => { _subscribers.delete(notify); };
}

function getTierSnapshot(): Tier {
  return _currentTier;
}

/** Update the shared tier store and persist to localStorage. */
export function setGlobalTier(t: Tier): void {
  try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

// ── Purchase result ───────────────────────────────────────────────────────────

export type PurchaseResult = "success" | "cancelled" | "unavailable";

/**
 * Payment provider stub.
 *
 * Returns "unavailable" until a real provider is wired in.
 * Replace this function body with your checkout integration.
 */
async function runCheckout(
  product: PurchaseProduct,
): Promise<PurchaseResult> {
  // TODO: replace with Whop / Stripe / RevenueCat checkout.
  // On success, call setGlobalTier(product) then return "success".
  void product;
  return "unavailable";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntitlements() {
  // useSyncExternalStore keeps all hook instances in sync across components.
  const tier = useSyncExternalStore(subscribeTier, getTierSnapshot);

  const caps: TierCapabilities = TIER_CAPS[tier];

  /** True if the user can add another item given the current wardrobe size. */
  const canAddItem = useCallback(
    (currentCount: number) =>
      caps.maxItems === null || currentCount < caps.maxItems,
    [caps.maxItems],
  );

  /** True if the user can save another outfit given the current saved count. */
  const canSaveOutfit = useCallback(
    (currentCount: number) =>
      caps.maxOutfits === null || currentCount < caps.maxOutfits,
    [caps.maxOutfits],
  );

  /**
   * Trigger the purchase flow for a product.
   * Returns "success", "cancelled", or "unavailable" (provider not configured).
   * On "success", the shared tier store is updated automatically.
   */
  const purchase = useCallback(
    async (product: PurchaseProduct): Promise<PurchaseResult> => {
      const result = await runCheckout(product);
      if (result === "success") {
        setGlobalTier(product === "unlock" ? "unlock" : "premium");
      }
      return result;
    },
    [],
  );

  return { tier, caps, canAddItem, canSaveOutfit, purchase };
}
