/**
 * visionExtractor — photo analysis for search indexing.
 *
 * Web:    Draws image to 48×48 canvas, samples corner patches to find the
 *         studio background colour, excludes matching pixels, maps the
 *         surviving pixels to named colour buckets, returns colours that
 *         cover ≥10 % of foreground pixels.
 *
 * iOS:    Delegates to the native VisionPlugin (VNClassifyImageRequest +
 *         VNRecognizeTextRequest). Falls back silently to empty arrays.
 *
 * Version scheme used by the indexer:
 *   0 = unanalysed
 *   1 = iOS Vision only, legacy (no canvas colours — will be re-indexed → 2)
 *   2 = iOS Vision + canvas colours merged
 *   4 = web canvas complete (colour labels present)
 *   5 = web canvas complete, no labels found (don't retry)
 */

import { registerPlugin } from "@capacitor/core";

// ── iOS native plugin ─────────────────────────────────────────────────────────

interface VisionPluginInterface {
  analyzeImage(options: { imageBase64: string }): Promise<{ labels: string[]; text: string[] }>;
}

const NativeVision = registerPlugin<VisionPluginInterface>("VisionPlugin");

export async function analyzeImageNative(
  imageBase64: string,
): Promise<{ labels: string[]; text: string[] }> {
  try {
    return await NativeVision.analyzeImage({ imageBase64 });
  } catch {
    return { labels: [], text: [] };
  }
}

// ── Named colour bucket mapping ───────────────────────────────────────────────

function pixelToColorName(r: number, g: number, b: number): string {
  const brightness = (r + g + b) / 3;

  if (brightness < 80)  return "black";
  if (brightness < 110) return "dark grey";
  if (brightness < 175) return "grey";
  if (brightness < 225) return "light grey";
  if (r > 220 && g > 220 && b > 220) return "white";

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;

  // Near-neutral warm tones
  if (saturation < 0.15) return brightness < 200 ? "beige" : "white";

  // Brown / tan / beige  (warm, low-sat, red dominant)
  if (saturation < 0.5 && r > g && r > b) {
    if (brightness < 120) return "brown";
    if (brightness < 165) return "tan";
    return "beige";
  }

  // Hue in degrees
  let hue = 0;
  if (max === r)      hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else                hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  if (hue < 15 || hue >= 345) return "red";
  if (hue < 40)  return "orange";
  if (hue < 70)  return "yellow";
  if (hue < 155) return "green";
  if (hue < 185) return "teal";
  if (hue < 260) return "blue";
  if (hue < 290) return "purple";
  return "pink";
}

// ── Corner-patch background detection ────────────────────────────────────────

function sampleBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): [number, number, number] {
  const patch = 4;
  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  for (let py = 0; py < patch; py++) {
    for (let px = 0; px < patch; px++) {
      for (const [x, y] of [
        [px, py],
        [w - 1 - px, py],
        [px, h - 1 - py],
        [w - 1 - px, h - 1 - py],
      ] as [number, number][]) {
        const i = (y * w + x) * 4;
        rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
        n++;
      }
    }
  }
  return [rSum / n, gSum / n, bSum / n];
}

function isBg(
  r: number, g: number, b: number,
  bgR: number, bgG: number, bgB: number,
  tol = 30,
): boolean {
  return (
    Math.abs(r - bgR) <= tol &&
    Math.abs(g - bgG) <= tol &&
    Math.abs(b - bgB) <= tol
  );
}

// ── Web colour extraction ─────────────────────────────────────────────────────

export async function extractColorsFromDataUrl(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }

        ctx.drawImage(img, 0, 0, 48, 48);
        const { data, width: w, height: h } = ctx.getImageData(0, 0, 48, 48);
        const [bgR, bgG, bgB] = sampleBackground(data, w, h);

        const colorCounts = new Map<string, number>();
        let fgTotal = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;                        // transparent
          if (isBg(r, g, b, bgR, bgG, bgB)) continue;  // background pixel
          fgTotal++;
          const name = pixelToColorName(r, g, b);
          colorCounts.set(name, (colorCounts.get(name) ?? 0) + 1);
        }

        if (fgTotal === 0) { resolve([]); return; }

        const threshold = fgTotal * 0.10;
        const result: string[] = [];
        for (const [name, count] of colorCounts) {
          if (count >= threshold) result.push(name);
        }
        resolve(result);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
