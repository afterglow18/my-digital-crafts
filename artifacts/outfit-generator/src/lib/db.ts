/**
 * Local IndexedDB database for My Digital Crafts.
 *
 * Works in both the browser (Replit preview) and in the Capacitor iOS WebView —
 * IndexedDB is natively available in both environments and persists to the
 * app's sandboxed storage on-device.
 *
 * Schema v1:
 *   clothing_items  — wardrobe items with embedded image data URLs
 *   saved_outfits   — named outfit collections
 *   outfit_items    — junction: outfit ↔ clothing item
 *   settings        — key/value store for app preferences
 *
 * Schema v2 (non-breaking):
 *   clothing_items gains visionLabels / visionText / visionVersion fields.
 *   IDB object stores are schema-less; normalizeItem() fills defaults for old records.
 */

import { openDB, type IDBPDatabase } from "idb";

export const DB_NAME    = "my-digital-suitcase";
export const DB_VERSION = 2;

// ── Stored types (IndexedDB records) ─────────────────────────────────────────

export interface StoredClothingItem {
  id?:            number;        // auto-incremented
  name:           string;
  category:       string;        // "outfits" | "beauty" | "toiletries" | "essentials"
  imageObjectPath: string | null; // JPEG data URL  (e.g. "data:image/jpeg;base64,...")
  isFavorite:     boolean;
  timesWorn:        number;
  lastWorkedDate?:  string | null;   // "YYYY-MM-DD" local date, null = never logged
  color?:           string | null;
  brand?:           string | null;
  size?:            string | null;
  season?:          string | null;
  occasion?:        string | null;
  purchasePrice?:   string | null;
  purchaseDate?:    string | null;
  notes?:           string | null;
  // ── v2: vision / photo-search fields ──────────────────────────────────────
  visionLabels?:    string[];        // colour names (web) or VNClassify labels (iOS)
  visionText?:      string[];        // text detected in photo (iOS Vision)
  visionVersion?:   number;          // 0=unanalysed,1=iOS,4=web-ok,5=web-no-labels
  createdAt:        string;
  updatedAt:        string;
}

export interface StoredOutfit {
  id?:       number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
}

export interface StoredOutfitItem {
  id?:             number;
  outfitId:        number;
  clothingItemId:  number;
}

export interface StoredSetting {
  key:   string;
  value: string;
}

// ── Public types (consumed by hooks and pages) ────────────────────────────────

/** All optional fields are normalised to non-undefined values by normalizeItem(). */
export interface ClothingItem extends Required<StoredClothingItem> {
  id: number;
  // Override vision fields to be always-defined arrays / number:
  visionLabels:  string[];
  visionText:    string[];
  visionVersion: number;
}

export interface SavedOutfit {
  id:        number;
  name:      string;
  notes?:    string | null;
  createdAt: string;
  items:     ClothingItem[];
}

// ── Singleton DB connection ───────────────────────────────────────────────────

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ── v1: initial schema ─────────────────────────────────────────────────
      if (oldVersion < 1) {
        const itemStore = db.createObjectStore("clothing_items", {
          keyPath:       "id",
          autoIncrement: true,
        });
        itemStore.createIndex("by_category", "category");
        itemStore.createIndex("by_favorite", "isFavorite");

        db.createObjectStore("saved_outfits", {
          keyPath:       "id",
          autoIncrement: true,
        });

        const oiStore = db.createObjectStore("outfit_items", {
          keyPath:       "id",
          autoIncrement: true,
        });
        oiStore.createIndex("by_outfit", "outfitId");
        oiStore.createIndex("by_item",   "clothingItemId");

        db.createObjectStore("settings", { keyPath: "key" });
      }

      // ── v2: vision fields added to clothing_items ─────────────────────────
      // IDB object stores are schema-less — no structural changes needed here.
      // Existing records gain defaults via normalizeItem() in localDB.ts.
    },

    blocked() {
      console.warn("[DB] Upgrade blocked — close other tabs");
    },

    blocking() {
      _db?.close();
      _db = null;
    },
  });

  return _db;
}
