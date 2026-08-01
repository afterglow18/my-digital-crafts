/**
 * RevenueCat integration — using @revenuecat/purchases-capacitor.
 *
 * • On iOS (Capacitor native): full purchase flow via StoreKit.
 * • In browser (Replit preview / web): purchases show "unavailable" gracefully.
 *
 * Premium access is ALWAYS derived from a live RC CustomerInfo fetch.
 * It is never stored in or read from localStorage.
 *
 * CustomerInfo is refreshed:
 *   1. On app launch (initial query mount)
 *   2. On app foreground (appStateChange listener)
 *   3. Immediately after a successful purchase (cache seeded + invalidated)
 *   4. Immediately after Restore Purchases (cache seeded + invalidated)
 *   5. Whenever RC pushes a server-side update (addCustomerInfoUpdateListener)
 *      — this catches refunds, expirations, and subscription lapses in real-time.
 *
 * STATIC IMPORT NOTE: dynamic import() of @revenuecat/purchases-capacitor
 * creates a lazy Vite chunk that hangs silently in Capacitor's WKWebView,
 * preventing configure() from ever being reached. Static import is required.
 */

import React, { createContext, useContext, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// Static import is critical — dynamic import() hangs in WKWebView (Vite lazy chunk).
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

// ── Constants ─────────────────────────────────────────────────────────────────

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "My Digital Crafts Pro";

const RC_TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_KEY as string | undefined;
// Support both VITE_REVENUECAT_IOS_API_KEY (preferred) and the legacy VITE_REVENUECAT_IOS_KEY
const RC_IOS_KEY  =
  (import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined) ||
  (import.meta.env.VITE_REVENUECAT_IOS_KEY     as string | undefined);

function getApiKey(): string {
  const isNative = Capacitor.isNativePlatform();
  if (isNative && RC_IOS_KEY) return RC_IOS_KEY;
  if (RC_TEST_KEY) return RC_TEST_KEY;
  throw new Error("RevenueCat API key not configured");
}

// ── Initialization ────────────────────────────────────────────────────────────
// Cached promise — re-entrant safe. initializeRevenueCat() twice → same promise.

let _initPromise: Promise<void> | null = null;

export function initializeRevenueCat(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    if (!Capacitor.isNativePlatform()) return; // browser — nothing to configure

    const apiKey = getApiKey();

    // Fire-and-forget: do NOT await either call.
    // The Swift→JS bridge response may never arrive on Capacitor 8 + SPM;
    // the native SDK initialises synchronously on message receipt.
    void Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
      .then(() => console.log("[RC] setLogLevel ✓"))
      .catch((e) => console.warn("[RC] setLogLevel failed:", e));

    void Purchases.configure({ apiKey })
      .then(() => console.log("[RC] configure() response ✓"))
      .catch((e) => console.error("[RC] configure() error:", e));

    // One microtask to let the native bridge queue the messages before we
    // mark the init promise as resolved.
    await Promise.resolve();
    console.log("[RevenueCat] Configured (fire-and-forget)");
  })().catch((err) => {
    // Reset so the next call retries on transient failures.
    _initPromise = null;
    throw err;
  });
  return _initPromise;
}

// ── Query key ─────────────────────────────────────────────────────────────────

const CUSTOMER_INFO_KEY = ["revenuecat", "customer-info"] as const;

// ── Subscription context ──────────────────────────────────────────────────────

function useSubscriptionContext() {
  const qc = useQueryClient();

  // staleTime: 0 — always considered stale so every mount/focus triggers a
  // fresh fetch. The foreground listener below handles mid-session refreshes.
  const customerInfoQuery = useQuery({
    queryKey: CUSTOMER_INFO_KEY,
    queryFn: async () => {
      if (!Capacitor.isNativePlatform()) return null;
      const { customerInfo } = await Purchases.getCustomerInfo();
      return customerInfo;
    },
    staleTime: 0,
    retry: false,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      // Ensure configure() has been dispatched before fetching offerings.
      await initializeRevenueCat();
      if (!Capacitor.isNativePlatform()) return null;
      const result = await Purchases.getOfferings();
      // The Capacitor plugin returns PurchasesOfferings directly (v13+).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const offerings = (result as any).offerings ?? result ?? null;
      console.log("[RevenueCat] current offering:", offerings?.current?.identifier ?? "null");
      console.log("[RevenueCat] available packages:", offerings?.current?.availablePackages?.map((p: { identifier: string }) => p.identifier) ?? []);
      return offerings;
    },
    staleTime: 300 * 1000,
    // Retry up to 3 times with back-off in case configure() hasn't settled yet.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // ── Foreground + server-push listeners ─────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appListenerHandle: Awaited<ReturnType<typeof import("@capacitor/app").App.addListener>> | null = null;
    let rcCallbackId: string | null = null;

    (async () => {
      // 1. Recheck CustomerInfo every time the app comes back to the foreground.
      try {
        const { App } = await import("@capacitor/app");
        appListenerHandle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            console.log("[RevenueCat] App foregrounded — rechecking CustomerInfo");
            qc.invalidateQueries({ queryKey: CUSTOMER_INFO_KEY });
          }
        });
      } catch (err) {
        console.warn("[RevenueCat] Could not add appStateChange listener:", err);
      }

      // 2. RC server-push: fires when RC detects a refund, expiry, or any
      //    server-side entitlement change — revokes access in real-time.
      try {
        rcCallbackId = await Purchases.addCustomerInfoUpdateListener(
          (customerInfo) => {
            console.log("[RevenueCat] CustomerInfo pushed from server — updating cache");
            qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
          }
        );
      } catch (err) {
        console.warn("[RevenueCat] Could not add CustomerInfo listener:", err);
      }
    })();

    return () => {
      appListenerHandle?.remove();
      if (rcCallbackId !== null) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: rcCallbackId })
          .catch(() => {/* non-fatal */});
      }
    };
  }, [qc]);

  // ── Purchase ───────────────────────────────────────────────────────────────
  const purchaseMutation = useMutation({
    mutationFn: async (pkg: unknown) => {
      if (!Capacitor.isNativePlatform()) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg as never });
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      // Seed the cache immediately with the fresh CustomerInfo RC just returned,
      // then invalidate to schedule a background re-fetch for confirmation.
      qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
      qc.invalidateQueries({ queryKey: ["revenuecat"] });
    },
  });

  // ── Restore ────────────────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!Capacitor.isNativePlatform()) throw new Error("Purchases not available in browser");
      const { customerInfo } = await Purchases.restorePurchases();
      return customerInfo;
    },
    onSuccess: (customerInfo) => {
      // Same pattern: seed immediately, then confirm in background.
      qc.setQueryData(CUSTOMER_INFO_KEY, customerInfo);
      qc.invalidateQueries({ queryKey: ["revenuecat"] });
    },
  });

  // ── Entitlement check — derived purely from live RC data ───────────────────
  // Never reads localStorage. If customerInfo is null (not yet loaded or
  // browser), isSubscribed is false — safe default to free tier.
  const isSubscribed =
    customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  return {
    customerInfo:  customerInfoQuery.data ?? null,
    offerings:     offeringsQuery.data ?? null,
    isSubscribed,
    isLoading:     customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase:      purchaseMutation.mutateAsync,
    restore:       restoreMutation.mutateAsync,
    isPurchasing:  purchaseMutation.isPending,
    isRestoring:   restoreMutation.isPending,
    purchaseError: purchaseMutation.error as Error | null,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be inside <SubscriptionProvider>");
  return ctx;
}
