import { defaultNames, type PartyMode } from './party';
export const DRAW_DRAFT_KEY = 'kgd.draw.draft.v1';
export const DRAW_SLUGS = ['marble-race', 'ladder-draw', 'card-flip'] as const;
export type DrawChoice = typeof DRAW_SLUGS[number] | 'random';
export interface DrawDraft { text: string; mode: PartyMode; choice: DrawChoice }
export function readDrawDraft(): DrawDraft {
  const fallback: DrawDraft = { text: defaultNames(4).join('\n'), mode: 'last', choice: 'marble-race' };
  try {
    const saved = JSON.parse(localStorage.getItem(DRAW_DRAFT_KEY) ?? 'null');
    if (!saved || typeof saved.text !== 'string' || saved.text.length > 2000) return fallback;
    return { text: saved.text, mode: saved.mode === 'order' ? 'order' : 'last',
      choice: [...DRAW_SLUGS, 'random'].includes(saved.choice) ? saved.choice : 'marble-race' };
  } catch { return fallback; }
}
export function saveDrawDraft(draft: DrawDraft): boolean {
  try { localStorage.setItem(DRAW_DRAFT_KEY, JSON.stringify(draft)); return true; }
  catch { return false; }
}
