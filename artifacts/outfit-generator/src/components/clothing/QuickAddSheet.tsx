/**
 * QuickAddSheet
 *
 * Upload flow (single file):
 *   pick ──(file chosen)──► encoding ──► preview (Original | Cleaned ✨) ──► uploading ──► close
 *
 * Upload flow (multiple files, gallery multi-select):
 *   pick ──(files chosen)──► uploading ──► close  (BG removal skipped for batch)
 */
import React, { useRef, useState, useCallback } from "react";
import { useCategoryNames, type CategoryKey } from "@/contexts/CategoryNamesContext";
import { motion } from "framer-motion";
import {
  X,
  Loader2,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { encodeToPng } from "@/lib/processImage";
import {
  removeBackground,
  blobToDataUrl as bgBlobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "outfits" | "beauty" | "toiletries" | "essentials";


// Per spec: do NOT wrap phase blocks in AnimatePresence — use plain conditional divs.
type Phase = "pick" | "encoding" | "preview" | "uploading";

interface UploadProgress {
  current: number;
  total:   number;
}

// ── Helpers (outside component) ────────────────────────────────────────────────

/**
 * Resize to ≤ 2048px on the longest side and compress to JPEG.
 * Per spec — must run before removeBackground.
 */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

/**
 * Resize blob to ≤ 800px on the longest side.
 * Preserves transparency: PNG blobs stay PNG, JPEG blobs stay JPEG.
 * Used for DB storage — keeps imageObjectPath URLs small.
 */
function blobToStoredDataUrl(blob: Blob): Promise<string> {
  const isPng = blob.type === "image/png";
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      if (isPng) ctx.clearRect(0, 0, w, h); // preserve transparency
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error("encode failed"))),
        isPng ? "image/png" : "image/jpeg",
        isPng ? 1.0 : 0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

// blobToStoredDataUrl returns an object URL — we need a real data URL for IndexedDB.
async function blobToIndexedDbDataUrl(blob: Blob): Promise<string> {
  const isPng = blob.type === "image/png";
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      if (isPng) ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = isPng
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.82);
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

/** Multi-file batch: encode with encodeToPng then resize for storage. */
async function blobToJpegDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("failed to load image")); };
    img.src = objectUrl;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  onCreated?:    (item: import("@/lib/db").ClothingItem) => void;
}

const GENERIC_PHOTO_TIPS = [
  "Photograph individual products or bundle multiple items together.",
  "Lay everything flat on a plain background.",
  "Take the photo from directly above.",
  "Keep all items fully in frame.",
];

const PHOTO_TIPS: Record<string, string[]> = {
  outfits: [
    "Spread tools out on a flat, neutral surface so each item is visible.",
    "Use natural side-lighting to bring out bristle and pencil textures.",
    "Group by type (e.g. all brushes together) for a tidy shot.",
    "Include a ruler or your hand to show scale.",
  ],
  beauty: [
    "Lay items flat on a plain fabric or craft mat.",
    "Move in close to capture thread, bead, or paper textures.",
    "Arrange by colour for a visually organised photo.",
    "Show both packaged and open/in-use versions where possible.",
  ],
  toiletries: [
    "Shoot at a slight angle to show layers, stitching, or depth.",
    "Place a ruler or coin beside the piece to give a sense of scale.",
    "Capture front and back if both sides have detail worth noting.",
    "Use bright, even light to highlight fine details like stitching.",
  ],
  essentials: [
    "Photograph from an angle to show depth and how much a container holds.",
    "Open lids and boxes so the interior is visible.",
    "Place a few items inside to give context for the container's size.",
    "Make sure any labels are legible and face the camera.",
  ],
};

