/**
 * PremiumSheet
 *
 * Full-screen "Premium" paywall, shown when the user taps the Mannequin
 * button without a premium entitlement.
 *
 * When a payment provider is wired into useEntitlements, the "Upgrade"
 * button triggers the real checkout flow.  Until then it shows a polite
 * "coming soon" note.
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEntitlements, PurchaseResult } from "@/hooks/useEntitlements";

interface Props {
  onClose: () => void;
}

const PREMIUM_FEATURES = [
  { emoji: "🧍", text: "Interactive 3D mannequin" },
  { emoji: "🔄", text: "360° outfit viewing" },
  { emoji: "📸", text: "Front and back photos for clothing items" },
  { emoji: "✨", text: "Display clothing correctly as the mannequin rotates" },
  { emoji: "🚀", text: "Future premium visualization features" },
] as const;

export function PremiumSheet({ onClose }: Props) {
  const { purchase } = useEntitlements();
  const [status, setStatus] = useState<"idle" | "pending" | "unavailable">("idle");

  const handlePurchase = useCallback(async () => {
    setStatus("pending");
    const result: PurchaseResult = await purchase("premium");
    if (result === "success") {
      onClose();
    } else if (result === "unavailable") {
      setStatus("unavailable");
    } else {
      setStatus("idle");
    }
  }, [purchase, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b-2 border-black flex-shrink-0">
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Premium Feature
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col p-5 gap-5">

        {/* Hero */}
        <div className="border-4 border-black rounded-2xl bg-black text-white
                        shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          <div className="px-5 pt-6 pb-5 flex flex-col items-start gap-2">
            <span className="text-5xl leading-none">🧍</span>
            <p className="font-display font-bold text-3xl uppercase tracking-tight leading-tight mt-1">
              3D Mannequin
            </p>
            <p className="text-sm text-white/60 font-medium leading-snug">
              See your outfit come to life in 360°.
            </p>
          </div>
        </div>

        {/* Feature list */}
        <div className="border-2 border-black rounded-2xl bg-white p-4
                        shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-display font-bold text-sm uppercase tracking-tight mb-3">
            Premium includes
          </p>
          <ul className="flex flex-col gap-3">
            {PREMIUM_FEATURES.map(({ emoji, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm leading-snug">
                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{emoji}</span>
                <span className="text-black/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Note */}
        <p className="text-xs text-center text-black/40 font-medium px-2">
          The core app — wardrobe, outfit builder, and lookbook — is fully
          functional with the $4.99 Unlock Forever purchase.
          Premium adds the 3D mannequin on top.
        </p>

      </div>

      {/* CTA footer */}
      <div className="px-5 pb-6 pt-4 bg-white border-t-2 border-black flex flex-col gap-3 flex-shrink-0">
        <button
          onClick={handlePurchase}
          disabled={status === "pending"}
          className="w-full py-4 rounded-xl flex items-center justify-center gap-2
                     font-display font-bold text-lg uppercase tracking-tight border-4 border-black
                     bg-black text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                     active:translate-x-1 active:translate-y-1 active:shadow-none
                     disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {status === "pending" ? "Opening checkout…" : "Upgrade to Premium"}
        </button>

        {status === "unavailable" && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200
                        rounded-lg px-3 py-2">
            Payments are not yet set up. Check back soon!
          </p>
        )}

        <button
          onClick={onClose}
          className="text-sm font-bold text-black/40 text-center underline underline-offset-2
                     hover:text-black/60 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </motion.div>
  );
}
