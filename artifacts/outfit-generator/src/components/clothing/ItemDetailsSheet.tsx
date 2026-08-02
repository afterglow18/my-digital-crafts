/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Every field is optional and editable. A "Save" button appears only when
 * the form is dirty. Delete is always available.
 *
 * Props:
 *   showAddToLookbook — when true, shows "Add to Lookbook" instead of
 *                       "Clean Up Photo". Pass true from search results and
 *                       the favorites page; never from the main wardrobe.
 *
 * Also houses CleanupPhotoOverlay and LookbookPickerSheet.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCategoryNames } from "@/contexts/CategoryNamesContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Heart, Trash2, Save, ChevronDown, Sparkles, Check, Loader2, Bookmark,
} from "lucide-react";
import {
  type ClothingItem,
  type ClothingItemUpdateCategory,
  useUpdateClothingItem,
  useDeleteClothingItem,
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListClothingQueryKey,
  getListOutfitsQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import {
  removeBackground,
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

// ── LookbookPickerSheet ───────────────────────────────────────────────────────

interface LookbookPickerSheetProps {
  item: ClothingItem;
  onClose: () => void;
}

function LookbookPickerSheet({ item, onClose }: LookbookPickerSheetProps) {
  const { data: outfits = [] } = useListOutfits();
  const addToOutfit    = useAddItemToOutfit();
  const removeFromOutfit = useRemoveItemFromOutfit();
  const queryClient    = useQueryClient();
  const [pending, setPending] = useState<number | null>(null);

  const isInOutfit = (outfitId: number) =>
    outfits.find((o) => o.id === outfitId)?.items.some((i) => i.id === item.id) ?? false;

  const handleToggle = async (outfitId: number) => {
    if (pending != null) return;
    setPending(outfitId);
    try {
      if (isInOutfit(outfitId)) {
        await removeFromOutfit.mutateAsync({ id: outfitId, itemId: item.id });
      } else {
        await addToOutfit.mutateAsync({ id: outfitId, data: { itemId: item.id } });
      }
      queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    } finally {
      setPending(null);
    }
  };

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
          <Bookmark className="w-5 h-5" />
          Add to Lookbook
        </h2>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-[#8C4F48]/50 rounded-full flex items-center justify-center
                     bg-[#fdf8f0] text-[#3A2210] shadow-[2px_2px_0px_0px_rgba(139,94,60,0.25)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {outfits.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <p className="font-display font-bold text-sm uppercase tracking-tight text-[#6B3838]/50">
              No collections saved yet
            </p>
            <p className="text-xs text-[#6B3838]/35 mt-1">
              Save a collection from the Generate page first.
            </p>
          </div>
        ) : (
          outfits.map((outfit) => {
            const inIt  = isInOutfit(outfit.id);
            const thumbs = outfit.items.slice(0, 3);
            const busy  = pending === outfit.id;

            return (
              <button
                key={outfit.id}
                onClick={() => handleToggle(outfit.id)}
                disabled={busy}
                className="flex items-center gap-3 bg-white border-2 border-black rounded-xl px-3 py-3
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:shadow-none active:translate-x-0.5 active:translate-y-0.5
                           transition-all text-left disabled:opacity-60"
              >
                {/* 3-thumbnail row */}
                <div className="flex gap-1 shrink-0">
                  {[0, 1, 2].map((i) => {
                    const it = thumbs[i];
                    return (
                      <div
                        key={i}
                        className="w-12 h-12 border border-black/20 rounded-lg overflow-hidden"
                        style={{ background: "#F5EDD8" }}
                      >
                        {it?.imageObjectPath ? (
                          <img
                            src={getImageUrl(it.imageObjectPath)!}
                            alt={it.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Name */}
                <p className="flex-1 font-bold text-sm truncate text-[#3A2210]">
                  {outfit.name}
                </p>

                {/* Checkmark */}
                {inIt && (
                  <Check className="w-5 h-5 shrink-0 text-[#8C4F48]" strokeWidth={3} />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-4 bg-[#EDD9B4] border-t-2 border-[#8C4F48]/25 flex-shrink-0"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl border-2 border-[#8C4F48]
                     font-display font-bold text-sm uppercase tracking-tight
                     bg-gradient-to-b from-[#A06058] to-[#8C4F48] text-[#fdf8f0]
                     shadow-[0_4px_12px_rgba(139,94,60,0.4)]
                     active:opacity-90 transition-all"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}

// ── CleanupPhotoOverlay ───────────────────────────────────────────────────────

interface CleanupPhotoOverlayProps {
  sourceImageUrl: string;
  onConfirm: (chosenUrl: string) => void;
  onClose: () => void;
}

function CleanupPhotoOverlay({ sourceImageUrl, onConfirm, onClose }: CleanupPhotoOverlayProps) {
  const [cleanedUrl,  setCleanedUrl]  = useState<string | null>(null);
  const [processing,  setProcessing]  = useState(true);
  const [failed,      setFailed]      = useState(false);
  const [selected,    setSelected]    = useState<"original" | "cleaned">("original");
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    setCleanedUrl(null);
    setProcessing(true);
    setFailed(false);
    setSelected("original");

    (async () => {
      try {
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
        <p className="text-center font-display font-bold text-[11px] uppercase tracking-widest text-[#6B3838]/50">
          {processing
            ? "Removing background on device…"
            : failed
            ? "Background removal unavailable — keep the original"
            : "Tap to choose your version"}
        </p>

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
  /** When true: show "Add to Lookbook" button. When false/omitted: show "Clean Up Photo". */
  showAddToLookbook?: boolean;
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

export function ItemDetailsSheet({
  item,
  onClose,
  onDeleted,
  showAddToLookbook = false,
}: ItemDetailsSheetProps) {
  const { names: categoryNames } = useCategoryNames();
  const [form,              setForm]              = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCleanup,       setShowCleanup]       = useState(false);
  const [showLookbookPicker, setShowLookbookPicker] = useState(false);

  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (item) setForm(toForm(item));
    setShowDeleteConfirm(false);
    setShowCleanup(false);
    setShowLookbookPicker(false);
    setLocalImageUrl(null);
  }, [item?.id]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
  }, [queryClient]);

  if (!item || !form) return null;

  const dirty = isDirty(form, item);
  const displayedImageUrl = localImageUrl ?? item.imageObjectPath;
  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  const handleSave = () => {
    updateItem.mutate(
      {
        id: item.id,
        data: {
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

  const handleCleanupConfirm = (chosenUrl: string) => {
    setLocalImageUrl(chosenUrl);
    setShowCleanup(false);
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

  // Determine whether to show the action button row
  const showActionButton =
    showAddToLookbook ||
    (!!displayedImageUrl && !displayedImageUrl.startsWith("data:image/png"));

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
            {/* Favourite toggle */}
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

        {/* ── Action button row ── */}
        {showActionButton && (
          <div className="flex gap-2 px-4 pt-3">
            {showAddToLookbook ? (
              <button
                onClick={() => setShowLookbookPicker(true)}
                className="flex-1 flex items-center justify-center gap-1.5
                           px-3 py-2 rounded-lg
                           border-2 border-[#8C4F48]/50 bg-[#EDD9B4] text-[#3A2210]
                           font-display font-bold text-[11px] uppercase tracking-widest
                           shadow-[2px_2px_0px_0px_rgba(139,94,60,0.3)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Add to Lookbook
              </button>
            ) : (
              displayedImageUrl && !displayedImageUrl.startsWith("data:image/png") && (
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
              )
            )}
          </div>
        )}

        {/* ── Form ── */}
        <div className="flex-1 px-4 py-5 flex flex-col gap-4">

          <Field
            label="Item Name"
            value={form.name}
            onChange={patch("name") as (v: string) => void}
            placeholder="e.g. Watercolour Set"
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand"  value={form.brand}  onChange={patch("brand")  as (v: string) => void} placeholder="Brand…" />
            <Field label="Color"  value={form.color}  onChange={patch("color")  as (v: string) => void} placeholder="Navy Blue" />
          </div>

          <Field label="Size / Volume" value={form.size} onChange={patch("size") as (v: string) => void} placeholder="30ml, Full Size…" />

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Season"   value={form.season}   onChange={patch("season")   as (v: string) => void} options={SEASON_OPTIONS} />
            <SelectField label="Occasion" value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={OCCASION_OPTIONS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Price" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
            <Field label="Date"           value={form.purchaseDate}  onChange={patch("purchaseDate")  as (v: string) => void} type="date" />
          </div>

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

          <SelectField
            label="Category"
            value={form.category}
            onChange={patch("category") as (v: string) => void}
            options={CATEGORY_OPTIONS}
            displayMap={categoryNames}
          />

        </div>

        {/* ── Footer actions ── */}
        <div className="sticky bottom-0 px-4 py-4 bg-[#EDD9B4] border-t-2 border-[#8C4F48]/25 flex-shrink-0 flex flex-col gap-2">

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

      {/* ── Cleanup overlay ── */}
      <AnimatePresence>
        {showCleanup && displayedImageUrl && (
          <CleanupPhotoOverlay
            sourceImageUrl={displayedImageUrl}
            onConfirm={handleCleanupConfirm}
            onClose={() => setShowCleanup(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Lookbook picker ── */}
      <AnimatePresence>
        {showLookbookPicker && (
          <LookbookPickerSheet
            item={item}
            onClose={() => setShowLookbookPicker(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