const CATEGORY_EXAMPLES: Record<string, { emoji: string; items: string[] }> = {
  outfits:    { emoji: "🎨", items: ["Brushes", "Paint", "Canvas", "Pencils", "Markers", "Watercolours", "Sketchbooks"] },
  beauty:     { emoji: "🧵", items: ["Yarn", "Fabric", "Beads", "Glue", "Scissors", "Ribbon", "Stamps", "Washi Tape"] },
  toiletries: { emoji: "🖼️", items: ["Works-in-progress", "Completed Pieces", "Sketches", "Patterns", "Templates"] },
  essentials: { emoji: "🗃️", items: ["Boxes", "Bins", "Organisers", "Labels", "Jars", "Containers", "Trays"] },
};

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  const { names: categoryNames } = useCategoryNames();
  // ── Phase & error ───────────────────────────────────────────────────────────
  const [phase,    setPhase]   = useState<Phase>("pick");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  // ── BG removal state ────────────────────────────────────────────────────────
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");
  // null = no active download (model cached or inference running); 0–99 = download percent
  const [bgModelPct,   setBgModelPct]   = useState<number | null>(null);

  // Each photo bumps this counter. Every async step checks it before writing
  // state — prevents a slow first photo from clobbering a fast second one.
  const bgGenRef = useRef(0);

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── Reset / close ───────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    bgGenRef.current += 1;   // cancels any in-flight removal
    setBgProcessing(false);  // MUST reset — close can happen mid-removal
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    setBgModelPct(null);
    setProgress(null);
    onOpenChange(false);
  }, [onOpenChange]);

  // ── Single-file BG removal flow (spec §4e + §4f) ───────────────────────────
  const handleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    const myGen = ++bgGenRef.current;
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setBgModelPct(null);
    setSelected("original");
    // Switch to encoding phase BEFORE any async work so the user sees a spinner
    // immediately instead of a blank pick screen for 1-3 s.
    setPhase("encoding");

    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    // Show original, switch to comparison screen
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    // Background removal — generation guard discards stale results
    setBgProcessing(true);
    try {
      const dataUrl = await bgBlobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl = await removeBackground(dataUrl, (pct) => {
        if (bgGenRef.current !== myGen) return;
        // pct 0–99 = downloading; 100 = download complete, inference running
        setBgModelPct(pct < 100 ? pct : null);
      });
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, []);

  // ── Save selected version ───────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhase("uploading");
    try {
      const dataUrl  = await blobToIndexedDbDataUrl(blob);
      const label    = categoryNames[category as CategoryKey];
      const autoName = existingCount === 0 ? label : `${label} ${existingCount + 1}`;
      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: dataUrl } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });
      handleClose();
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
    }
  }, [selected, cleanedBlob, originalBlob, category, existingCount, createItem, queryClient, onCreated, handleClose]);

  // ── Multi-file batch (gallery multi-select): skip BG removal ───────────────
  const saveOneFile = useCallback(async (file: File, itemIndex: number): Promise<boolean> => {
    let png: Blob;
    try {
      png = await encodeToPng(file);
    } catch {
      return false;
    }
    try {
      const dataUrl  = await blobToJpegDataUrl(png);
      const label    = categoryNames[category as CategoryKey];
      const n        = itemIndex + 1;
      const autoName = n === 1 ? label : `${label} ${n}`;
      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: dataUrl } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });
      return true;
    } catch {
      return false;
    }
  }, [category, createItem, queryClient, onCreated]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setErrorMsg(null);
    setPhase("uploading");
    setProgress({ current: 0, total: files.length });
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      const ok = await saveOneFile(files[i], existingCount + i);
      if (!ok) failed++;
    }
    setProgress(null);
    if (failed > 0) {
      setErrorMsg(`${failed} photo${failed > 1 ? "s" : ""} could not be saved. Please try again.`);
      setPhase("pick");
    } else {
      handleClose();
    }
  }, [saveOneFile, existingCount, handleClose]);

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleFile(files[0]);
    e.target.value = "";
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 1) {
      handleFile(files[0]); // single pick → BG removal flow
    } else if (files.length > 1) {
      handleFiles(files);   // multi-pick → batch upload
    }
    e.target.value = "";
  };

  if (!open) return null;

  const label = categoryNames[category as CategoryKey];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 bg-[#EDD9B4] border-b-2 border-[#8C4F48]/25 flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight text-[#3A2210]">
          {phase === "preview" ? "Choose Version" : `Add ${label}`}
        </h2>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-[#8C4F48]/50 rounded-full flex items-center justify-center
                       bg-[#fdf8f0] text-[#3A2210] shadow-[2px_2px_0px_0px_rgba(140,79,72,0.25)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body — plain divs, NO AnimatePresence (spec §4g) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* ── PICK ── */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200
                            rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Two big action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-primary
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Take<br />Photo
                </span>
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photo
                </span>
              </button>
            </div>

            {/* Photo tips */}
            <div className="border-2 border-black rounded-2xl bg-white p-4
                            shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                <span>📸</span> PHOTO TIPS
              </p>
              <ul className="flex flex-col gap-2">
                {(PHOTO_TIPS[category] ?? GENERIC_PHOTO_TIPS).map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                    <span className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm bg-primary
                                     flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── ENCODING — full-screen spinner, shown immediately after photo is picked ── */}
        {phase === "encoding" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
              <p className="text-sm text-black/50 mt-1">Getting your photo ready.</p>
            </div>
          </div>
        )}

        {/* ── PREVIEW — side-by-side comparison ── */}
        {phase === "preview" && (
          <div className="flex flex-col gap-4 p-4">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200
                            rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Hint text */}
            <p className="text-center font-display font-bold text-[11px] uppercase tracking-widest text-black/40">
              {bgProcessing
                ? bgModelPct !== null
                  ? `Downloading model… ${bgModelPct}%`
                  : "Processing…"
                : bgFailed
                ? "Background removal unavailable"
                : "Tap to choose"}
            </p>

            {/* Side-by-side cards */}
            <div className="flex gap-3">

              {/* Original */}
              <button
                onClick={() => setSelected("original")}
                className="flex-1 flex flex-col rounded-2xl overflow-hidden transition-all"
                style={{
                  border: selected === "original"
                    ? "4px solid black"
                    : "4px solid rgba(0,0,0,0.15)",
                  boxShadow: selected === "original"
                    ? "4px 4px 0px 0px rgba(0,0,0,1)"
                    : "none",
                  background: "none",
                  padding: 0,
                }}
              >
                <div className="bg-[#f0e8df] relative" style={{ minHeight: 180 }}>
                  <img
                    src={originalUrl!}
                    alt="Original"
                    style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }}
                  />
                  {selected === "original" && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#8C4F48]
                                    border-2 border-white flex items-center justify-center">
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
                    ? "4px solid black"
                    : "4px solid rgba(0,0,0,0.15)",
                  boxShadow: selected === "cleaned" && cleanedUrl
                    ? "4px 4px 0px 0px rgba(0,0,0,1)"
                    : "none",
                  background: "none",
                  padding: 0,
                  opacity: !cleanedUrl && !bgProcessing && !bgFailed ? 0.5 : 1,
                }}
              >
                {/* Checkerboard reveals transparency */}
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
                        style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }}
                      />
                      {selected === "cleaned" && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#8C4F48]
                                        border-2 border-white flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p className="font-display font-bold text-[11px] uppercase tracking-widest
                                  text-black/35 text-center px-3 py-8">
                      Could not remove background
                    </p>
                  ) : bgModelPct !== null ? (
                    /* First-run: model download in progress */
                    <div className="flex flex-col items-center gap-3 py-8 px-4 w-full">
                      <p className="font-display font-bold text-[11px] uppercase tracking-widest text-black/40">
                        Downloading model… {bgModelPct}%
                      </p>
                      <div className="w-full h-2 rounded-full overflow-hidden"
                           style={{ background: "rgba(0,0,0,0.12)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${bgModelPct}%`, background: "rgba(0,0,0,0.5)" }}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Cached model: just show spinner */
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-black/40" />
                      <p className="font-display font-bold text-[11px] uppercase tracking-widest text-black/40">
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

            {/* Actions */}
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setPhase("pick")}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                           border-2 border-[#8C4F48]/40 bg-[#fdf8f0] text-[#3A2210] font-display font-bold text-sm uppercase
                           tracking-tight shadow-[2px_2px_0px_0px_rgba(140,79,72,0.25)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={bgProcessing && selected === "cleaned"}
                className="flex-1 py-3 rounded-xl border-2 border-[#8C4F48]
                           font-display font-bold text-sm uppercase tracking-tight
                           bg-[#8C4F48] text-[#F5E8D8]
                           shadow-[0_4px_12px_rgba(140,79,72,0.4)]
                           active:opacity-90
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {bgProcessing && selected === "cleaned"
                  ? "Processing…"
                  : selected === "cleaned" && cleanedUrl
                  ? "✓ Save Cleaned Version"
                  : "✓ Save to Crafts"}
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
              <p className="text-sm text-black/50 mt-1">
                {progress && progress.total > 1
                  ? `Photo ${progress.current} of ${progress.total}`
                  : "Adding to your crafts."}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* File inputs — must NOT be display:none on iOS/WKWebView (causes hard crash).
          Keep in layout tree but invisible via opacity+size-0. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0, overflow: "hidden" }}
        tabIndex={-1}
        aria-hidden
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGalleryChange}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0, overflow: "hidden" }}
        tabIndex={-1}
        aria-hidden
      />
    </motion.div>
  );
}
