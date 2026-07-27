/**
 * WelcomePage — Crafts shelf splash screen.
 *
 * IDLE    : crafts-hero.png centred, gently floating. Title + button below.
 * EXITING : hero image scales up to fill the whole screen, content fades out.
 *           500 ms later → onEnter().
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<"idle" | "exiting">("idle");
  const [vw, setVw]       = useState(375);
  const [vh, setVh]       = useState(700);
  const calledRef         = useRef(false);

  useEffect(() => {
    const update = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Hero image: 78 % of viewport width, capped for tablets
  const IW = Math.min(vw * 0.78, 340);
  // Image is portrait ~0.755 w:h ratio
  const IH = IW / 0.755;

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (phase !== "idle") return;
    setPhase("exiting");
    setTimeout(finish, 680);
  };

  const isExiting = phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.55, ease: "easeIn", delay: isExiting ? 0.3 : 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* ── Background — warm deep brown ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(165deg, #12080A 0%, #1E0E06 55%, #0D0806 100%)",
      }} />

      {/* ── Full-screen hero — scales up from centre on tap ── */}
      <motion.img
        src="/crafts-hero.png"
        alt=""
        draggable={false}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "contain",
          objectPosition: "center top",
          zIndex: 8,
          userSelect: "none",
          pointerEvents: "none",
          transformOrigin: "center center",
          background: "#f5ede0",
        }}
        initial={{ opacity: 0, scale: 0.22 }}
        animate={isExiting
          ? { opacity: 1, scale: 1 }
          : { opacity: 0, scale: 0.22 }
        }
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* ── Main content (hero img + text + button) ── */}
      <motion.div
        style={{
          position: "relative", zIndex: 4,
          display: "flex", flexDirection: "column", alignItems: "center",
        }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={{ duration: 0.25 }}
      >
        {/* Hero image — gently floats when idle */}
        <motion.img
          src="/crafts-hero.png"
          alt="My Digital Crafts"
          draggable={false}
          style={{
            width: IW,
            height: IH,
            objectFit: "contain",
            borderRadius: IW * 0.04,
            boxShadow: [
              `0 ${IW * 0.07}px ${IW * 0.18}px rgba(0,0,0,0.65)`,
              `0 ${IW * 0.02}px ${IW * 0.06}px rgba(210,150,80,0.25)`,
            ].join(", "),
            userSelect: "none",
            display: "block",
          }}
          animate={isExiting
            ? { opacity: 0, scale: 1.06, y: -12 }
            : {
                y: [0, -10, 0],
                opacity: 1,
                scale: 1,
              }
          }
          transition={isExiting
            ? { duration: 0.22 }
            : {
                y:       { repeat: Infinity, duration: 3.6, ease: "easeInOut" },
                opacity: { duration: 0.6, ease: "easeOut" },
              }
          }
        />

        {/* Title */}
        <div style={{ marginTop: vh * 0.036, textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 900,
            fontSize: `clamp(24px, ${IW * 0.145}px, 44px)`,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "#EDD9B4",
          }}>
            MY DIGITAL<br />CRAFTS
          </div>
          <div style={{
            marginTop: 9,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            color: "rgba(237,217,180,0.38)",
          }}>
            your creative collection
          </div>
        </div>

        {/* Button */}
        <motion.button
          onClick={handleOpen}
          animate={{
            opacity: phase === "idle" ? 1 : 0,
            y:       phase === "idle" ? 0  : 8,
          }}
          transition={{ duration: 0.2 }}
          style={{
            marginTop: vh * 0.038,
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
            pointerEvents: phase === "idle" ? "auto" : "none",
          }}
        >
          Open Crafts ✨
        </motion.button>
      </motion.div>

      {/* Footer links */}
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
