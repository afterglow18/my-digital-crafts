/**
 * visionIndexer — background photo-analysis service.
 *
 * On app start, finds all items that need (re-)indexing and processes them
 * one at a time with a 350 ms gap between each so the UI stays responsive.
 * Shows a non-blocking "Preparing photo search…" toast while running.
 *
 * Version scheme:
 *   0 = unanalysed
 *   1 = iOS Vision only (legacy — no canvas colours; will be re-indexed → 2)
 *   2 = iOS Vision + canvas colour extraction merged
 *   4 = web canvas complete, labels found
 *   5 = web canvas complete, no labels found — do NOT retry
 */

import { Capacitor } from "@capacitor/core";
import { listClothing, getClothingItem, updateClothingItem } from "./localDB";
import { extractColorsFromDataUrl, analyzeImageNative } from "./visionExtractor";
import type { ClothingItem } from "./db";

const WEB_COMPLETE_VERSION  = 4;
const WEB_NO_LABELS_VERSION = 5;
const IOS_COMPLETE_VERSION  = 2;   // iOS Vision + canvas colours merged
const IOS_LEGACY_VERSION    = 1;   // old iOS-only, no canvas colours — must re-index

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function processOne(item: ClothingItem): Promise<void> {
  if (!item.imageObjectPath) {
    // No photo — mark analysed so we don't retry
    const v = Capacitor.isNativePlatform() ? IOS_COMPLETE_VERSION : WEB_NO_LABELS_VERSION;
    await updateClothingItem(item.id, { visionLabels: [], visionText: [], visionVersion: v });
    return;
  }

  if (Capacitor.isNativePlatform()) {
    const dataUrl = item.imageObjectPath;
    // Strip "data:<mime>;base64," prefix → raw base64 for the native call
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

    // Run Apple Vision (object labels) and canvas colour extraction in parallel
    const [nativeResult, canvasColors] = await Promise.all([
      analyzeImageNative(base64),
      extractColorsFromDataUrl(dataUrl),
    ]);

    // Merge: Vision labels first, then canvas colour names (deduplicated)
    const mergedLabels = [...new Set([...nativeResult.labels, ...canvasColors])];

    await updateClothingItem(item.id, {
      visionLabels:  mergedLabels,
      visionText:    nativeResult.text,
      visionVersion: IOS_COMPLETE_VERSION,
    });
  } else {
    const colors = await extractColorsFromDataUrl(item.imageObjectPath);
    await updateClothingItem(item.id, {
      visionLabels:  colors,
      visionText:    [],
      visionVersion: colors.length > 0 ? WEB_COMPLETE_VERSION : WEB_NO_LABELS_VERSION,
    });
  }
}

/**
 * Queue a single item for immediate (fire-and-forget) analysis.
 * Call this after a photo is added or replaced.
 */
export function queueItemForIndexing(itemId: number): void {
  (async () => {
    try {
      const item = await getClothingItem(itemId);
      if (item) await processOne(item);
    } catch (err) {
      console.warn("[VisionIndexer] immediate indexing error:", err);
    }
  })();
}

let _started = false;

/**
 * Start the background indexer.  Safe to call multiple times — runs only once.
 * Call from main.tsx before React mounts.
 */
export async function startVisionIndexer(): Promise<void> {
  if (_started) return;
  _started = true;

  // Yield to let the app paint first
  await delay(1500);

  try {
    const all      = await listClothing();
    const isNative = Capacitor.isNativePlatform();

    const needsIndex = all.filter((item) => {
      const v = item.visionVersion;
      if (isNative) {
        // v0 = never analysed; v1 = legacy iOS-only (no canvas colours) — both need indexing
        return v === 0 || v === IOS_LEGACY_VERSION;
      }
      // Re-run anything below WEB_COMPLETE that isn't the explicit "no labels" sentinel
      return v < WEB_COMPLETE_VERSION && v !== WEB_NO_LABELS_VERSION;
    });

    if (needsIndex.length === 0) return;

    for (const item of needsIndex) {
      await processOne(item);
      await delay(350);
    }
  } catch (err) {
    console.warn("[VisionIndexer] background indexing error:", err);
  }
}
