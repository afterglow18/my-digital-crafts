/**
 * WelcomePage — Three-phase splash (shown once per cold launch).
 *
 * HERO     : full-screen hero image, branding near bottom. Auto-advances 2.5 s.
 * IDLE     : orange screen, branding + button. Static — no animation.
 * PAINTING : button tapped → orange layer clips away left→right revealing the
 *            live app behind it, with the paintbrush riding the leading edge.
 * EXITING  : brief hold → outer wrapper fades → onEnter().
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

type Phase = "hero" | "idle" | "painting" | "exiting";

const HERO_MS   = 2500;
const HERO_FADE = 500;
const PAINT_MS  = 2600;
const HOLD_MS   = 420;
const EXIT_MS   = 550;

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("hero");
  const [vw,    setVw]    = useState(375);
  const [vh,    setVh]    = useState(700);
  const calledRef = useRef(false);

  useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  useEffect(() => {
    if (phase === "hero") {
      const t = setTimeout(() => setPhase("idle"), HERO_MS);
      return () => clearTimeout(t);
    }
    if (phase === "painting") {
      const t = setTimeout(() => setPhase("exiting"), PAINT_MS + HOLD_MS);
      return () => clearTimeout(t);
    }
    if (phase === "exiting") {
      const t = setTimeout(finish, EXIT_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, finish]);

  const handleOpen = () => {
    if (phase !== "idle") return;
    setPhase("painting");
  };

  const isPainting = phase === "painting";
  const isExiting  = phase === "exiting";

  const brushSize = Math.round(Math.min(vw, vh) * 0.13);
  const brushY    = vh * 0.38;

  const Branding = () => (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: 11, fontWeight: 500,
        letterSpacing: "0.25em", textTransform: "uppercase" as const,
        color: "rgba(237,217,180,0.75)", marginBottom: 8,
      }}>
        Welcome to
      </div>
      <div style={{
        fontFamily: "var(--font-display, serif)",
        fontWeight: 900,
        fontSize: `clamp(28px, ${vw * 0.115}px, 52px)`,
        letterSpacing: "-0.02em", lineHeight: 1.1,
        color: "#EDD9B4",
        textShadow: "0 2px 16px rgba(0,0,0,0.55)",
      }}>
        MY DIGITAL<br />CRAFTS
      </div>
    </div>
  );

  return (
    // Outer wrapper — transparent so the live app shows through when orange is clipped
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "transparent",
        overflow: "hidden",
      }}
    >

      {/* ── Orange background layer — clipped away left→right during painting ── */}
      <motion.div
        animate={{
          clipPath: isPainting || isExiting
            ? "inset(0 0% 0 100%)"   // fully clipped → app shows through
            : "inset(0 0% 0 0%)",    // fully visible → orange screen
        }}
        transition={{ duration: PAINT_MS / 1000, ease: [0.1, 0.0, 0.2, 1.0] }}
        style={{
          position: "absolute", inset: 0,
          background: "#8C4A20",
          zIndex: 1,
        }}
      />

      {/* ── Soft paint-edge glow — rides just ahead of the clip edge ── */}
      {isPainting && (
        <motion.div
          aria-hidden
          initial={{ left: -vw * 0.10 }}
          animate={{ left: vw * 1.05 }}
          transition={{ duration: PAINT_MS / 1000, ease: [0.1, 0.0, 0.2, 1.0] }}
          style={{
            position: "absolute", top: 0,
            width: vw * 0.12, height: "100%",
            background: "linear-gradient(to right, transparent, rgba(255,240,200,0.18), transparent)",
            zIndex: 2, pointerEvents: "none",
          }}
        />
      )}

      {/* ── Paintbrush riding the leading edge ── */}
      {isPainting && (
        <motion.div
          aria-hidden
          initial={{ left: -brushSize * 0.5, opacity: 0 }}
          animate={{ left: vw + brushSize * 0.2, opacity: [0, 1, 1, 0.6, 0] }}
          transition={{
            left:    { duration: PAINT_MS / 1000, ease: [0.1, 0.0, 0.2, 1.0] },
            opacity: { duration: PAINT_MS / 1000, times: [0, 0.04, 0.88, 0.96, 1], ease: "linear" },
          }}
          style={{
            position: "absolute",
            top: brushY - brushSize * 0.5,
            zIndex: 3,
            width: brushSize * 0.42, height: brushSize * 1.35,
            transform: "rotate(-30deg)",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.55))",
            pointerEvents: "none", userSelect: "none",
          }}
        >
          <svg viewBox="0 0 34 110" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <rect x="12" y="0" width="10" height="72" rx="5" fill="#7B3F10"/>
            <rect x="13.5" y="2" width="3" height="66" rx="2" fill="rgba(255,220,170,0.18)"/>
            <rect x="10" y="69" width="14" height="11" rx="2" fill="#C8A45A"/>
            <rect x="10" y="72" width="14" height="2" fill="rgba(255,255,255,0.18)"/>
            <ellipse cx="17" cy="95" rx="7" ry="16" fill="#1E0D06"/>
            <ellipse cx="17" cy="86" rx="6.5" ry="5" fill="#2A1208"/>
            <ellipse cx="15" cy="90" rx="2" ry="7" fill="rgba(255,255,255,0.07)"/>
          </svg>
        </motion.div>
      )}

      {/* ── Idle content — branding + button (zIndex 4) ── */}
      <motion.div
        animate={{
          opacity: phase === "idle" ? 1 : 0,
          y:       phase === "idle" ? 0  : 14,
        }}
        transition={{ duration: 0.28 }}
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 100px)`,
          gap: 28,
          zIndex: 4,
          pointerEvents: phase === "idle" ? "auto" : "none",
        }}
      >
        <Branding />

        <motion.button
          onClick={handleOpen}
          whileTap={{ scale: 0.96 }}
          style={{
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800, fontSize: 16,
            letterSpacing: "0.03em",
            color: "#8C4F48",
            background: "#F5F0E8",
            border: "1.5px solid #8C4F48",
            borderRadius: 100,
            padding: "14px 46px",
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(140,79,72,0.55), 2px 2px 0 rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          Open Crafts ✨
        </motion.button>
      </motion.div>

      {/* Footer links — idle only */}
      <motion.div
        animate={{ opacity: phase === "idle" ? 1 : 0 }}
        transition={{ duration: 0.28 }}
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 10px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          zIndex: 5,
          pointerEvents: phase === "idle" ? "auto" : "none",
        }}
      >
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >Privacy Policy</a>
        <a
          href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >Support</a>
      </motion.div>

      {/* ── Hero overlay (Phase 1) — sits on top, fades out to reveal idle ── */}
      <motion.div
        animate={{ opacity: phase === "hero" ? 1 : 0 }}
        transition={{ duration: HERO_FADE / 1000, ease: "easeOut" }}
        style={{
          position: "absolute", inset: 0,
          zIndex: 6,
          pointerEvents: "none",
        }}
      >
        <img
          src="/crafts-hero.png"
          alt=""
          draggable={false}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center top",
            display: "block",
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 40%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute",
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 120px)`,
          left: 0, right: 0,
          display: "flex", justifyContent: "center",
        }}>
          <Branding />
        </div>
      </motion.div>

    </motion.div>
  );
}
