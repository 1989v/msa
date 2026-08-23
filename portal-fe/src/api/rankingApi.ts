import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 15_000,
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/** 등락 — 서버가 종류와 칸 수로 나눠 준다. NEW 는 SAME 과 다른 것이다 (ADR-0081). */
export interface Movement {
  type: 'NEW' | 'SAME' | 'UP' | 'DOWN';
  places: number | null;
}

export interface RankingEntry {
  rank: number;
  subjectKey: string;
  subjectName: string;
  score: number;
  movement: Movement;
  payload: Record<string, unknown>;
}

export interface RankingBoardSummary {
  slug: string;
  title: string;
  subtitle: string | null;
  scopeKey: string;
  scopeName: string;
  unit: string;
  sourceLabel: string;
  capturedAt: string | null;
  entryCount: number;
  topName: string | null;
  topScore: number | null;
}

export interface RankingBoardDetail {
  slug: string;
  title: string;
  subtitle: string | null;
  scopeKey: string;
  scopeName: string;
  unit: string;
  sourceLabel: string;
  capturedAt: string | null;
  entries: RankingEntry[];
}

export interface RankingScope {
  code: string;
  name: string;
}

export const fetchRankingBoards = async (scope?: string): Promise<RankingBoardSummary[]> => {
  const res = await api.get<ApiResponse<RankingBoardSummary[]>>('/api/v1/ranking/boards', {
    params: scope ? { domain: 'GAS_STATION', scope } : undefined,
  });
  return res.data.data;
};

export const fetchRankingBoard = async (slug: string): Promise<RankingBoardDetail> => {
  const res = await api.get<ApiResponse<RankingBoardDetail>>(`/api/v1/ranking/boards/${slug}`);
  return res.data.data;
};

export const fetchGasAreas = async (): Promise<RankingScope[]> => {
  const res = await api.get<ApiResponse<RankingScope[]>>('/api/v1/ranking/gas/areas');
  return res.data.data;
};

