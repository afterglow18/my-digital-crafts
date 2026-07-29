/**
 * WelcomePage — Full-screen paintbrush reveal.
 *
 * IDLE     : black screen, title + "Open Crafts ✨" button centred.
 * PAINTING : button fades; crafts-hero.png is painted onto the full screen
 *            by a left-to-right clip-path sweep with a 🖌️ riding the leading edge.
 * EXITING  : brief hold, then fade to black → onEnter().
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";


interface Props { onEnter: () => void; }

type Phase = "idle" | "painting" | "exiting";

const PAINT_MS = 2600;
const HOLD_MS  = 420;
const EXIT_MS  = 550;

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
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

  // Brush tracks from slightly off the left edge to slightly off the right
  const brushSize = Math.round(Math.min(vw, vh) * 0.13);
  const brushY    = vh * 0.38; // vertical midpoint of the hero image

  return (
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#8C4A20",
        overflow: "hidden",
      }}
    >
      {/* ── Hero image — clip-path sweeps left → right on tap ── */}
      <motion.img
        src="/crafts-hero.png"
        alt=""
        draggable={false}
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{
          clipPath: isPainting || isExiting
            ? "inset(0 0% 0 0)"
            : "inset(0 100% 0 0)",
        }}
        transition={{ duration: PAINT_MS / 1000, ease: [0.1, 0.0, 0.2, 1.0] }}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          display: "block",
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Soft paint-edge glow — rides just behind the brush ── */}
      {isPainting && (
        <motion.div
          aria-hidden
          initial={{ left: -vw * 0.10 }}
          animate={{ left: vw * 1.05 }}
          transition={{ duration: PAINT_MS / 1000, ease: [0.1, 0.0, 0.2, 1.0] }}
          style={{
            position: "absolute",
            top: 0,
            width: vw * 0.12,
            height: "100%",
            background: "linear-gradient(to right, transparent, rgba(255,240,200,0.18), transparent)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      )}

      {/* ── Paintbrush emoji — rides the leading edge ── */}
      {isPainting && (
        <motion.div
          aria-hidden
          initial={{ left: -brushSize * 0.5, opacity: 0 }}
          animate={{
            left:    vw + brushSize * 0.2,
            opacity: [0, 1, 1, 0.6, 0],
          }}
          transition={{
            left:    { duration: PAINT_MS / 1000, ease: [0.1, 0.0, 0.2, 1.0] },
            opacity: { duration: PAINT_MS / 1000, times: [0, 0.04, 0.88, 0.96, 1], ease: "linear" },
          }}
          style={{
            position: "absolute",
            top: brushY - brushSize * 0.5,
            zIndex: 3,
            width: brushSize * 0.42,
            height: brushSize * 1.35,
            transform: "rotate(-30deg)",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.55))",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {/* Inline SVG paintbrush — brown wooden handle */}
          <svg viewBox="0 0 34 110" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            {/* Handle — warm brown wood */}
            <rect x="12" y="0" width="10" height="72" rx="5" fill="#7B3F10"/>
            <rect x="13.5" y="2" width="3" height="66" rx="2" fill="rgba(255,220,170,0.18)"/>
            {/* Ferrule — brushed metal band */}
            <rect x="10" y="69" width="14" height="11" rx="2" fill="#C8A45A"/>
            <rect x="10" y="72" width="14" height="2" fill="rgba(255,255,255,0.18)"/>
            {/* Bristles — tapered dark tuft */}
            <ellipse cx="17" cy="95" rx="7" ry="16" fill="#1E0D06"/>
            <ellipse cx="17" cy="86" rx="6.5" ry="5" fill="#2A1208"/>
            {/* Bristle highlight */}
            <ellipse cx="15" cy="90" rx="2" ry="7" fill="rgba(255,255,255,0.07)"/>
          </svg>
        </motion.div>
      )}

      {/* ── Title + button — shown while idle, fade out on paint start ── */}
      <motion.div
        animate={{
          opacity: phase === "idle" ? 1 : 0,
          y:       phase === "idle" ? 0  : 14,
        }}
        transition={{ duration: 0.25 }}
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          zIndex: 4,
          pointerEvents: phase === "idle" ? "auto" : "none",
          paddingTop: "env(safe-area-inset-top, 0px)",
          marginTop: -vh * 0.12,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: vh * 0.044 }}>
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 900,
            fontSize: `clamp(28px, ${vw * 0.115}px, 52px)`,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "#EDD9B4",
          }}>
            MY DIGITAL<br />CRAFTS
          </div>
          <div style={{
            marginTop: 10,
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

      {/* ── Footer links ── */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        zIndex: 10,
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
