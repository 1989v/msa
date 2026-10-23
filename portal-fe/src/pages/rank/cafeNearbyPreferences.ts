import type { CafeLocation } from '../../api/rankingApi';

export const nearbyBrandsKey = 'cafe-nearby-brands-v1';
type Preference = { fingerprint: string; brands: string[] };
let memory: Preference | null = null;
let failedWrite = false;

/** The grid exists only in this stack frame. Only its SHA-256 digest can be stored. */
export async function nearbyFingerprint(location: CafeLocation): Promise<string | null> {
  if (location.kind === 'AREA') return `area:${location.areaCode}`;
  try {
    const grid = `${Math.floor(location.lat * 100)},${Math.floor(location.lng * 100)}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(grid));
    return `current:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  } catch { return null; }
}
export function readNearbyBrands(fingerprint: string): string[] {
  let value: unknown = memory;
  try { const stored = localStorage.getItem(nearbyBrandsKey); if (stored && !failedWrite) value = JSON.parse(stored); } catch { /* Memory survives restricted storage. */ }
  if (!value || typeof value !== 'object') return [];
  const item = value as Partial<Preference>;
  return item.fingerprint === fingerprint && Array.isArray(item.brands) ? item.brands.filter((brand): brand is string => typeof brand === 'string') : [];
}
export function saveNearbyBrands(fingerprint: string, brands: string[]): void {
  memory = { fingerprint, brands };
  try { localStorage.setItem(nearbyBrandsKey, JSON.stringify(memory)); failedWrite = false; } catch { failedWrite = true; }
}
