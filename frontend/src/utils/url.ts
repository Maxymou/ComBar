const API_BASE = import.meta.env.VITE_API_URL || '';

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function resolveBackendAssetUrl(rawUrl?: string | null): string | null {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  if (isAbsoluteUrl(value)) return value;

  if (value.startsWith('/')) {
    if (!API_BASE) return value;
    return `${API_BASE}${value}`;
  }

  if (!API_BASE) return `/${value}`;
  return `${API_BASE}/${value}`;
}
