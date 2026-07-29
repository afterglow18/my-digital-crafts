import React, { createContext, useCallback, useContext, useState } from "react";

export type CategoryKey = "outfits" | "beauty" | "toiletries" | "essentials";

export const DEFAULT_CATEGORY_NAMES: Record<CategoryKey, string> = {
  outfits:    "Art Supplies",
  beauty:     "Craft Supplies",
  toiletries: "Projects",
  essentials: "Storage",
};

const STORAGE_KEY = "craft-category-names";

function loadNames(): Record<CategoryKey, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored
      ? { ...DEFAULT_CATEGORY_NAMES, ...JSON.parse(stored) }
      : { ...DEFAULT_CATEGORY_NAMES };
  } catch {
    return { ...DEFAULT_CATEGORY_NAMES };
  }
}

interface CategoryNamesContextValue {
  names: Record<CategoryKey, string>;
  updateName: (key: CategoryKey, name: string) => void;
}

const CategoryNamesContext = createContext<CategoryNamesContextValue>({
  names: DEFAULT_CATEGORY_NAMES,
  updateName: () => {},
});

export function CategoryNamesProvider({ children }: { children: React.ReactNode }) {
  const [names, setNames] = useState<Record<CategoryKey, string>>(loadNames);

  const updateName = useCallback((key: CategoryKey, name: string) => {
    setNames(prev => {
      const trimmed = name.trim();
      const updated = { ...prev, [key]: trimmed || DEFAULT_CATEGORY_NAMES[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  return (
    <CategoryNamesContext.Provider value={{ names, updateName }}>
      {children}
    </CategoryNamesContext.Provider>
  );
}

export function useCategoryNames() {
  return useContext(CategoryNamesContext);
}
