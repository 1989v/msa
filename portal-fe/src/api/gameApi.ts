import axios from 'axios';
import { getAccessToken } from '../auth/auth';
import { attachRefreshRetry } from '../auth/refresh';
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

// 액세스 토큰이 만료되면 평점·세션·점수 제출이 조용히 게스트 취급된다 — 재발급 후 재시도한다.
attachRefreshRetry(api);

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
  | 'CASUAL'
  | 'DECIDER';

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

export interface ReleaseNote {
  version: string;
  releasedAt: string;
  body: string;
  bodyEn: string | null;
}

/**
 * 버전별 업데이트 노트. 최신 판이 먼저 온다 — 서버가 정렬해 주므로 화면이 다시 하지 않는다.
 * 노트가 없는 게임이 대부분이라 실패는 빈 목록으로 삼킨다: 없는 것과 못 가져온 것을
 * 화면에서 가릴 방법이 없고, 둘 다 「보여줄 것이 없다」로 끝난다.
 */
export async function fetchReleaseNotes(slug: string): Promise<ReleaseNote[]> {
  try {
    const { data } = await api.get<ApiResponse<ReleaseNote[]>>(
      `/api/v1/games/${encodeURIComponent(slug)}/release-notes`,
    );
    return data.data ?? [];
  } catch {
    return [];
  }
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
  /**
   * 실제 세션 길이의 중앙값(분). 표본이 적으면 null 이고 화면은 그 줄을 그리지 않는다.
   * **목록 응답에는 없다** — Summary 에 두면 아무도 안 채워 틀린 값이 나간다.
   */
  estimatedMinutes: number | null;
  /** 'SINGLE' | 'MULTI' — multiplayer 태그에서 나온다. 상세에만 있다 */
  playerMode: string;

  description: string;
  descriptionEn: string | null;
  coverUrl: string | null;
  engineType: string;
  entryUrl: string;
  orientation: string;
  developerName: string;
  sdkIntegrated: boolean;
  /** 게임이 나눈 랭킹 보드. 비어 있으면 보드가 하나뿐이라 탭을 그리지 않는다 (V59) */
  scoreBoards: ScoreBoardDef[];
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

/**
 * 내 기록 — **로그인 상태에서만 부른다.** 게스트에게 빈 패널을 보여 주면
 * "기록이 없다" 와 "로그인이 필요하다" 가 구분되지 않는다.
 */
export interface MyGameRecord {
  plays: number;
  totalSeconds: number;
  lastPlayedAt: string | null;
  bestScore: number | null;
  bestRank: number | null;
  bestBoard: string | null;
  hasSave: boolean;
}

export async function fetchMyGameRecord(slug: string): Promise<MyGameRecord> {
  const res = await api.get<ApiResponse<MyGameRecord>>(`/api/v1/games/${slug}/me`);
  return res.data.data;
}

/**
 * 찜 수 — 게임 서비스가 아니라 화면이 위시리스트를 직접 부른다.
 * 게임 서비스에 런타임 의존을 만들면 위시리스트가 죽을 때 상세가 함께 죽는다.
 * 이 값은 없어도 화면이 성립하므로 실패하면 0 으로 둔다.
 */
export async function fetchFavoriteCount(slug: string): Promise<number> {
  try {
    const res = await api.get<ApiResponse<number>>(
      `/api/v1/wishlist/count?type=GAME&key=${encodeURIComponent(slug)}`,
    );
    return res.data.data ?? 0;
  } catch {
    return 0;
  }
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

/**
 * 게임이 스스로 나눈 랭킹 보드 — 트랙과 축이 다르다.
 * 트랙은 플랫폼이 정한 값(무강화/강화)이라 타입이 고정이지만, 보드는 게임마다 뜻이 달라
 * 키가 열려 있다. 이름을 서버가 들고 있는 이유는 게임 안 선언이 iframe 안이라
 * 바깥에서 읽을 수 없기 때문이다 (V59).
 */
export interface ScoreBoardDef {
  key: string;
  name: string;
  nameEn: string | null;
}

/**
 * 보드의 기간 축. 트랙이 "무엇으로 잰 기록인가"라면 기간은 "언제 세운 기록인가"다.
 * 하루의 경계는 **서버가 KST 로** 정한다 — 기기 시계로 자르면 사람마다 다른 오늘을 본다.
 */
export type ScorePeriod = 'ALL_TIME' | 'DAILY';

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
  /** 게임이 나눈 모드 키. 빈 문자열이면 모드를 나누지 않은 게임이다 */
  board: string;
  /** 그 모드의 표시 이름. 게임이 보낸 키가 아직 카탈로그에 없으면 null 이다 */
  boardName: string | null;
  boardNameEn: string | null;
  entries: ScoreEntry[];
  /** 같은 보드의 오늘 기록. 아무도 안 논 날은 비고, 그때 레일은 역대 기록을 그린다 */
  todayEntries: ScoreEntry[];
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
 * 랭킹 위젯과 같은 키에 쓴다 — 제안에 남긴 이름이 다음 점수 제출에도 그대로 쓰인다.
 * 게임 안 위젯(`rank.js`)의 규격과 같은 2~16 자만 받는다.
 */
export function setGameNickname(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 16) return null;
  localStorage.setItem(GAME_NICKNAME_KEY, trimmed);
  return trimmed;
}

interface MemberProfile {
  id: number;
  name: string;
}

/**
 * 랭킹에 쓰는 이름이 아직 없을 때 채울 값을 회원 서비스에서 받아온다.
 *
 * 게임 쪽에 이름 생성기를 다시 두지 않는다 — member 가 가입 시점에 이미 만들어 둔
 * 표시 이름이 있고(ADR-0078), 그것을 쓰면 사람이 사이트 안에서 같은 이름으로 보인다.
 * 실패하면 null 이고, 그때 화면은 직접 입력을 받는다.
 */
export async function fetchMemberDisplayName(): Promise<string | null> {
  try {
    const res = await api.get<ApiResponse<MemberProfile>>('/api/members/me');
    return res.data.data?.name ?? null;
  } catch {
    return null;
  }
}

/** 랭킹에 쓰는 이름을 확보한다 — 있으면 그대로, 없으면 회원 닉네임으로 채운다 */
export async function resolveGameNickname(): Promise<string | null> {
  const stored = getGameNickname();
  if (stored) return stored;
  const fromMember = await fetchMemberDisplayName();
  return fromMember ? setGameNickname(fromMember) : null;
}

export type SuggestionStatus = 'OPEN' | 'REVIEWING' | 'APPLIED' | 'DECLINED';

export interface SuggestionReply {
  id: number;
  /** 이름이 아니라 이 값이 「운영자」 배지를 정한다 — 닉네임은 누구나 「운영자」로 지을 수 있다 */
  authorType: 'OPERATOR' | 'AUTHOR';
  authorName: string;
  body: string;
  createdAt: string | null;
}

export interface GameSuggestion {
  id: number;
  nickname: string;
  body: string;
  status: SuggestionStatus;
  createdAt: string | null;
  updatedAt: string | null;
  edited: boolean;
  /** 서버가 판정한다 — 회원 id 는 응답에 실리지 않는다 */
  mine: boolean;
  replies: SuggestionReply[];
}

export interface SuggestionPage {
  content: GameSuggestion[];
  totalElements: number;
  number: number;
  last: boolean;
}

export async function fetchSuggestions(slug: string, page = 0, size = 20): Promise<SuggestionPage> {
  const res = await api.get<ApiResponse<SuggestionPage>>(
    `/api/v1/games/${encodeURIComponent(slug)}/suggestions`,
    { params: { page, size } },
  );
  return res.data.data;
}

export async function createSuggestion(
  slug: string,
  nickname: string,
  body: string,
): Promise<GameSuggestion> {
  const res = await api.post<ApiResponse<GameSuggestion>>(
    `/api/v1/games/${encodeURIComponent(slug)}/suggestions`,
    { nickname, body },
  );
  return res.data.data;
}

export async function editSuggestion(slug: string, id: number, body: string): Promise<GameSuggestion> {
  const res = await api.put<ApiResponse<GameSuggestion>>(
    `/api/v1/games/${encodeURIComponent(slug)}/suggestions/${id}`,
    { body },
  );
  return res.data.data;
}

export async function replyToSuggestion(slug: string, id: number, body: string): Promise<SuggestionReply> {
  const res = await api.post<ApiResponse<SuggestionReply>>(
    `/api/v1/games/${encodeURIComponent(slug)}/suggestions/${id}/replies`,
    { body },
  );
  return res.data.data;
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

/**
 * 게임 한 종의 보드 — 게임 안 위젯이 쓰는 것과 같은 엔드포인트다.
 * `period` 를 생략하면 역대 보드이고, 그게 위젯이 이미 부르고 있는 계약이다.
 * 날짜는 보내지 않는다 — 오늘이 언제인지는 서버가 KST 로 정한다.
 */
export async function fetchLeaderboard(
  slug: string,
  track: ScoreTrack,
  limit = 10,
  period: ScorePeriod = 'ALL_TIME',
  board?: string | null,
): Promise<ScoreEntry[]> {
  // board 를 안 보내면 기본 보드다 — 모드를 나누지 않은 게임 60여 종의 기존 계약이 그대로다
  const boardParam = board ? `&board=${encodeURIComponent(board)}` : '';
  const res = await api.get<ApiResponse<ScoreEntry[]>>(
    `/api/v1/games/${slug}/leaderboard?track=${track}&limit=${limit}&period=${period}${boardParam}`,
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
