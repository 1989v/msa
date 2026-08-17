import axios from 'axios';
import { getAccessToken } from '../auth/auth';
import { GENRE_LABELS_EN, GENRE_LABELS_KO } from '../seo/copy.mjs';

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
export type GameGenre =
  | 'ARCADE'
  | 'ACTION'
  | 'PUZZLE'
  | 'RPG'
  | 'EDUCATION'
  | 'STRATEGY'
  | 'DEFENSE'
  | 'VERSUS'
  | 'CASUAL';

// 장르 라벨은 SEO 카피와 같은 문자열을 써야 해 seo/copy.mjs 를 단일 원본으로 삼는다
export const GENRE_LABELS = GENRE_LABELS_KO as Record<GameGenre, string>;
export { GENRE_LABELS_EN };

export type GameLang = 'ko' | 'en';

/** 게임 언어 — localStorage('game_lang') → 브라우저 언어. iframe 게임(lib/i18n.js)과 같은 키를 공유한다. */
export function getGameLang(): GameLang {
  const stored = localStorage.getItem('game_lang');
  if (stored === 'ko' || stored === 'en') return stored;
  return /^ko/i.test(navigator.language || '') ? 'ko' : 'en';
}

export function setGameLang(lang: GameLang): void {
  localStorage.setItem('game_lang', lang);
}

export function genreLabel(genre: GameGenre, lang: GameLang): string {
  return (lang === 'en' ? GENRE_LABELS_EN : GENRE_LABELS)[genre] ?? genre;
}

export function displayTitle(game: { title: string; titleEn: string | null }, lang: GameLang): string {
  return lang === 'en' && game.titleEn ? game.titleEn : game.title;
}

export function displayDescription(
  game: { description: string; descriptionEn: string | null },
  lang: GameLang,
): string {
  return lang === 'en' && game.descriptionEn ? game.descriptionEn : game.description;
}

export interface GameSummary {
  id: number;
  slug: string;
  title: string;
  titleEn: string | null;
  thumbnailUrl: string;
  loadType: GameLoadType;
  supportsMobile: boolean;
  status: string;
  genre: GameGenre;
  tags: string[];
  playCount: number;
  ratingAvg: number;
  ratingCount: number;
}

/**
 * 베타 표기 판정 — 두 신호를 모두 받는다.
 * 상태(GameStatus.BETA)가 정식 축이고, `beta` 태그는 PUBLISHED 로 둔 채 배지만 붙이던 기존 방식이다.
 * 한쪽만 보면 같은 카탈로그 안에서 같은 뜻이 다르게 보인다.
 */
export function isBeta(game: Pick<GameSummary, 'status' | 'tags'>): boolean {
  return game.status === 'BETA' || game.tags.includes('beta');
}

export interface GameDetail extends GameSummary {
  description: string;
  descriptionEn: string | null;
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
  genre?: GameGenre;
  sort?: GameSortKey;
  page?: number;
  size?: number;
}): Promise<PageResponse<GameSummary>> {
  const search = new URLSearchParams();
  if (params.tag) search.set('tag', params.tag);
  if (params.genre) search.set('genre', params.genre);
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

/**
 * 평점 — 로그인하면 회원 1표, 아니면 기기 1표.
 * 기기 식별자는 세이브 리스·광고 frequency 와 같은 값을 쓴다(별도 식별자를 늘리지 않는다).
 */
export async function rateGame(slug: string, score: number): Promise<RatingResult> {
  const res = await api.put<ApiResponse<RatingResult>>(
    `/api/v1/games/${slug}/rating`,
    { score },
    { headers: { 'X-Device-Id': getDeviceId() } },
  );
  return res.data.data;
}

export interface HouseCreative {
  title: string | null;
  body: string | null;
  href: string | null;
  emoji: string | null;
}

export interface AdPlacement {
  placementKey: string;
  adType: string;
  provider: string;
  creatives: HouseCreative[];
}

const DEVICE_ID_KEY = 'kgd_device_id';

/** 세이브 리스·광고 frequency 의 subject 로 쓰는 기기 식별자 (localStorage 지속) */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** frequency cap 에 걸리면 null (배너 미노출) */
export async function fetchAdPlacement(placementKey: string): Promise<AdPlacement | null> {
  const res = await api.get<ApiResponse<AdPlacement | null>>(
    `/api/v1/ads/placements/${placementKey}?subject=${encodeURIComponent(getDeviceId())}`,
  );
  return res.data.data;
}
