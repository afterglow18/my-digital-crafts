import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

// ── ORT Worker fix ────────────────────────────────────────────────────────────
//
// @imgly/background-removal internally forces ort.env.wasm.proxy = false right
// before creating the inference session (it only enables the proxy when WebGPU
// is available, which iOS Safari / WKWebView never reports). Without the proxy
// the ONNX inference runs synchronously on the main thread, freezing the UI.
//
// Fix — three parts:
//  1. Object.defineProperty with a no-op setter so imgly's proxy=false write is
//     silently swallowed and the value stays true → ONNX runs in a sub-worker.
//  2. numThreads = 1 — iOS has no SharedArrayBuffer, so WASM multithreading
//     silently crashes. Single-thread is the only safe option.
//  3. Dynamic import() instead of top-level import — importing onnxruntime-web
//     at parse time triggered Vite's dep pre-bundling mid-session, causing a
//     full-page reload that corrupted React's internal dispatcher. Dynamic import
//     defers the load until the moment inference is first needed.

let ortConfigured = false;

async function configureOrt(): Promise<void> {
  if (ortConfigured) return;
  ortConfigured = true;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — onnxruntime-web types aren't reachable via its package exports (upstream issue)
  const ort = await import("onnxruntime-web");
  Object.defineProperty(ort.env.wasm, "proxy", {
    get: () => true,
    set: () => {},      // blocks imgly from resetting it to false
    configurable: true,
  });
  ort.env.wasm.numThreads = 1; // iOS has no SharedArrayBuffer → must be 1
}

/**
 * Remove the background from a JPEG/PNG base64 data-URL.
 * Returns a PNG data-URL with transparent background.
 * On first ever call downloads ~15 MB ONNX model from imgly CDN (cached after that).
 * Throws on network error or unreadable image — callers should catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();
  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16", // valid: "isnet" | "isnet_fp16" | "isnet_quint8" — NOT "small"/"medium"
    output: { format: "image/png", quality: 0.9 },
    // publicPath omitted → uses static imgly CDN automatically
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
