import React, { useState } from "react";
import {
  useListClothing,
  getListClothingQueryKey,
  useSaveOutfit,
  getListOutfitsQueryKey,
  ClothingItem,
} from "@workspace/api-client-react";
import { Plus, BookmarkPlus, Check, PersonStanding } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AddClothingSheet } from "@/components/clothing/AddClothingSheet";
import { EditClothingSheet } from "@/components/clothing/EditClothingSheet";
import { MannequinView } from "@/components/MannequinView";
import { getImageUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

type RowKey = "tops" | "bottoms" | "shoes";

const ROWS: { key: RowKey; label: string; addLabel: string }[] = [
  { key: "tops",    label: "Tops",    addLabel: "+ Add Top"    },
  { key: "bottoms", label: "Bottoms", addLabel: "+ Add Bottom" },
  { key: "shoes",   label: "Shoes",   addLabel: "+ Add Shoes"  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyRowCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      data-testid={`empty-add-${label.replace(/\s+/g, "-").toLowerCase()}`}
      className="flex-none w-24 h-[7.75rem] border-2 border-dashed border-black/40 rounded-xl
                 flex flex-col items-center justify-center gap-1.5 bg-white/60
                 hover:border-black hover:bg-white transition-all active:scale-95"
    >
      <div className="w-8 h-8 rounded-full border-2 border-black/40 flex items-center justify-center">
        <Plus className="w-4 h-4 text-black/50" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wide text-black/50 text-center px-1 leading-tight">
        {label}
      </span>
    </button>
  );
}

function RowCard({
  item,
  selected,
  onSelect,
  onEdit,
}: {
  item: ClothingItem;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <motion.div className="flex-none w-24 relative group" whileTap={{ scale: 0.93 }}>
      <button
        onClick={onSelect}
        data-testid={`clothing-item-${item.id}`}
        className={`w-full flex flex-col border-2 rounded-xl overflow-hidden transition-all bg-white ${
          selected
            ? "border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-2"
            : "border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        }`}
      >
        <div className="w-full h-24 bg-muted overflow-hidden relative">
          {item.imageObjectPath ? (
            <img
              src={getImageUrl(item.imageObjectPath)!}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center p-2 ${selected ? "bg-primary" : "bg-secondary/30"}`}>
              <span className="font-display font-bold text-center text-[9px] uppercase leading-tight">
                {item.name}
              </span>
            </div>
          )}
          {selected && (
            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
          )}
        </div>
        <div className={`px-1.5 py-1 border-t-2 border-black ${selected ? "bg-primary" : "bg-white"}`}>
          <span className="font-bold text-[10px] uppercase tracking-tight line-clamp-1 block">
            {item.name}
          </span>
        </div>
      </button>

      {/* Edit dot — visible on hover/focus */}
      <button
        onClick={onEdit}
        data-testid={`edit-item-${item.id}`}
        className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-white border-2 border-black rounded-full
                   flex items-center justify-center shadow-sm
                   opacity-0 group-hover:opacity-100 focus:opacity-100 active:opacity-100 z-10 transition-opacity"
        title="Edit"
      >
        <span className="text-[8px] font-black">✎</span>
      </button>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WardrobePage() {
  const [addCategory,     setAddCategory]     = useState<RowKey | null>(null);
  const [editingItemId,   setEditingItemId]   = useState<number | null>(null);
  const [selected,        setSelected]        = useState<Partial<Record<RowKey, ClothingItem>>>({});
  const [isSaveMode,      setIsSaveMode]      = useState(false);
  const [saveName,        setSaveName]        = useState("");
  const [showMannequin,   setShowMannequin]   = useState(false);

  // Fetch each row independently
  const { data: tops    = [] } = useListClothing({ category: "tops"    }, { query: { queryKey: getListClothingQueryKey({ category: "tops"    }) } });
  const { data: bottoms = [] } = useListClothing({ category: "bottoms" }, { query: { queryKey: getListClothingQueryKey({ category: "bottoms" }) } });
  const { data: shoes   = [] } = useListClothing({ category: "shoes"   }, { query: { queryKey: getListClothingQueryKey({ category: "shoes"   }) } });

  const rowData: Record<RowKey, ClothingItem[]> = { tops, bottoms, shoes };

  const saveOutfit  = useSaveOutfit();
  const queryClient = useQueryClient();

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected   = selectedCount === 3;

  // Which categories are still missing
  const missing = ROWS
    .filter(({ key }) => !selected[key])
    .map(({ label }) => label.toLowerCase());

  const toggleItem = (key: RowKey, item: ClothingItem) => {
    setSelected((prev) => {
      if (prev[key]?.id === item.id) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: item };
    });
  };

  const clearSelection = () => {
    setSelected({});
    setIsSaveMode(false);
    setSaveName("");
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    const itemIds = (Object.values(selected) as ClothingItem[]).map((i) => i.id);
    saveOutfit.mutate(
      { data: { name: saveName.trim(), itemIds } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          clearSelection();
        },
      }
    );
  };

  return (
    <div className="min-h-full flex flex-col pt-8 pb-8 bg-background relative">

      {/* Header */}
      <header className="px-4 mb-5">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-0.5">
          My Closet
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          Tap one from each row to build a look.
        </p>
      </header>

      {/* ── Three outfit rows ── */}
      <div className="flex flex-col gap-6">
        {ROWS.map(({ key, label, addLabel }) => {
          const items        = rowData[key];
          const selectedItem = selected[key];

          return (
            <section key={key} data-testid={`row-${key}`}>
              {/* Row label */}
              <div className="flex items-center justify-between px-4 mb-2.5">
                <h2 className="font-display font-bold text-xs uppercase tracking-widest text-black/70">
                  {label}
                </h2>
                {items.length > 0 && (
                  <button
                    onClick={() => setAddCategory(key)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-black/40 hover:text-black transition-colors"
                    data-testid={`add-more-${key}`}
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                )}
              </div>

              {/* Horizontal scroll row */}
              <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
                {items.length === 0 ? (
                  <EmptyRowCard label={addLabel} onClick={() => setAddCategory(key)} />
                ) : (
                  <>
                    {items.map((item) => (
                      <RowCard
                        key={item.id}
                        item={item}
                        selected={selectedItem?.id === item.id}
                        onSelect={() => toggleItem(key, item)}
                        onEdit={() => setEditingItemId(item.id)}
                      />
                    ))}
                    {/* Inline + at end of row */}
                    <button
                      onClick={() => setAddCategory(key)}
                      className="flex-none w-14 h-[7.75rem] border-2 border-dashed border-black/20 rounded-xl
                                 flex items-center justify-center hover:border-black/40 transition-colors"
                      data-testid={`add-inline-${key}`}
                    >
                      <Plus className="w-4 h-4 text-black/25" />
                    </button>
                  </>
                )}
              </div>

              {/* Row divider */}
              {key !== "shoes" && (
                <div className="mx-4 mt-5 border-t border-black/8" />
              )}
            </section>
          );
        })}
      </div>

      {/* ── Action bar ── slides up when ≥ 1 item selected ── */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            key="action-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{   y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 220 }}
            className="fixed bottom-[76px] left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-30"
          >
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-2xl p-3 flex flex-col gap-2.5">

              {/* Mini outfit preview + count */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {ROWS.map(({ key, label }) => {
                    const item = selected[key];
                    return (
                      <div key={key} className="flex flex-col items-center gap-0.5">
                        <div
                          className={`w-11 border-2 rounded overflow-hidden ${
                            item ? "border-black" : "border-dashed border-black/20"
                          }`}
                          style={{ height: "3.25rem" }}
                        >
                          {item ? (
                            item.imageObjectPath ? (
                              <img
                                src={getImageUrl(item.imageObjectPath)!}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-primary flex items-center justify-center p-0.5">
                                <span className="text-[7px] font-bold uppercase text-center leading-tight">
                                  {item.name}
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[8px] text-black/20 font-bold">—</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-bold uppercase text-muted-foreground tracking-wide">
                          {label.slice(0, 3)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex-1 flex flex-col items-end gap-0.5">
                  {allSelected ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-black">
                      Look complete!
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground leading-snug text-right">
                      Still need: {missing.join(" & ")}
                    </span>
                  )}
                  <button
                    onClick={clearSelection}
                    className="text-[10px] font-bold uppercase text-black/35 hover:text-black transition-colors"
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* ── Actions ── */}
              {isSaveMode ? (
                /* Name input */
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Name this look..."
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="flex-1 border-2 border-black rounded-lg px-3 py-2 text-sm font-bold
                               focus:outline-none focus:ring-2 focus:ring-primary placeholder:font-normal"
                    data-testid="input-outfit-name"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim() || saveOutfit.isPending}
                    className="btn-brutalist px-4 py-2 rounded-lg text-sm disabled:opacity-40"
                    data-testid="button-save-outfit-confirm"
                  >
                    {saveOutfit.isPending ? "…" : "Save"}
                  </button>
                </div>
              ) : allSelected ? (
                /* Two action buttons — only shown when all 3 selected */
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setIsSaveMode(true)}
                    className="btn-brutalist py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm"
                    data-testid="button-save-outfit"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    Save Outfit
                  </button>
                  <button
                    onClick={() => setShowMannequin(true)}
                    className="py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm
                               font-bold uppercase tracking-wide border-2 border-black bg-white
                               shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                               hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                               active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                    data-testid="button-view-mannequin"
                  >
                    <PersonStanding className="w-4 h-4" />
                    Mannequin
                  </button>
                </div>
              ) : (
                /* Partial selection — greyed save button */
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm
                             font-bold uppercase tracking-wide border-2 border-black/20 bg-white/50
                             text-black/30 cursor-not-allowed"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Select all 3 to save
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mannequin overlay ── */}
      <AnimatePresence>
        {showMannequin && (
          <MannequinView
            top={selected.tops}
            bottom={selected.bottoms}
            shoes={selected.shoes}
            onClose={() => setShowMannequin(false)}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AddClothingSheet
        open={addCategory !== null}
        onOpenChange={(open) => !open && setAddCategory(null)}
        defaultCategory={addCategory ?? undefined}
      />
      <EditClothingSheet
        itemId={editingItemId}
        open={editingItemId !== null}
        onOpenChange={(open) => !open && setEditingItemId(null)}
      />
    </div>
  );
}
