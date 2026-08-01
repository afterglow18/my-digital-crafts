/**
 * WardrobePage — briefcase-bg.png (1024×1536 PNG)
 *
 * Layout: 4 shelf sections inside a Hollywood-mirror frame.
 * Items sit ON TOP of each shelf surface (bottom-anchored within each section).
 * Baked-in pink "ADD X" pills show through the background when shelves are empty;
 * a React-rendered transparent tap zone handles the click.
 * When items are present, the carousel fills the section and covers the pill.
 *
 * Sections (y-fractions of image height):
 *   Section 1 (TOPS):        0.19 → 0.39
 *   Section 2 (BOTTOMS):     0.39 → 0.55
 *   Section 3 (SHOES):       0.55 → 0.71
 *   Section 4 (ACCESSORIES): 0.71 → 0.85
 *
 * No rod-overlay technique needed — shelf surfaces are already below items.
 * Save outfit: floating pill button at the top of the mirror.
 */

import React, {
  useEffect, useRef, useState,
  useCallback, RefObject,
} from "react";
import { useLocation } from "wouter";
import {
  useListClothing, getListClothingQueryKey,
  useListOutfits, getListOutfitsQueryKey,
  useSaveOutfit,
  type ClothingItem,
} from "@/hooks/useLocalDB";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ClosetRow, ClosetRowHandle } from "@/components/ClosetRow";
import { QuickAddSheet } from "@/components/clothing/QuickAddSheet";
import { ItemDetailsSheet } from "@/components/clothing/ItemDetailsSheet";
import { UpgradeSheet, UpgradeReason } from "@/components/paywall/UpgradeSheet";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FREE_ITEM_LIMIT } from "@/lib/entitlements";
import { useCategoryNames, type CategoryKey } from "@/contexts/CategoryNamesContext";

// ── Types ─────────────────────────────────────────────────────────────────────
type RowKey   = "outfits" | "beauty" | "toiletries" | "essentials";
type Category = "outfits" | "beauty" | "toiletries" | "essentials";

const ROWS: { key: RowKey }[] = [
  { key: "outfits"    },
  { key: "beauty"     },
  { key: "toiletries" },
  { key: "essentials" },
];

// ── Image constants ───────────────────────────────────────────────────────────
const IMG_W = 1024;
const IMG_H = 1536;
const NAV_H = 90;

// ── Landmark fractions (calibrated for crafts-bg.png easel canvas) ───────────
// Blank canvas on easel. Canvas content runs ~y=0.13 → 0.80 (above toolbar).
// 4 zones of equal height (~0.167 each), heading at zone top, photos below.
// doorL/doorR:  left/right edges of the canvas face.
const LM = {
  doorL: 0.197,   // +0.015 vs previous — centres content on the canvas face
  doorR: 0.791,   // +0.015 vs previous

  rows: [
    { sectionTop: 0.147, shelfY: 0.291, btnCY: 0.120 },  // ART SUPPLIES   (section 0.144)
    { sectionTop: 0.306, shelfY: 0.450, btnCY: 0.279 },  // CRAFT SUPPLIES (gap 0.015)
    { sectionTop: 0.465, shelfY: 0.609, btnCY: 0.438 },  // PROJECTS
    { sectionTop: 0.624, shelfY: 0.768, btnCY: 0.597 },  // STORAGE
  ],

  saveAreaY: 0.84,
} as const;

// ── useImageRect ─────────────────────────────────────────────────────────────
interface ImgRect {
  top: number; left: number; width: number; height: number;
  containerH: number; containerW: number;
}

