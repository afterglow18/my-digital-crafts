/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Every field is optional and editable. A "Save" button appears only when
 * the form is dirty. Delete is always available.
 *
 * Also houses CleanupPhotoOverlay — the side-by-side Original | Cleaned ✨
 * comparison overlay triggered by "Clean Up Photo".
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCategoryNames } from "@/contexts/CategoryNamesContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Heart, Trash2, Save, ChevronDown, Sparkles, Check, Loader2,
} from "lucide-react";
import {
  type ClothingItem,
  type ClothingItemUpdateCategory,
  useUpdateClothingItem,
  useDeleteClothingItem,
  getListClothingQueryKey,
  getListOutfitsQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import {
  removeBackground,
  blobToDataUrl as bgBlobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEASON_OPTIONS    = ["", "Spring", "Summer", "Fall", "Winter", "All Season"];
const OCCASION_OPTIONS  = ["", "Casual", "Work", "Formal", "Sport", "Special Event"];
const CATEGORY_OPTIONS  = ["outfits", "beauty", "toiletries", "essentials"];

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#6B3838]/55">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border-2 border-[#8C4F48]/30 rounded-lg px-3 py-2 text-sm font-medium
                   text-[#3A2210] bg-[#fdf8f0] focus:outline-none focus:ring-2 focus:ring-[#A06058]/30
                   placeholder:font-normal placeholder:text-[#6B3838]/25"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  displayMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  displayMap?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#6B3838]/55">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border-2 border-[#8C4F48]/30 rounded-lg px-3 py-2 pr-8
                     text-sm font-medium text-[#3A2210] bg-[#fdf8f0] focus:outline-none focus:ring-2 focus:ring-[#A06058]/30
                     cursor-pointer"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {(displayMap?.[o] ?? o) || `— ${label} —`}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[#6B3838]/40" />
      </div>
    </div>
  );
}

// ── CleanupPhotoOverlay ───────────────────────────────────────────────────────

interface CleanupPhotoOverlayProps {
  /** Raw imageObjectPath value from the DB (data URL or object URL). */
  sourceImageUrl: string;
  onConfirm: (chosenUrl: string) => void;
  onClose: () => void;
}

function CleanupPhotoOverlay({ sourceImageUrl, onConfirm, onClose }: CleanupPhotoOverlayProps) {
  const [cleanedUrl,  setCleanedUrl]  = useState<string | null>(null);
  const [processing,  setProcessing]  = useState(true);
  const [failed,      setFailed]      = useState(false);
  const [selected,    setSelected]    = useState<"original" | "cleaned">("original");
  // Guard — if user closes mid-run, discard the result.
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    setCleanedUrl(null);
    setProcessing(true);
    setFailed(false);
    setSelected("original");

    (async () => {
      try {
        // sourceImageUrl is a data URL stored in IndexedDB — fetch() handles it fine.
        const resultUrl = await removeBackground(sourceImageUrl);
        if (!activeRef.current) return;
        setCleanedUrl(resultUrl);
        setSelected("cleaned");
      } catch (err) {
        if (!activeRef.current) return;
        console.warn("CleanupPhotoOverlay: background removal failed", err);
        setFailed(true);
      } finally {
        if (activeRef.current) setProcessing(false);
      }
    })();

    return () => { activeRef.current = false; };
  }, [sourceImageUrl]);

  const handleClose = useCallback(() => {
    activeRef.current = false;
    onClose();
  }, [onClose]);

  const saveLabel =
    selected === "cleaned" && cleanedUrl ? "Save Cleaned Version" : "Keep Original";

  const handleSave = useCallback(() => {
    const chosen = selected === "cleaned" && cleanedUrl ? cleanedUrl : sourceImageUrl;
    onConfirm(chosen);
  }, [selected, cleanedUrl, sourceImageUrl, onConfirm]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[75] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 bg-[#EDD9B4] border-b-2 border-[#8C4F48]/25 flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight flex items-center gap-2 text-[#3A2210]">
          <Sparkles className="w-5 h-5" />
          Clean Up Photo
        </h2>
        <button
          onClick={handleClose}
          className="w-9 h-9 border-2 border-[#8C4F48]/50 rounded-full flex items-center justify-center
                     bg-[#fdf8f0] text-[#3A2210] shadow-[2px_2px_0px_0px_rgba(139,94,60,0.25)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">

        {/* Hint */}
        <p className="text-center font-display font-bold text-[11px] uppercase tracking-widest text-[#6B3838]/50">
          {processing
            ? "Removing background on device…"
            : failed
            ? "Background removal unavailable — keep the original"
            : "Tap to choose your version"}
        </p>

        {/* Side-by-side cards */}
        <div className="flex gap-3">

          {/* Original */}
          <button
            onClick={() => setSelected("original")}
            className="flex-1 flex flex-col rounded-2xl overflow-hidden transition-all"
            style={{
              border: selected === "original"
                ? "4px solid #8C4F48"
                : "4px solid rgba(0,0,0,0.10)",
              boxShadow: selected === "original"
                ? "4px 4px 0px 0px rgba(139,94,60,0.45)"
                : "none",
              background: "none",
              padding: 0,
            }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                minHeight: 180,
              }}
            >
              <img
                src={getImageUrl(sourceImageUrl)!}
                alt="Original"
                style={{ width: "100%", objectFit: "contain", maxHeight: 220, display: "block" }}
              />
              {selected === "original" && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#8C4F48]
                                border-2 border-white flex items-center justify-center shadow">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="bg-[#EDD9B4] py-2 px-2 border-t border-[#8C4F48]/20">
              <p className="font-display font-bold text-[11px] uppercase tracking-widest text-center text-[#3A2210]">
                Original
              </p>
            </div>
          </button>

          {/* Cleaned ✨ */}
          <button
            onClick={() => cleanedUrl && setSelected("cleaned")}
            disabled={!cleanedUrl}
            className="flex-1 flex flex-col rounded-2xl overflow-hidden transition-all"
            style={{
              border: selected === "cleaned" && cleanedUrl
                ? "4px solid #8C4F48"
                : "4px solid rgba(0,0,0,0.10)",
              boxShadow: selected === "cleaned" && cleanedUrl
                ? "4px 4px 0px 0px rgba(139,94,60,0.45)"
                : "none",
              background: "none",
              padding: 0,
            }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                minHeight: 180,
              }}
            >
              {cleanedUrl ? (
                <>
                  <img
                    src={cleanedUrl}
                    alt="Background removed"
                    style={{ width: "100%", objectFit: "contain", maxHeight: 220, display: "block" }}
                  />
                  {selected === "cleaned" && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#8C4F48]
                                    border-2 border-white flex items-center justify-center shadow">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </>
              ) : failed ? (
                <p className="font-display font-bold text-[11px] uppercase tracking-widest
                              text-black/35 text-center px-3 py-8 leading-relaxed">
                  Could not remove background
                </p>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-black/40" />
                  <p className="font-display font-bold text-[11px] uppercase tracking-widest text-black/40 text-center">
                    Processing
                  </p>
                </div>
              )}
            </div>
            <div className="bg-[#EDD9B4] py-2 px-2 border-t border-[#8C4F48]/20">
              <p className="font-display font-bold text-[11px] uppercase tracking-widest text-center text-[#3A2210]">
                Cleaned ✨
              </p>
            </div>
          </button>

        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 bg-[#EDD9B4] border-t-2 border-[#8C4F48]/25 flex-shrink-0 flex gap-3">
        <button
          onClick={handleClose}
          className="px-5 py-3 rounded-xl border-2 border-[#8C4F48]/40 bg-[#fdf8f0] text-[#3A2210]
                     font-display font-bold text-sm uppercase tracking-tight
                     shadow-[2px_2px_0px_0px_rgba(139,94,60,0.25)]
                     active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={processing && selected === "cleaned"}
          className="flex-1 py-3 rounded-xl border-2 border-[#8C4F48]
                     font-display font-bold text-sm uppercase tracking-tight
                     bg-gradient-to-b from-[#A06058] to-[#8C4F48] text-[#fdf8f0]
                     shadow-[0_4px_12px_rgba(139,94,60,0.4)]
                     active:opacity-90
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {processing ? "Processing…" : saveLabel}
        </button>
      </div>
    </motion.div>
  );
}

// ── ItemDetailsSheet ──────────────────────────────────────────────────────────

interface ItemDetailsSheetProps {
  item: ClothingItem | null;
  onClose: () => void;
  onDeleted?: () => void;
}

interface FormState {
  name: string;
  brand: string;
  color: string;
  size: string;
  season: string;
  occasion: string;
  purchasePrice: string;
  purchaseDate: string;
  notes: string;
  isFavorite: boolean;
  category: string;
}

function toForm(item: ClothingItem): FormState {
  return {
    name:          item.name          ?? "",
    brand:         item.brand         ?? "",
    color:         item.color         ?? "",
    size:          item.size          ?? "",
    season:        item.season        ?? "",
    occasion:      item.occasion      ?? "",
    purchasePrice: item.purchasePrice ?? "",
    purchaseDate:  item.purchaseDate  ?? "",
    notes:         item.notes         ?? "",
    isFavorite:    item.isFavorite    ?? false,
    category:      item.category      ?? "",
  };
}

function isDirty(form: FormState, item: ClothingItem): boolean {
  return (
    form.name          !== (item.name          ?? "") ||
    form.brand         !== (item.brand         ?? "") ||
    form.color         !== (item.color         ?? "") ||
    form.size          !== (item.size          ?? "") ||
    form.season        !== (item.season        ?? "") ||
    form.occasion      !== (item.occasion      ?? "") ||
    form.purchasePrice !== (item.purchasePrice ?? "") ||
    form.purchaseDate  !== (item.purchaseDate  ?? "") ||
    form.notes         !== (item.notes         ?? "") ||
    form.isFavorite    !== (item.isFavorite    ?? false) ||
    form.category      !== (item.category      ?? "")
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayLocalDate(): string {
  // Returns YYYY-MM-DD in the user's local timezone
  return new Date().toLocaleDateString("en-CA");
}

function fmtWorkedDate(dateStr: string): string {
  // "YYYY-MM-DD" → "M/D/YY"
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
}

export function ItemDetailsSheet({ item, onClose, onDeleted }: ItemDetailsSheetProps) {
  const { names: categoryNames } = useCategoryNames();
  const [form,              setForm]              = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCleanup,       setShowCleanup]       = useState(false);

  /**
   * Optimistic image URL — written immediately when the user confirms a cleaned
   * version, before the DB write completes. Falls back to item.imageObjectPath.
   */
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);

  // ── Craft-tracking state (projects only) ────────────────────────────────────
  const [localTimesWorn,      setLocalTimesWorn]      = useState(item?.timesWorn ?? 0);
  const [localLastWorkedDate, setLocalLastWorkedDate] = useState<string | null>(item?.lastWorkedDate ?? null);
  const [prevLastWorkedDate,  setPrevLastWorkedDate]  = useState<string | null | undefined>(undefined);

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const queryClient = useQueryClient();

  // Reset form and cleanup state whenever item changes
  useEffect(() => {
    if (item) {
      setForm(toForm(item));
      setLocalTimesWorn(item.timesWorn ?? 0);
      setLocalLastWorkedDate(item.lastWorkedDate ?? null);
      setPrevLastWorkedDate(undefined);
    }
    setShowDeleteConfirm(false);
    setShowCleanup(false);
    setLocalImageUrl(null);
  }, [item?.id]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
  }, [queryClient]);

  // ── Craft-tracking helpers ───────────────────────────────────────────────────
  const isProject    = item?.category === "toiletries";
  const todayStr     = todayLocalDate();
  const isLoggedToday = localLastWorkedDate === todayStr;

  const handleLogToday = useCallback(() => {
    const nextCount = localTimesWorn + 1;
    setPrevLastWorkedDate(localLastWorkedDate);
    setLocalTimesWorn(nextCount);
    setLocalLastWorkedDate(todayStr);
    updateItem.mutate(
      { id: item!.id, data: { timesWorn: nextCount, lastWorkedDate: todayStr } },
      { onSuccess: invalidateAll },
    );
  }, [localTimesWorn, localLastWorkedDate, todayStr, item, updateItem, invalidateAll]);

  const handleUndoLog = useCallback(() => {
    const nextCount = Math.max(0, localTimesWorn - 1);
    const restoredDate = prevLastWorkedDate ?? null;
    setLocalTimesWorn(nextCount);
    setLocalLastWorkedDate(restoredDate);
    setPrevLastWorkedDate(undefined);
    updateItem.mutate(
      { id: item!.id, data: { timesWorn: nextCount, lastWorkedDate: restoredDate } },
      { onSuccess: invalidateAll },
    );
  }, [localTimesWorn, prevLastWorkedDate, item, updateItem, invalidateAll]);

  if (!item || !form) return null;

  const dirty = isDirty(form, item);

  // Displayed image: local optimistic value wins when set, otherwise DB value.
  const displayedImageUrl = localImageUrl ?? item.imageObjectPath;

  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  const handleSave = () => {
    updateItem.mutate(
      {
        id: item.id,
        data: {
          // Always send every editable field so the backend can clear it when empty.
          // Backend converts "" → null in DB.
          name:          form.name.trim() || item.name,
          brand:         form.brand.trim(),
          color:         form.color.trim(),
          size:          form.size.trim(),
          season:        form.season,
          occasion:      form.occasion,
          purchasePrice: form.purchasePrice.trim(),
          purchaseDate:  form.purchaseDate.trim(),
          notes:         form.notes.trim(),
          isFavorite:    form.isFavorite,
          category:      (form.category || item.category) as ClothingItemUpdateCategory,
        },
      },
      {
        onSuccess: () => {
          invalidateAll();
          onClose();
        },
      }
    );
  };

  const handleDelete = () => {
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          invalidateAll();
          onDeleted?.();
          onClose();
        },
      }
    );
  };

  /**
   * Called when the user confirms a choice in the cleanup overlay.
   * 1. Update the displayed photo immediately (optimistic).
   * 2. Close the overlay.
   * 3. Fire the DB write in the background — no await, no spinner.
   */
  const handleCleanupConfirm = (chosenUrl: string) => {
    // Optimistic: show chosen photo NOW
    setLocalImageUrl(chosenUrl);
    setShowCleanup(false);
    // Background DB write
    updateItem.mutate(
      { id: item.id, data: { imageObjectPath: chosenUrl } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
        },
      }
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed inset-0 z-[65] flex flex-col max-w-md mx-auto bg-[#f9f4ee] overflow-y-auto"
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4
                        bg-[#EDD9B4] border-b-2 border-[#8C4F48]/25 flex-shrink-0"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight text-[#3A2210]">
            Item Details
          </h2>
          <div className="flex items-center gap-2">
            {/* Favourite toggle — saves instantly */}
            <button
              onClick={() => {
                const next = !form.isFavorite;
                patch("isFavorite")(next);
                updateItem.mutate(
                  { id: item.id, data: { isFavorite: next } },
                  { onSuccess: invalidateAll }
                );
              }}
              className={`w-9 h-9 border-2 rounded-full flex items-center justify-center transition-all
                          ${form.isFavorite
                            ? "border-[#8C4F48] bg-[#8C4F48] shadow-[2px_2px_0px_0px_rgba(139,94,60,0.3)]"
                            : "border-[#8C4F48]/40 bg-[#fdf8f0] shadow-[2px_2px_0px_0px_rgba(139,94,60,0.2)]"}`}
              title="Favourite"
            >
              <Heart
                className="w-4 h-4"
                fill={form.isFavorite ? "white" : "none"}
                stroke={form.isFavorite ? "white" : "currentColor"}
              />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-9 h-9 border-2 border-[#8C4F48]/40 rounded-full flex items-center justify-center
                         bg-[#fdf8f0] text-[#3A2210] shadow-[2px_2px_0px_0px_rgba(139,94,60,0.2)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Photo ── */}
        {displayedImageUrl && (
          <div className="flex-shrink-0">
            <div
              className="w-full h-52 border-b-2 border-black"
              style={{
                backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)",
                backgroundSize: "16px 16px",
              }}
            >
              <img
                src={getImageUrl(displayedImageUrl)!}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* ── Button row — sits below photo (or at top if no photo) ── */}
        {(isProject || (displayedImageUrl && !displayedImageUrl.startsWith("data:image/png"))) && (
          <div className="flex gap-2 px-4 pt-3">
            {isProject && (
              <button
                onClick={isLoggedToday ? handleUndoLog : handleLogToday}
                className={`flex-1 flex items-center justify-center gap-1.5
                           px-3 py-2 rounded-lg border-2 font-display font-bold text-[11px]
                           uppercase tracking-widest transition-all
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                           ${isLoggedToday
                             ? "border-[#8C4F48] bg-[#8C4F48] text-[#F5F0E8] shadow-[2px_2px_0px_0px_rgba(139,94,60,0.3)]"
                             : "border-[#8C4F48]/50 bg-[#EDD9B4] text-[#3A2210] shadow-[2px_2px_0px_0px_rgba(139,94,60,0.3)]"
                           }`}
              >
                {isLoggedToday ? "Logged ✓ · Undo" : "Today's Project"}
              </button>
            )}
            {displayedImageUrl && !displayedImageUrl.startsWith("data:image/png") && (
              <button
                onClick={() => setShowCleanup(true)}
                className="flex-1 flex items-center justify-center gap-1.5
                           px-3 py-2 rounded-lg
                           border-2 border-[#8C4F48]/50 bg-[#EDD9B4] text-[#3A2210]
                           font-display font-bold text-[11px] uppercase tracking-widest
                           shadow-[2px_2px_0px_0px_rgba(139,94,60,0.3)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Clean Up Photo
              </button>
            )}
          </div>
        )}

        {/* ── Form ── */}
        <div className="flex-1 px-4 py-5 flex flex-col gap-4">

          {/* Name */}
          <Field
            label="Item Name"
            value={form.name}
            onChange={patch("name") as (v: string) => void}
            placeholder="e.g. White Linen Shirt"
          />

          {/* Brand + Color */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand"  value={form.brand} onChange={patch("brand") as (v: string) => void} placeholder="Nike, Zara…" />
            <Field label="Color"  value={form.color} onChange={patch("color") as (v: string) => void} placeholder="Navy Blue" />
          </div>

          {/* Size */}
          <Field label="Size / Volume" value={form.size} onChange={patch("size") as (v: string) => void} placeholder="30ml, 50ml, Full Size…" />

          {/* Season + Occasion */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Season"   value={form.season}   onChange={patch("season") as (v: string) => void}   options={SEASON_OPTIONS} />
            <SelectField label="Occasion" value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={OCCASION_OPTIONS} />
          </div>

          {/* Price + Date */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Price" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
            <Field label="Date"  value={form.purchaseDate}  onChange={patch("purchaseDate") as (v: string) => void}  type="date" />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#6B3838]/55">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => patch("notes")(e.target.value)}
              placeholder="Anything worth remembering…"
              rows={3}
              className="w-full border-2 border-[#8C4F48]/30 rounded-lg px-3 py-2 text-sm font-medium
                         text-[#3A2210] bg-[#fdf8f0] focus:outline-none focus:ring-2 focus:ring-[#A06058]/30 resize-none
                         placeholder:font-normal placeholder:text-[#6B3838]/25"
            />
          </div>

          {/* Category (editable) + Times Worked On / Times Worn */}
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Category"
              value={form.category}
              onChange={patch("category") as (v: string) => void}
              options={CATEGORY_OPTIONS}
              displayMap={categoryNames}
            />
            {isProject ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B3838]/55">Times Worked On</span>
                <input
                  type="number"
                  min="0"
                  value={localTimesWorn}
                  onChange={e => {
                    const n = Math.max(0, parseInt(e.target.value) || 0);
                    setLocalTimesWorn(n);
                  }}
                  onBlur={e => {
                    const n = Math.max(0, parseInt(e.target.value) || 0);
                    setLocalTimesWorn(n);
                    updateItem.mutate(
                      { id: item.id, data: { timesWorn: n } },
                      { onSuccess: invalidateAll },
                    );
                  }}
                  className="border-2 border-[#8C4F48]/30 rounded-lg px-3 py-2 text-sm font-medium
                             text-[#3A2210] bg-[#fdf8f0] focus:outline-none focus:ring-2 focus:ring-[#8C4F48]/20"
                />
                {localLastWorkedDate && (
                  <span className="text-[10px] text-[#6B3838]/55 mt-0.5">
                    Last worked on: {fmtWorkedDate(localLastWorkedDate)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1 opacity-50 pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B3838]/55">Times Worn</span>
                <div className="border-2 border-[#8C4F48]/20 rounded-lg px-3 py-2 text-sm font-medium bg-[#fdf8f0]/50 text-[#3A2210]">
                  {item.timesWorn ?? 0}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Footer actions ── */}
        <div className="sticky bottom-0 px-4 py-4 bg-[#EDD9B4] border-t-2 border-[#8C4F48]/25 flex-shrink-0 flex flex-col gap-2">

          {/* Save (only when dirty) */}
          <AnimatePresence>
            {dirty && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={handleSave}
                disabled={updateItem.isPending}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                           font-bold uppercase tracking-tight
                           bg-gradient-to-b from-[#A06058] to-[#8C4F48] text-[#fdf8f0]
                           border-2 border-[#8C4F48]
                           shadow-[0_4px_12px_rgba(139,94,60,0.35)]
                           active:opacity-90 transition-all"
              >
                <Save className="w-4 h-4" />
                {updateItem.isPending ? "Saving…" : "Save Changes"}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Delete */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                         font-bold uppercase border-2 border-[#8C4F48]/20 text-[#6B3838]/40
                         hover:border-[#8C4F48] hover:text-[#8C4F48] transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete from Crafts Forever
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-[#8C4F48]/40 bg-[#fdf8f0] text-[#3A2210]
                           shadow-[2px_2px_0px_0px_rgba(139,94,60,0.2)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteItem.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-[#8C4F48]
                           bg-[#8C4F48] text-white
                           shadow-[2px_2px_0px_0px_rgba(139,60,40,0.4)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                           disabled:opacity-50"
              >
                {deleteItem.isPending ? "Deleting…" : "Yes, Delete Forever"}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Cleanup overlay (sits above ItemDetailsSheet at z-[75]) ── */}
      <AnimatePresence>
        {showCleanup && displayedImageUrl && (
          <CleanupPhotoOverlay
            sourceImageUrl={displayedImageUrl}
            onConfirm={handleCleanupConfirm}
            onClose={() => setShowCleanup(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
