/**
 * UpgradeSheet — full-screen paywall.
 *
 * Shows when the user hits a free-tier limit or taps the upgrade button.
 * Price is pulled live from the RevenueCat offering; falls back to
 * "$9.99/mo" in the browser (where RC isn't available).
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useEntitlements, PurchaseResult } from "@/hooks/useEntitlements";
import { useSubscription } from "@/lib/revenuecat";

export type UpgradeReason = "items" | "outfits" | "mannequin";

interface Props {
  reason:  UpgradeReason;
  onClose: () => void;
}

const FEATURES = [
  "Unlimited clothing items",
  "Unlimited saved outfits",
  "Unlimited beauty & essentials",
  "Full wardrobe backup & restore",
  "Priority new features",
] as const;

const HEADLINES: Record<UpgradeReason, string[]> = {
  items:     ["Upgrade to", "Pack More", "Into Your", "Suitcase"],
  outfits:   ["Upgrade to", "Save Every", "Look You", "Love"],
  mannequin: ["Unlock Your", "Unlimited", "Digital", "Suitcase"],
};

const SUBTITLES: Record<UpgradeReason, string> = {
  items:     "You've reached the 20-item free limit. Go pro to pack everything.",
  outfits:   "You've hit the free outfit limit. Go pro to save unlimited looks.",
  mannequin: "A Pro feature — subscribe to unlock everything.",
};

export function UpgradeSheet({ reason, onClose }: Props) {
  const { purchase } = useEntitlements();
  const { offerings } = useSubscription();
  const [status, setStatus] = useState<"idle" | "pending">("idle");

  // Pull live price from RevenueCat; fall back gracefully
  const rcPackage   = offerings?.current?.availablePackages?.[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceString = (rcPackage as any)?.product?.priceString as string | undefined;
  const displayPrice = priceString ?? "$9.99";
  const ctaLabel  = status === "pending" ? "Opening…" : `Go Pro – ${displayPrice}/mo`;

  const handlePurchase = useCallback(async () => {
    if (status === "pending") return;
    setStatus("pending");
    const result: PurchaseResult = await purchase("unlock");
    if (result === "success") {
      onClose();
    } else {
      setStatus("idle");
    }
  }, [status, purchase, onClose]);

  const headline = HEADLINES[reason];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ background: "#F8F4ED" }}
    >
      {/* Close */}
      <div className="flex justify-end px-4 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-5 pb-4 gap-4 min-h-0">

        {/* Headline + sub */}
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-bold text-[2.6rem] uppercase tracking-tight leading-[0.95]">
            {headline.map((line, i) => (
              <React.Fragment key={i}>{line}<br /></React.Fragment>
            ))}
          </h1>
          <p className="text-sm font-semibold text-black/50 mt-1.5">
            {SUBTITLES[reason]}
          </p>
        </div>

        {/* Black card */}
        <div
          className="rounded-3xl border-4 border-black flex flex-col flex-1 min-h-0 overflow-hidden"
          style={{ background: "#0a0a0a", boxShadow: "6px 6px 0px 0px rgba(0,0,0,0.30)" }}
        >
          <div className="px-5 pt-5 pb-3 border-b border-white/10 flex-shrink-0">
            <p className="font-display font-bold text-sm uppercase tracking-widest text-[#B8894E]">
              Pro Stylist includes:
            </p>
          </div>

          <ul className="px-5 py-0 flex flex-col flex-1 justify-evenly">
            {FEATURES.map((text) => (
              <li key={text} className="flex items-center gap-3 py-0.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#B8894E" }}
                >
                  <Check className="w-3 h-3 text-black" strokeWidth={3} />
                </span>
                <span className="text-white font-semibold text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>

          {/* Price block */}
          <div className="px-5 pb-5 pt-3 border-t border-white/10 flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <span
                className="font-display font-bold text-5xl leading-none"
                style={{ color: "#B8894E" }}
              >
                {displayPrice}
              </span>
              <span className="text-white/45 font-semibold text-sm leading-tight">
                per&nbsp;month
              </span>
            </div>
            <p className="text-white/30 text-xs mt-1 font-medium">Cancel anytime</p>
          </div>
        </div>

      </div>

      {/* CTA footer */}
      <div
        className="px-5 pt-3 flex flex-col gap-3 flex-shrink-0"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handlePurchase}
          disabled={status === "pending"}
          className="w-full py-4 rounded-2xl font-display font-bold text-xl uppercase
                     tracking-tight border-4 border-black text-black
                     active:translate-x-1 active:translate-y-1 transition-all
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: "#E8D4B0",
            boxShadow: status === "pending" ? "none" : "5px 5px 0px 0px rgba(0,0,0,1)",
          }}
        >
          {ctaLabel}
        </button>
        <button
          onClick={onClose}
          className="text-sm font-bold text-black/35 text-center underline underline-offset-2
                     hover:text-black/55 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </motion.div>
  );
}
