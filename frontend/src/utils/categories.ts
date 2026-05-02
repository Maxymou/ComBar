export const CATEGORY_CONFIG: Record<string, { label: string; order: number; key: string }> = {
  drink: { label: '🍺 Boissons', order: 0, key: 'drink' },
  boissons: { label: '🍺 Boissons', order: 0, key: 'drink' },
  consigne: { label: '🫙 Consignes', order: 1, key: 'consigne' },
  soft: { label: '🥤 Soft', order: 2, key: 'soft' },
  sandwich: { label: '🥙 Sandwiches', order: 3, key: 'sandwich' },
  sandwiches: { label: '🥙 Sandwiches', order: 3, key: 'sandwich' },
  food: { label: '🥙 Sandwiches', order: 3, key: 'sandwich' },
};

export const OTHER_CATEGORY = {
  key: 'other',
  label: '📦 Autres',
  order: 4,
};

export function normalizeCategory(category: string): string {
  const normalized = category?.toLowerCase() || '';
  return CATEGORY_CONFIG[normalized]?.key ?? OTHER_CATEGORY.key;
}

export function getCategoryMeta(category: string): { label: string; order: number } {
  const normalized = category?.toLowerCase() || '';
  const config = CATEGORY_CONFIG[normalized];
  if (!config) return { label: OTHER_CATEGORY.label, order: OTHER_CATEGORY.order };
  return { label: config.label, order: config.order };
}
