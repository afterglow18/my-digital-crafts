/**
 * itemSearch — pure, offline full-text search across clothing items and saved groups.
 *
 * Field weights (higher = ranked first):
 *   name / brand          10 / 9
 *   color / category      8 / 7
 *   notes                 6
 *   size/season/occasion/price/date  5
 *   visionText            3
 *   visionLabels          2
 *
 * A group matches if its name, notes, or any contained item matches.
 * Results are deduped and sorted by score descending.
 */

import type { ClothingItem, SavedOutfit } from "@/lib/db";

export interface SearchResults {
  items:  ClothingItem[];
  groups: SavedOutfit[];
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function matchScore(
  text: string | null | undefined,
  tokens: string[],
  weight: number,
): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return tokens.reduce((sum, tok) => sum + (lower.includes(tok) ? weight : 0), 0);
}

function scoreItem(item: ClothingItem, tokens: string[]): number {
  return (
    matchScore(item.name,          tokens, 10) +
    matchScore(item.brand,         tokens,  9) +
    matchScore(item.color,         tokens,  8) +
    matchScore(item.category,      tokens,  7) +
    matchScore(item.notes,         tokens,  6) +
    matchScore(item.size,          tokens,  5) +
    matchScore(item.season,        tokens,  5) +
    matchScore(item.occasion,      tokens,  5) +
    matchScore(item.purchasePrice, tokens,  5) +
    matchScore(item.purchaseDate,  tokens,  5) +
    (item.visionText   ?? []).reduce((s, t) => s + matchScore(t, tokens, 3), 0) +
    (item.visionLabels ?? []).reduce((s, t) => s + matchScore(t, tokens, 2), 0)
  );
}

export function searchItems(
  query: string,
  items: ClothingItem[],
  groups: SavedOutfit[],
): SearchResults {
  const tokens = tokenize(query);
  if (!tokens.length) return { items: [], groups: [] };

  // ── Items ─────────────────────────────────────────────────────────────────
  const scoredItems = items
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const resultItems = scoredItems.map((s) => s.item);

  // ── Groups ────────────────────────────────────────────────────────────────
  const scoredGroups = groups
    .map((g) => {
      const groupScore =
        matchScore(g.name,  tokens, 10) +
        matchScore(g.notes, tokens,  6) +
        g.items.reduce((sum, it) => {
          return (
            sum +
            matchScore(it.name,  tokens, 3) +
            matchScore(it.brand, tokens, 2) +
            (it.visionLabels ?? []).reduce(
              (s, t) => s + matchScore(t, tokens, 1),
              0,
            )
          );
        }, 0);
      return { group: g, score: groupScore };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    items:  resultItems,
    groups: scoredGroups.map((s) => s.group),
  };
}
