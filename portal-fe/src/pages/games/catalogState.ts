import type { GameSummary } from '../../api/gameApi';
export type ListResult = { key: string; content: GameSummary[]; error: boolean; number: number; totalPages: number; totalElements: number };
// Bounded to 20 successful filter/language/genre combinations by GamesPage.
export const catalogCache = new Map<string, { result: ListResult; scroll: number }>();
