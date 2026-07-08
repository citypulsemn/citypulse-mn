import type { CategoryKey, CategoryMeta } from "./types";

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  music: { key: "music", label: "Music", color: "#E0B341" },
  sports: { key: "sports", label: "Sports", color: "#6FA8DC" },
  family: { key: "family", label: "Family", color: "#5BA88A" },
  arts: { key: "arts", label: "Arts & Theater", color: "#C9826B" },
  food: { key: "food", label: "Food & Drink", color: "#D98C5F" },
  // Display label is "Unique"; the internal key stays "weird" so existing
  // database rows, the CHECK constraint, and the pipeline need no migration.
  weird: { key: "weird", label: "Unique", color: "#B07AA1" },
  festival: { key: "festival", label: "Festival", color: "#E07A5F" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function categoryColor(key: CategoryKey): string {
  return CATEGORIES[key]?.color ?? "#C9A961";
}