function useImageRect(containerRef: RefObject<HTMLDivElement>): ImgRect {
  const [rect, setRect] = useState<ImgRect>({ top: 0, left: 0, width: 0, height: 0, containerH: 0, containerW: 0 });
  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      if (!c) return;
      const cW = c.clientWidth, cH = c.clientHeight;
      const iR = IMG_W / IMG_H;
      // Fill: stretch image to exactly match container — full bed visible
      setRect({ top: 0, left: 0, width: cW, height: cH, containerH: cH, containerW: cW });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [containerRef]);
  return rect;
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────
const pH = (ir: ImgRect, f: number) => ir.height * f;
const pW = (ir: ImgRect, f: number) => ir.width  * f;
const pX = (ir: ImgRect, f: number) => ir.left   + ir.width  * f;
const pY = (ir: ImgRect, f: number) => ir.top    + ir.height * f;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WardrobePage() {
  const { names } = useCategoryNames();
  const containerRef = useRef<HTMLDivElement>(null!);
  const ir = useImageRect(containerRef);

  const rowRefs: Record<RowKey, RefObject<ClosetRowHandle | null>> = {
    outfits:    useRef<ClosetRowHandle | null>(null),
    beauty:     useRef<ClosetRowHandle | null>(null),
    toiletries: useRef<ClosetRowHandle | null>(null),
    essentials: useRef<ClosetRowHandle | null>(null),
  };

  const [centred,       setCentred]       = useState<Partial<Record<RowKey, ClothingItem>>>({});
  const [addCategory,   setAddCategory]   = useState<Category | null>(null);
  const [detailsItem,   setDetailsItem]   = useState<ClothingItem | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const saveOutfit = useSaveOutfit();

  const { data: outfitsItems  = [] } = useListClothing({ category: "outfits"    }, { query: { queryKey: getListClothingQueryKey({ category: "outfits"    }) } });
  const { data: beautyItems   = [] } = useListClothing({ category: "beauty"     }, { query: { queryKey: getListClothingQueryKey({ category: "beauty"     }) } });
  const { data: toiletriesItems = [] } = useListClothing({ category: "toiletries" }, { query: { queryKey: getListClothingQueryKey({ category: "toiletries" }) } });
  const { data: essentialsItems = [] } = useListClothing({ category: "essentials" }, { query: { queryKey: getListClothingQueryKey({ category: "essentials" }) } });
  const { data: savedOutfitsList = [] } = useListOutfits();

  const rowData: Record<RowKey, ClothingItem[]> = { outfits: outfitsItems, beauty: beautyItems, toiletries: toiletriesItems, essentials: essentialsItems };
  const totalItems = outfitsItems.length + beautyItems.length + toiletriesItems.length + essentialsItems.length;


  const queryClient = useQueryClient();
  const { tier, canAddItem } = useEntitlements();

  useEffect(() => {
    setCentred(prev => {
      const next = { ...prev };
      let changed = false;
      (["outfits", "beauty", "toiletries", "essentials"] as RowKey[]).forEach(key => {
        if (rowData[key].length === 0 && next[key] !== undefined) {
          delete next[key]; changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [outfitsItems.length, beautyItems.length, toiletriesItems.length, essentialsItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCentredHandlers: Record<RowKey, (item: ClothingItem | null) => void> = {
    outfits:    useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, outfits:    item ?? undefined })), []),
    beauty:     useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, beauty:     item ?? undefined })), []),
    toiletries: useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, toiletries: item ?? undefined })), []),
    essentials: useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, essentials: item ?? undefined })), []),
  };

  const handleAddClick = useCallback((cat: Category) => {
    if (canAddItem(totalItems)) setAddCategory(cat); else setUpgradeReason("items");
  }, [canAddItem, totalItems]);

  const addHandlers: Record<RowKey, () => void> = {
    outfits:    useCallback(() => handleAddClick("outfits"),    [handleAddClick]),
    beauty:     useCallback(() => handleAddClick("beauty"),     [handleAddClick]),
    toiletries: useCallback(() => handleAddClick("toiletries"), [handleAddClick]),
    essentials: useCallback(() => handleAddClick("essentials"), [handleAddClick]),
  };

  const handleItemTap = useCallback((item: ClothingItem) => setDetailsItem(item), []);

  const [, navigate] = useLocation();

  // ── Save-name prompt ─────────────────────────────────────────────────────
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const handleDirectSave = useCallback(() => {
    const itemIds = Object.values(centred)
      .filter((i): i is ClothingItem => i != null)
      .map(i => i.id);
    if (itemIds.length === 0) { navigate("/saved"); return; }
    setSaveName("");
    setSavePromptOpen(true);
  }, [centred, navigate]);

  const handleConfirmSave = useCallback(() => {
    const itemIds = Object.values(centred)
      .filter((i): i is ClothingItem => i != null)
      .map(i => i.id);
    const name = saveName.trim() || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    setSavePromptOpen(false);
    saveOutfit.mutate(
      { data: { name, itemIds } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }); navigate("/saved"); } },
    );
  }, [centred, saveName, saveOutfit, queryClient, navigate]);
  const isFree    = tier === "free";
  const itemsLeft = isFree ? Math.max(0, FREE_ITEM_LIMIT - totalItems) : null;
  const ready     = ir.width > 0;

  // ── Section layout helpers ────────────────────────────────────────────────
  const sectionHeights = ready
    ? LM.rows.map(lm => pH(ir, lm.shelfY - lm.sectionTop))
    : LM.rows.map(() => 0);

  // Use the smallest row height so all carousels show photos at the same size
  const uniformPhotoH = Math.max(0, Math.min(...sectionHeights) - 4);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: `calc(100dvh - ${NAV_H}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
        overflow: "hidden",
        background: "#C8B9A2",
      }}
    >
      {/* ── Background image — object-fit:cover avoids WebKit negative-left clipping bug ── */}
      <img
        src="/crafts-bg.png"
        alt="My Digital Crafts"
        style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%", height: "100%",
          objectFit: "fill",
          objectPosition: "center",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />

      {ready && (
        <>
          {/* ── Page title ── */}
          <div style={{
            position: "absolute",
            top: `calc(${pY(ir, 0.016)}px )`,
            left: 8,
            right: 8,
            zIndex: 25,
            textAlign: "center",
            pointerEvents: "none",
            overflow: "hidden",
          }}>
            <div style={{
              fontFamily: "'Dancing Script', cursive",
              fontWeight: 700,
              fontSize: Math.max(16, Math.min(pW(ir, 0.075), ir.containerW * 0.095)),
              color: "#F5F0E8",
              lineHeight: 1.1,
              textShadow: "0 1px 8px rgba(0,0,0,0.18)",
            }}>
              My Digital Crafts
            </div>
          </div>

          {/* ── Item-count badge (free tier) ── */}
          {itemsLeft !== null && (
            <button
              onClick={() => setUpgradeReason("items")}
              data-testid="badge-item-count"
              aria-label={`${totalItems} of ${FREE_ITEM_LIMIT} items used — tap to upgrade`}
              style={{
                position: "absolute",
                top: `calc(${pY(ir, 0.068)}px )`, left: "50%", transform: "translateX(-50%)",
                zIndex: 25,
                padding: "2px 8px", borderRadius: 20, border: "none",
                background: totalItems >= FREE_ITEM_LIMIT
                  ? "rgba(200,40,40,0.14)"
                  : "rgba(255,255,255,0.55)",
                boxShadow: totalItems >= FREE_ITEM_LIMIT
                  ? "0 0 0 2px rgba(200,40,40,0.40)"
                  : "0 0 0 1.5px rgba(180,100,110,0.28)",
                color: totalItems >= FREE_ITEM_LIMIT ? "#aa0000" : "#7a3a40",
                fontWeight: 700, fontSize: 8,
                letterSpacing: "0.08em", textTransform: "uppercase",
                whiteSpace: "nowrap", cursor: "pointer",
              }}
            >
              {totalItems}/{FREE_ITEM_LIMIT} ITEMS
            </button>
          )}

          {/* ── 4 shelf rows ── */}
          {ROWS.map(({ key }, rowIdx) => {
            const btnLabel = `+ ${names[key as CategoryKey].toUpperCase()}`;
            const lm      = LM.rows[rowIdx];
            const items   = rowData[key];

            const secTop  = pY(ir, lm.sectionTop);
            const secH    = pH(ir, lm.shelfY - lm.sectionTop);
            const carLeft = pX(ir, LM.doorL);
            const carW    = pW(ir, LM.doorR - LM.doorL);

            // ADD button: centered in the section at btnCY
            const btnCY   = pY(ir, lm.btnCY);
            const btnH    = Math.max(32, pH(ir, 0.045));

            const labelY = pY(ir, lm.btnCY + (lm.sectionTop - lm.btnCY) * 0.08);

            return (
              <React.Fragment key={key}>

                {/* ── Category label (tappable → add photo) ── */}
                <button
                  onClick={addHandlers[key]}
                  aria-label={btnLabel}
                  style={{
                    position: "absolute",
                    top: labelY,
                    left: carLeft,
                    width: carW,
                    transform: "translateY(-50%)",
                    zIndex: 23,
                    textAlign: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <span style={{
                    display: "inline-block",
                    background: "rgba(140, 79, 72, 0.88)",
                    color: "#F5E8D8",
                    borderRadius: 20,
                    padding: `2px 12px`,
                    fontSize: Math.max(9, pH(ir, 0.012)),
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    fontFamily: "var(--font-display)",
                    textTransform: "uppercase",
                    boxShadow: "0 1px 5px rgba(0,0,0,0.22)",
                    border: "1px solid rgba(237,217,180,0.18)",
                  }}>
                    {btnLabel}
                  </span>
                </button>

                {/* ── Item carousel — fills the section between buttons ── */}
                {items.length > 0 && (
                  <div
                    data-testid={`row-${key}`}
                    style={{
                      position: "absolute",
                      top:    secTop,
                      left:   carLeft,
                      width:  carW,
                      height: secH,
                      zIndex: 10,
                      overflow: "visible",
                    }}
                  >
                    <ClosetRow
                      ref={rowRefs[key]}
                      items={items}
                      onCenteredItem={setCentredHandlers[key]}
                      onItemTap={handleItemTap}
                      maxPhotoH={uniformPhotoH}
                    />
                  </div>
                )}

                {/* ── ADD button ──────────────────────────────────────────
                    Always a transparent tap zone sitting exactly over the
                    baked-in pink pill in the background image (at btnCY).
                    The carousel lives BELOW the pill (sectionTop > btnCY),
                    so this zone is never obscured by items.               */}
                <button
                  onClick={addHandlers[key]}
                  aria-label={btnLabel}
                  data-testid={`add-btn-${key}`}
                  style={{
                    position: "absolute",
                    top:    btnCY - btnH / 2,
                    left:   carLeft,
                    width:  carW,
                    height: btnH,
                    zIndex: 22,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                />

              </React.Fragment>
            );
          })}


          {/* ── Bottom toolbar — anchored to base of image, no fraction math ──
               Covers the baked-in paintbrush / Save / scissors row.
               height 13% matches the toolbar's visual height in crafts-bg.png. */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "13%",
              zIndex: 27,
              display: "flex",
            }}
          >
            {/* LEFT: paintbrush → Favorites */}
            <button
              onClick={() => navigate("/favorites")}
              aria-label="Go to favourites"
              data-testid="button-favorites"
              style={{ flex: "0 0 25%", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            />
            {/* CENTER: Save → save to lookbook */}
            <button
              onClick={handleDirectSave}
              aria-label="Save to lookbook"
              data-testid="button-save"
              style={{ flex: "1 1 50%", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            />
            {/* RIGHT: scissors → Plan / account page */}
            <button
              onClick={() => navigate("/account")}
              aria-label="Go to plan"
              data-testid="button-plan"
              style={{ flex: "0 0 25%", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            />
          </div>
        </>
      )}

      {/* ── Save-name prompt modal ── */}
      <AnimatePresence>
        {savePromptOpen && (
          <motion.div
            key="save-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 80,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 28px",
            }}
            onClick={() => setSavePromptOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{ scale: 0.92,    opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 280 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: "#F9F4EE",
                borderRadius: 18,
                padding: "28px 24px 20px",
                width: "100%",
                maxWidth: 340,
                boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                display: "flex", flexDirection: "column", gap: 16,
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18, fontWeight: 700,
                  color: "#5C3A2E",
                  letterSpacing: "0.04em",
                }}>
                  Name Your Craft Box
                </span>
                <button
                  onClick={() => setSavePromptOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#9C7B6B" }}
                  aria-label="Cancel"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Text input */}
              <input
                autoFocus
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleConfirmSave()}
                placeholder="e.g. Painting"
                maxLength={60}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid rgba(140,79,72,0.30)",
                  background: "#fff",
                  fontSize: 15,
                  color: "#3D2218",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setSavePromptOpen(false)}
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: "1.5px solid rgba(140,79,72,0.25)",
                    background: "transparent",
                    color: "#8C4F48",
                    fontSize: 14, fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  style={{
                    flex: 2,
                    padding: "11px 0",
                    borderRadius: 12,
                    border: "none",
                    background: "#8C4F48",
                    color: "#F9F4EE",
                    fontSize: 14, fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {upgradeReason && (
          <UpgradeSheet reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {addCategory && (
          <QuickAddSheet
            key={addCategory}
            open={!!addCategory}
            onOpenChange={open => !open && setAddCategory(null)}
            category={addCategory}
            existingCount={rowData[addCategory as RowKey]?.length ?? 0}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detailsItem && (
          <ItemDetailsSheet
            key={detailsItem.id}
            item={detailsItem}
            onClose={() => setDetailsItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
