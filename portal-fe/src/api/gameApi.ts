import axios from 'axios';
import { getAccessToken } from '../auth/auth';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path 사용 (운영 / K8s ingress 경유).
// game API 는 code-dictionary:app 에 폴드되어 있어 동일 오리진(8089)이다 (ADR-0059).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 10_000,
});

// 평점(인증 필수)·세션(로그인 시 식별)에 Bearer 를 실어보낸다.
// shell/apiClient 와 달리 401 시 로그인 페이지로 강제 이동하지 않는다 — 게임 화면은 게스트도 머문다.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export type GameLoadType = 'IFRAME' | 'INTERNAL_ROUTE';
export type GameSortKey = 'trending' | 'new' | 'top';

export interface GameSummary {
  id: number;
  slug: string;
  title: string;
  thumbnailUrl: string;
  loadType: GameLoadType;
  supportsMobile: boolean;
  status: string;
  tags: string[];
  playCount: number;
  ratingAvg: number;
  ratingCount: number;
}

export interface GameDetail extends GameSummary {
  description: string;
  coverUrl: string | null;
  engineType: string;
  entryUrl: string;
  orientation: string;
  developerName: string;
  sdkIntegrated: boolean;
  releasedAt: string | null;
  contentUpdatedAt: string | null;
}

export interface GameTag {
  slug: string;
  name: string;
}

export interface GameCollection {
  slug: string;
  title: string;
  type: 'MANUAL' | 'TRENDING' | 'NEW' | 'TAG_BASED';
  games: GameSummary[];
}

export interface SessionStarted {
  sessionKey: string;
  gameSlug: string;
  startedAt: string;
}

export interface RatingResult {
  score: number;
  ratingAvg: number;
  ratingCount: number;
}

export async function listGames(params: {
  tag?: string;
  sort?: GameSortKey;
  page?: number;
  size?: number;
}): Promise<PageResponse<GameSummary>> {
  const search = new URLSearchParams();
  if (params.tag) search.set('tag', params.tag);
  if (params.sort) search.set('sort', params.sort);
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? 24));
  const res = await api.get<ApiResponse<PageResponse<GameSummary>>>(`/api/v1/games?${search}`);
  return res.data.data;
}

export async function fetchGameCollections(): Promise<GameCollection[]> {
  const res = await api.get<ApiResponse<GameCollection[]>>('/api/v1/games/collections');
  return res.data.data;
}

export async function fetchGameTags(): Promise<GameTag[]> {
  const res = await api.get<ApiResponse<GameTag[]>>('/api/v1/games/tags');
  return res.data.data;
}

export async function fetchGameDetail(slug: string): Promise<GameDetail> {
  const res = await api.get<ApiResponse<GameDetail>>(`/api/v1/games/${slug}`);
  return res.data.data;
}

export async function fetchSimilarGames(slug: string): Promise<GameSummary[]> {
  const res = await api.get<ApiResponse<GameSummary[]>>(`/api/v1/games/${slug}/similar`);
  return res.data.data;
}

export async function startGameSession(slug: string): Promise<SessionStarted> {
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'MOBILE' : 'DESKTOP';
  const res = await api.post<ApiResponse<SessionStarted>>(`/api/v1/games/${slug}/sessions`, { deviceType });
  return res.data.data;
}

export async function endGameSession(slug: string, sessionKey: string): Promise<void> {
  await api.patch(`/api/v1/games/${slug}/sessions/${sessionKey}`);
}

export async function rateGame(slug: string, score: number): Promise<RatingResult> {
  const res = await api.put<ApiResponse<RatingResult>>(`/api/v1/games/${slug}/rating`, { score });
  return res.data.data;
}
