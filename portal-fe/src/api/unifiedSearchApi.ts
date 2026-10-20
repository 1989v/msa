import axios from 'axios';
import type { UnifiedType, UnifiedResult as GroupedResult } from './searchApi';
import { unifiedHitHref } from '../shell/serviceHref';

export type SearchType = UnifiedType;
export interface UnifiedHit {
  id: string; type: SearchType; title: string; summary: string; sourceId: string;
  lang?: string | null; group?: string | null; brand?: string | null;
}
export interface UnifiedResult { hits: UnifiedHit[]; total: number; page: number; size: number; mode: 'bm25' | 'hybrid' | 'grouped'; totalPages?: number }
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089', timeout: 8000 });
export async function searchUnified(q: string, type: string, page: number, all: boolean, signal: AbortSignal): Promise<UnifiedResult> {
  if (all) {
    const response = await api.get<{ success: boolean; data: GroupedResult }>('/api/search/unified', {
      params: { q, type: type || undefined, size: 20, page }, signal,
    });
    if (!response.data.success) throw new Error('Search unavailable');
    const groups = response.data.data.groups;
    return { hits: groups.flatMap(group => group.hits.map(hit => ({ id: `${hit.type}:${hit.id}`, type: hit.type, title: hit.title, summary: hit.summary ?? '', sourceId: hit.slug, group: hit.facets.group, brand: hit.facets.brand }))),
      total: groups.reduce((sum, group) => sum + group.total, 0), page, size: 20, mode: 'grouped', totalPages: Math.max(0, ...groups.map(group => Math.ceil(group.total / 20))) };
  }
  const response = await api.get<{ success: boolean; data: UnifiedResult }>('/api/search/unified/suggest', {
    params: { q, type: type || undefined, size: 8 }, signal,
  });
  if (!response.data.success) throw new Error('Search unavailable');
  return response.data.data;
}

/** Destination vocabulary is owned here; no server-provided URL can become navigation. */
export function unifiedHref(hit: UnifiedHit, hostname = window.location.hostname): string {
  return unifiedHitHref(hit.type, hit.sourceId, { title: hit.title, group: hit.group ?? undefined, lang: hit.lang ?? undefined }, hostname);
}
