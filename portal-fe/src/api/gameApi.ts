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

export type ScoreTrack = 'BASE' | 'MODDED';

export interface ScoreEntry {
  rank: number;
  nickname: string;
  score: number;
  detail: string | null;
}

/**
 * 랭킹 보드 한 개 — 게임 하나의 트랙 하나.
 * 두 트랙(무강화/강화)은 같은 자로 잰 기록이 아니라 한 보드로 합치지 않는다 (V28__score_track.sql).
 */
export interface LeaderboardBoard {
  slug: string;
  title: string;
  titleEn: string | null;
  thumbnailUrl: string;
  track: ScoreTrack;
  entries: ScoreEntry[];
}

const GAME_NICKNAME_KEY = 'game_nickname';

/**
 * 게임 안 랭킹 위젯(`public/games/lib/rank.js`)이 점수를 올릴 때 쓰는 것과 **같은 키**다.
 * 게임은 같은 오리진의 iframe 이라 localStorage 를 공유한다 — 프레임 간 메시지 규약 없이
 * "이 줄이 내 기록"을 짚을 수 있는 유일한 단서.
 */
export function getGameNickname(): string | null {
  return localStorage.getItem(GAME_NICKNAME_KEY);
}

/**
 * 게이트웨이는 업스트림이 죽어 있으면 200 에 빈 바디를 낸다(2026-08-21 실측).
 * 빈 응답을 "기록 없음"으로 읽으면 장애가 정상 화면으로 위장된다 — 실패로 던진다.
 */
function unwrapGame<T>(body: ApiResponse<T> | '' | null | undefined): T {
  if (!body || !body.success || body.data == null) {
    throw new Error('empty or unsuccessful game API response');
  }
  return body.data;
}

/** 게임 한 종의 트랙별 랭킹 — 게임 안 위젯이 쓰는 것과 같은 엔드포인트다 */
export async function fetchLeaderboard(slug: string, track: ScoreTrack, limit = 10): Promise<ScoreEntry[]> {
  const res = await api.get<ApiResponse<ScoreEntry[]>>(
    `/api/v1/games/${slug}/leaderboard?track=${track}&limit=${limit}`,
  );
  return unwrapGame(res.data);
}

/**
 * 기록이 있는 보드만 한 번에 — 허브 랭킹 레일용.
 * 카탈로그 전체에 리더보드를 물으면 게임 수만큼 요청이 나가고, 그중 대부분은 빈 응답이다.
 */
export async function fetchActiveLeaderboards(boards = 8, entries = 3): Promise<LeaderboardBoard[]> {
  const res = await api.get<ApiResponse<LeaderboardBoard[]>>(
    `/api/v1/games/leaderboards?boards=${boards}&entries=${entries}`,
  );
  return unwrapGame(res.data);
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
