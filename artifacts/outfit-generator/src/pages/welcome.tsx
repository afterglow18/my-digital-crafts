/**
 * WelcomePage — Paintbrush canvas animation.
 *
 * IDLE      : crafts-bg.png (blank canvas/shelves), title + "Open Crafts" button below.
 * PAINTING  : button fades away; a paintbrush sweeps left → right and reveals
 *             "MY DIGITAL Crafts" via clip-path on the blank canvas area.
 * REVEALING : crafts-hero.png (filled canvas) cross-fades in over the blank canvas.
 * EXITING   : whole overlay fades to transparent → onEnter().
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

type Phase = "idle" | "painting" | "revealing" | "exiting";

// Duration constants (ms)
const PAINT_MS   = 2400;   // how long the brush sweep takes
const REVEAL_MS  = 1100;   // cross-fade from blank → hero
const EXIT_MS    = 680;    // final fade-out before onEnter

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [vw,    setVw]    = useState(375);
  const [vh,    setVh]    = useState(700);
  const calledRef         = useRef(false);

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

  // Auto-advance phases
  useEffect(() => {
    if (phase === "painting") {
      const t = setTimeout(() => setPhase("revealing"), PAINT_MS + 200);
      return () => clearTimeout(t);
    }
    if (phase === "revealing") {
      const t = setTimeout(() => setPhase("exiting"), REVEAL_MS);
      return () => clearTimeout(t);
    }
    if (phase === "exiting") {
      const t = setTimeout(finish, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [phase, finish]);

  const handleOpen = () => {
    if (phase !== "idle") return;
    setPhase("painting");
  };

  // ── Image sizing ──────────────────────────────────────────────────────────────
  // Portrait canvas image, ratio ≈ 0.755 w:h, capped so title+button fit
  const IW  = Math.min(vw * 0.80, 350);
  const IH  = Math.min(IW / 0.755, vh * 0.54);

  // ── Paint text geometry — positioned over the blank canvas area (~top 26%) ──
  // "MY DIGITAL" line 1, "Crafts" line 2 in the creamy blank section of the image.
  const fs1      = Math.round(IW * 0.082);   // "MY DIGITAL" font-size
  const fs2      = Math.round(IW * 0.118);   // "Crafts" font-size
  const lineGap  = Math.round(IH * 0.013);
  const textH    = fs1 * 1.15 + lineGap + fs2 * 1.1;
  const textTop  = IH * 0.062;               // top of "MY DIGITAL" from image top
  const brushTop = textTop + fs1 * 0.1;      // brush y-centre (midway through line 1)

  const isPainting  = phase === "painting";
  const isRevealing = phase === "revealing" || phase === "exiting";
  const isExiting   = phase === "exiting";

  // How far the brush travels: a bit beyond the text edges
  const brushStart = IW * 0.06;
  const brushEnd   = IW * 0.92;

  return (
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.6, ease: "easeIn", delay: isExiting ? 0.15 : 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        background: "linear-gradient(165deg, #12080A 0%, #1E0E06 55%, #0D0806 100%)",
      }}
    >
      {/* ── Canvas image stack ── */}
      <div style={{
        position: "relative",
        width: IW, height: IH,
        flexShrink: 0,
        borderRadius: IW * 0.03,
        overflow: "hidden",
        boxShadow: [
          `0 ${IW * 0.07}px ${IW * 0.19}px rgba(0,0,0,0.70)`,
          `0 ${IW * 0.02}px ${IW * 0.06}px rgba(200,140,70,0.20)`,
        ].join(", "),
      }}>

        {/* Layer 1 — blank canvas (always shown as base) */}
        <img
          src="/crafts-bg.png"
          alt=""
          draggable={false}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "fill",
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        {/* Layer 2 — painted text (revealed left→right during PAINTING phase) */}
        <motion.div
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{
            clipPath: isPainting || isRevealing
              ? "inset(0 0% 0 0)"
              : "inset(0 100% 0 0)",
          }}
          transition={{ duration: PAINT_MS / 1000, ease: "linear" }}
          style={{
            position: "absolute",
            top: textTop,
            left: 0, right: 0,
            height: textH,
            textAlign: "center",
            zIndex: 3,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {/* "MY DIGITAL" */}
          <div style={{
            fontFamily: "Georgia, 'Palatino Linotype', serif",
            fontWeight: 700,
            fontSize: fs1,
            letterSpacing: "0.16em",
            color: "#5C3018",
            lineHeight: 1.15,
            textTransform: "uppercase",
            textShadow: "0 1px 2px rgba(255,248,236,0.55)",
          }}>
            MY DIGITAL
          </div>
          {/* "Crafts" in a larger, lighter script-style */}
          <div style={{
            marginTop: lineGap,
            fontFamily: "Georgia, 'Palatino Linotype', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: fs2,
            letterSpacing: "-0.01em",
            color: "#4A2010",
            lineHeight: 1.1,
            textShadow: "0 1px 3px rgba(255,248,236,0.50)",
          }}>
            Crafts
          </div>
        </motion.div>

        {/* Layer 3 — paintbrush emoji sweeps left→right */}
        {isPainting && (
          <motion.div
            aria-hidden
            initial={{ left: brushStart, opacity: 0 }}
            animate={{ left: brushEnd,   opacity: [0, 1, 1, 0] }}
            transition={{
              left:    { duration: PAINT_MS / 1000, ease: "linear" },
              opacity: { duration: PAINT_MS / 1000, times: [0, 0.05, 0.92, 1], ease: "linear" },
            }}
            style={{
              position: "absolute",
              top: brushTop,
              zIndex: 4,
              fontSize: IW * 0.10,
              lineHeight: 1,
              transform: "rotate(-25deg)",
              pointerEvents: "none",
              userSelect: "none",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
          >
            🖌️
          </motion.div>
        )}

        {/* Layer 4 — hero image (crafts-hero.png) fades in when REVEALING */}
        <motion.img
          src="/crafts-hero.png"
          alt=""
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: isRevealing ? 1 : 0 }}
          transition={{ duration: 0.95, ease: "easeInOut" }}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "fill",
            zIndex: 5,
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Title + button — fade out when painting starts ── */}
      <motion.div
        animate={{
          opacity: phase === "idle" ? 1 : 0,
          y:       phase === "idle" ? 0  : 10,
        }}
        transition={{ duration: 0.28 }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          pointerEvents: phase === "idle" ? "auto" : "none",
        }}
      >
        <div style={{ marginTop: vh * 0.030, textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 900,
            fontSize: `clamp(22px, ${IW * 0.132}px, 42px)`,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "#EDD9B4",
          }}>
            MY DIGITAL<br />CRAFTS
          </div>
          <div style={{
            marginTop: 8,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            color: "rgba(237,217,180,0.38)",
          }}>
            your creative collection
          </div>
        </div>

        <motion.button
          onClick={handleOpen}
          whileTap={{ scale: 0.96 }}
          style={{
            marginTop: vh * 0.034,
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800, fontSize: 15,
            letterSpacing: "0.03em",
            color: "#3A2210",
            background: "linear-gradient(to bottom, #EDD9B4, #C8944E)",
            border: "1.5px solid #B8894E",
            borderRadius: 100,
            padding: "13px 40px",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(140,90,40,0.50), 2px 2px 0 rgba(0,0,0,0.7)",
            whiteSpace: "nowrap",
          }}
        >
          Open Crafts ✨
        </motion.button>
      </motion.div>

      {/* ── Footer links ── */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        zIndex: 210,
      }}>
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
      </div>
    </motion.div>
  );
}
