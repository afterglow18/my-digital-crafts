/**
 * ClosetRow — fixed 3-slot carousel for the wardrobe closet view.
 *
 * • Fills its container exactly (position it over the image's 3 placeholder boxes).
 * • Divides width into 3 equal slots: left | center | right.
 * • Center item: scale 1.0, opacity 1.  Side items: scale ~0.82, opacity ~0.62.
 * • Swipe gesture translates the strip; release snaps to the nearest item.
 * • Empty slots render nothing → image's placeholder cards show through.
 * • No background (container transparent).
 *
 * Handle (forwardRef): scrollToIndex(i, smooth?)
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ClothingItem } from "@workspace/api-client-react";
import { getImageUrl } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ClosetRowHandle {
  scrollToIndex: (index: number, smooth?: boolean) => void;
  getLength: () => number;
}

interface ClosetRowProps {
  items: ClothingItem[];
  /** Pixel height of the hanger graphic drawn above each card photo */
  hangerH: number;
  onCenteredItem: (item: ClothingItem | null) => void;
  onItemTap?: (item: ClothingItem) => void;
}

// ── Hanger SVG ────────────────────────────────────────────────────────────────
function HangerSVG({
  width,
  height,
  dim = false,
}: {
  width: number;
  height: number;
  dim?: boolean;
}) {
  const hw = width;
  const h  = height;
  const s  = dim ? "rgba(176,136,40,0.30)" : "#C49B2A";
  return (
    <svg width={hw} height={h} viewBox={`0 0 ${hw} ${h}`} fill="none" style={{ display: "block" }}>
      <path
        d={`M${hw/2} ${h*0.12} Q${hw/2} ${h*0.04} ${hw/2+3} ${h*0.04} Q${hw/2+7} ${h*0.04} ${hw/2+7} ${h*0.26} Q${hw/2+7} ${h*0.46} ${hw/2} ${h*0.46}`}
        stroke={s} strokeWidth="1.8" strokeLinecap="round" fill="none"
      />
      <line x1={hw/2} y1={h*0.46} x2={hw/2} y2={h*0.76} stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d={`M${hw/2} ${h*0.76} Q${hw*0.22} ${h*0.84} 4 ${h}`} stroke={s} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d={`M${hw/2} ${h*0.76} Q${hw*0.78} ${h*0.84} ${hw-4} ${h}`} stroke={s} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <line x1={4} y1={h} x2={hw-4} y2={h} stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export const ClosetRow = forwardRef<ClosetRowHandle, ClosetRowProps>(
  ({ items, hangerH, onCenteredItem, onItemTap }, ref) => {

    // ── Container measurement ─────────────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null);
    const [slotW,      setSlotW]    = useState(0);
    const [containerH, setContH]   = useState(0);

    useLayoutEffect(() => {
      const measure = () => {
        const el = containerRef.current;
        if (!el) return;
        setSlotW(el.clientWidth / 3);
        setContH(el.clientHeight);
      };
      measure();
      const ro = new ResizeObserver(measure);
      if (containerRef.current) ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, []);

    // ── Carousel state ─────────────────────────────────────────────────────────
    const [centredIdx,    setCentredIdx]  = useState(0);
    const [dragX,         setDragX]       = useState(0);
    const [transitioning, setTransition]  = useState(false);

    // Refs so callbacks capture stable references
    const dragStartX   = useRef(0);
    const isDragging   = useRef(false);
    // hasDragged is set true once the pointer has moved far enough during a drag;
    // used to suppress the synthetic click that fires after pointerup.
    const hasDragged   = useRef(false);
    // Track last notified item *identity* so parent is updated on both index AND
    // content changes (e.g. item replaced at the same position).
    const lastNotifiedId = useRef<number | null>(null);

    // Clamp centredIdx when items array shrinks
    useEffect(() => {
      if (items.length === 0) return;
      setCentredIdx(i => Math.max(0, Math.min(items.length - 1, i)));
    }, [items.length]);

    // Notify parent whenever the centered item's identity changes
    useEffect(() => {
      if (items.length === 0) {
        if (lastNotifiedId.current !== null) {
          lastNotifiedId.current = null;
          onCenteredItem(null);
        }
        return;
      }
      const clamped = Math.max(0, Math.min(items.length - 1, centredIdx));
      const item    = items[clamped];
      if (item && item.id !== lastNotifiedId.current) {
        lastNotifiedId.current = item.id;
        onCenteredItem(item);
      }
    });   // intentionally runs every render — the id-gate is the dedup

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      scrollToIndex: (index, smooth = true) => {
        const clamped = Math.max(0, Math.min(items.length - 1, index));
        if (smooth) {
          setTransition(true);
          setCentredIdx(clamped);
          setTimeout(() => setTransition(false), 320);
        } else {
          setTransition(false);
          setCentredIdx(clamped);
        }
      },
      getLength: () => items.length,
    }), [items.length]);

    // ── Pointer events ────────────────────────────────────────────────────────
    const onPointerDown = useCallback((e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartX.current = e.clientX;
      isDragging.current = true;
      hasDragged.current = false;
      setTransition(false);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStartX.current;
      if (!hasDragged.current && Math.abs(dx) > 6) hasDragged.current = true;
      setDragX(dx);
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const dx    = e.clientX - dragStartX.current;
      const moved = hasDragged.current;
      setTransition(true);
      setDragX(0);
      if (moved && slotW > 0) {
        const THRESH = slotW * 0.20;
        if (dx < -THRESH) {
          setCentredIdx(i => Math.min(items.length - 1, i + 1));
        } else if (dx > THRESH) {
          setCentredIdx(i => Math.max(0, i - 1));
        }
      }
      setTimeout(() => setTransition(false), 320);
    }, [slotW, items.length]);

    // ── Item tap (center → open details; side → re-center) ───────────────────
    const onItemActivate = useCallback((item: ClothingItem, idx: number) => {
      // hasDragged is a ref; if the pointer moved significantly, suppress the click
      if (hasDragged.current) return;
      if (idx === centredIdx) {
        onItemTap?.(item);
      } else {
        setTransition(true);
        setCentredIdx(idx);
        setTimeout(() => setTransition(false), 320);
      }
    }, [centredIdx, onItemTap]);

    // ── Geometry ──────────────────────────────────────────────────────────────
    const baseX  = (1 - centredIdx) * slotW;
    const stripX = baseX + dragX;

    // Items beyond ±1.65 slots from center are invisible; all others same size/opacity.
    const isVisible = (i: number) => {
      const itemCX    = i * slotW + slotW / 2 + stripX;
      const containerCX = (slotW * 3) / 2;
      return Math.abs(itemCX - containerCX) / slotW <= 1.65;
    };

    const lo    = Math.max(0, centredIdx - 2);
    const hi    = Math.min(items.length - 1, centredIdx + 2);
    // Card fills ~88% of each slot so it lines up with the image placeholder boxes
    const cardW = slotW > 0 ? Math.round(slotW * 0.88) : 0;
    const cardH = Math.max(0, containerH - hangerH);
    const padX  = (slotW - cardW) / 2;

    // Blush-pink selection indicator colours
    const PINK_BORDER = "rgba(225, 110, 155, 0.88)";
    const PINK_GLOW   = "0 0 0 2px rgba(225,110,155,0.22), 0 4px 18px rgba(225,110,155,0.28)";

    // Don't render until we've measured the container
    if (!slotW || !containerH) {
      return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
    }

    return (
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          touchAction: "pan-y",
          userSelect: "none",
          cursor: items.length > 1 ? "ew-resize" : "default",
        }}
      >
        {/* Strip — all (visible-range) items side by side */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: items.length * slotW,
            height: "100%",
            transform: `translateX(${stripX}px)`,
            transition: transitioning
              ? "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)"
              : "none",
            willChange: "transform",
          }}
        >
          {items.slice(lo, hi + 1).map((item, localIdx) => {
            const i        = lo + localIdx;
            if (!isVisible(i)) return null;
            const isCenter = i === centredIdx;

            return (
              <button
                key={item.id}
                onClick={() => onItemActivate(item, i)}
                aria-label={isCenter
                  ? `${item.name ?? "Item"} — selected. Tap to view details.`
                  : `${item.name ?? "Item"} — tap to select`}
                aria-pressed={isCenter}
                style={{
                  // All items identical size — no scale transform
                  position: "absolute",
                  top: 0,
                  left: i * slotW + padX,
                  width: cardW,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: isCenter ? "pointer" : "ew-resize",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {/* Hanger — gold for selected, dimmed for others */}
                <div
                  style={{
                    flexShrink: 0,
                    height: hangerH,
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <HangerSVG
                    width={Math.round(cardW * 0.62)}
                    height={hangerH}
                    dim={!isCenter}
                  />
                </div>

                {/* Photo card — blush-pink border + glow on selected item.
                    border and box-shadow always transition so the highlight
                    glides smoothly to the newly selected card on every swipe. */}
                <div
                  style={{
                    flex: 1,
                    width: "100%",
                    overflow: "hidden",
                    borderRadius: "0 0 10px 10px",
                    background: "rgba(255, 251, 244, 0.97)",
                    // 4–5 px blush-pink border on selected; near-invisible on others
                    border: isCenter
                      ? `4.5px solid ${PINK_BORDER}`
                      : "1.5px solid rgba(196,155,42,0.14)",
                    borderTop: "none",     // hanger covers the top edge
                    // Soft outer glow on selected
                    boxShadow: isCenter
                      ? PINK_GLOW
                      : "0 2px 8px rgba(0,0,0,0.06)",
                    // Always-on transition — border/shadow move to the new card instantly
                    transition: "border-color 0.24s ease, border-width 0.24s ease, box-shadow 0.24s ease",
                    position: "relative",
                    pointerEvents: "none",
                  }}
                >
                  {item.imageObjectPath ? (
                    <img
                      src={getImageUrl(item.imageObjectPath)!}
                      alt={item.name ?? ""}
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.3rem",
                        opacity: 0.5,
                      }}
                    >
                      {item.name?.slice(0, 2) ?? "👗"}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

ClosetRow.displayName = "ClosetRow";
