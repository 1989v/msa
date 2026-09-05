import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }
interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }

export type GameStatus = 'DRAFT' | 'REVIEW' | 'BETA' | 'PUBLISHED' | 'SUSPENDED';

export type Genre =
  | 'ARCADE' | 'ACTION' | 'PUZZLE' | 'RPG'
  | 'STRATEGY' | 'DEFENSE' | 'VERSUS' | 'CASUAL' | 'DECIDER';

export const GENRES: Genre[] = [
  'ARCADE', 'ACTION', 'PUZZLE', 'RPG', 'STRATEGY', 'DEFENSE', 'VERSUS', 'CASUAL',
  // 순서 정하기 — 등록하면 게임 허브의 「랜덤으로 돌리기」 대상에 자동으로 들어간다.
  // 대신 파티 인계(lib/party.js)와 출발 편향 |rho| < 0.1 을 지켜야 한다 (game/CLAUDE.md)
  'DECIDER',
];

export const GAME_STATUSES: GameStatus[] = ['DRAFT', 'REVIEW', 'BETA', 'PUBLISHED', 'SUSPENDED'];

/** 도메인 Game 상태머신(DRAFT → REVIEW → BETA → PUBLISHED ⇄ SUSPENDED) 그대로 */
export type GameStatusAction = 'SUBMIT_REVIEW' | 'LAUNCH_BETA' | 'PUBLISH' | 'SUSPEND' | 'RESUME';

export type GameSort = 'updated' | 'created' | 'title' | 'playCount';

export interface AdminGameSummary {
  id: number;
  slug: string;
  title: string;
  titleEn: string | null;
  thumbnailUrl: string;
  status: GameStatus;
  genre: Genre;
  tags: string[];
  playCount: number;
  ratingAvg: number;
  ratingCount: number;
  updatedAt: string;
}

export interface AdminGameDetail {
  id: number;
  slug: string;
  title: string;
  description: string;
  titleEn: string | null;
  descriptionEn: string | null;
  thumbnailUrl: string;
  coverUrl: string | null;
  engineType: string;
  loadType: string;
  entryUrl: string;
  orientation: string;
  supportsMobile: boolean;
  developerName: string;
  sdkIntegrated: boolean;
  status: GameStatus;
  genre: Genre;
  tags: string[];
  releasedAt: string | null;
  contentUpdatedAt: string | null;
  playCount: number;
  ratingAvg: number;
  ratingCount: number;
}

export interface GameTag {
  slug: string;
  name: string;
}

export interface GameListParams {
  page?: number;
  size?: number;
  q?: string;
  status?: GameStatus | '';
  genre?: Genre | '';
  tag?: string;
  sort?: GameSort;
}

export interface GameMetadataInput {
  title: string;
  description: string;
  /** 공백을 보내면 서버에서 null 로 비워진다 (SEO 메타) */
  titleEn: string;
  descriptionEn: string;
  thumbnailUrl: string;
  genre: Genre;
}

const ADMIN_BASE = '/api/v1/admin/games';

export async function fetchAdminGames(params: GameListParams = {}): Promise<PageResponse<AdminGameSummary>> {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
    sort: params.sort ?? 'updated',
  });
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.genre) query.set('genre', params.genre);
  if (params.tag) query.set('tag', params.tag);
  const res = await apiClient.get<ApiResponse<PageResponse<AdminGameSummary>>>(`${ADMIN_BASE}?${query}`);
  return res.data.data;
}

export async function fetchAdminGame(slug: string): Promise<AdminGameDetail> {
  const res = await apiClient.get<ApiResponse<AdminGameDetail>>(`${ADMIN_BASE}/${slug}`);
  return res.data.data;
}

export async function updateGameMetadata(slug: string, input: GameMetadataInput): Promise<AdminGameDetail> {
  const res = await apiClient.put<ApiResponse<AdminGameDetail>>(`${ADMIN_BASE}/${slug}`, input);
  return res.data.data;
}

export async function updateGameTags(slug: string, tags: string[]): Promise<AdminGameDetail> {
  const res = await apiClient.put<ApiResponse<AdminGameDetail>>(`${ADMIN_BASE}/${slug}/tags`, { tags });
  return res.data.data;
}

export async function changeGameStatus(slug: string, action: GameStatusAction): Promise<AdminGameDetail> {
  const res = await apiClient.post<ApiResponse<AdminGameDetail>>(`${ADMIN_BASE}/${slug}/status`, { action });
  return res.data.data;
}

/** 태그 목록은 공개 카탈로그 엔드포인트를 그대로 재사용한다 (어드민 전용 사본 불필요) */
export async function fetchGameTags(): Promise<GameTag[]> {
  const res = await apiClient.get<ApiResponse<GameTag[]>>('/api/v1/games/tags');
  return res.data.data ?? [];
}

// ─── 컬렉션 (게임 목록 노출 구성) ────────────────────────────────────────────
// MANUAL 만 게임을 직접 고른다. TRENDING/NEW 는 통계·날짜로 서버가 채우고,
// TAG_BASED 는 tagSlug 로 채우므로 어드민은 제목·순서·활성만 만진다.
export type CollectionType = 'MANUAL' | 'TRENDING' | 'NEW' | 'TAG_BASED';

export interface AdminCollection {
  slug: string;
  title: string;
  type: CollectionType;
  tagSlug: string | null;
  displayOrder: number;
  active: boolean;
  gameIds: number[];
}

export interface CollectionUpdateInput {
  title?: string;
  displayOrder?: number;
  active?: boolean;
  gameIds?: number[];
}

export async function fetchCollections(): Promise<AdminCollection[]> {
  const res = await apiClient.get<ApiResponse<AdminCollection[]>>(`${ADMIN_BASE}/collections`);
  return res.data.data ?? [];
}

export async function updateCollection(
  slug: string,
  input: CollectionUpdateInput,
): Promise<AdminCollection> {
  const res = await apiClient.put<ApiResponse<AdminCollection>>(`${ADMIN_BASE}/collections/${slug}`, input);
  return res.data.data;
}

/* ── 개선 제안 (ADR-0087) ────────────────────────────────────────────── */

export type SuggestionStatus = 'OPEN' | 'REVIEWING' | 'APPLIED' | 'DECLINED';

export const SUGGESTION_STATUSES: SuggestionStatus[] = ['OPEN', 'REVIEWING', 'APPLIED', 'DECLINED'];

export interface SuggestionReply {
  id: number;
  /** 서버가 정한다 — 어드민이 이 경로로 답글을 달면 항상 OPERATOR 다 */
  authorType: 'OPERATOR' | 'AUTHOR';
  authorName: string;
  body: string;
  createdAt: string | null;
}

export interface AdminGameSuggestion {
  id: number;
  gameId: number;
  gameSlug: string;
  gameTitle: string;
  nickname: string;
  body: string;
  status: SuggestionStatus;
  createdAt: string | null;
  updatedAt: string | null;
  replies: SuggestionReply[];
}

export async function listGameSuggestions(params: {
  status?: SuggestionStatus;
  gameId?: number;
  page?: number;
  size?: number;
}): Promise<PageResponse<AdminGameSuggestion>> {
  const res = await apiClient.get<ApiResponse<PageResponse<AdminGameSuggestion>>>(
    `${ADMIN_BASE}/suggestions`,
    { params },
  );
  return res.data.data;
}

export async function changeSuggestionStatus(
  id: number,
  status: SuggestionStatus,
): Promise<AdminGameSuggestion> {
  const res = await apiClient.patch<ApiResponse<AdminGameSuggestion>>(
    `${ADMIN_BASE}/suggestions/${id}/status`,
    { status },
  );
  return res.data.data;
}

/**
 * 답글은 어드민 전용 경로가 아니라 **공개 쓰기 경로**로 보낸다 — 답글을 다는 길이 둘이면
 * 「누가 운영자인가」 판정도 둘이 된다. 어드민 토큰의 ROLE_ADMIN 이 운영자 배지를 만든다.
 */
export async function replyToSuggestion(
  slug: string,
  id: number,
  body: string,
): Promise<SuggestionReply> {
  const res = await apiClient.post<ApiResponse<SuggestionReply>>(
    `/api/v1/games/${encodeURIComponent(slug)}/suggestions/${id}/replies`,
    { body },
  );
  return res.data.data;
}

// ── 비밀 게임 허용 명단 ───────────────────────────────────────────────────────

export interface PrivateGameMember {
  memberId: number;
  note: string | null;
  createdAt: string;
}

/**
 * 비밀 게임은 **카탈로그에 없다.** 그래서 게임 목록에서 고를 수 없고 슬러그를 직접 적는다 —
 * 목록에 넣으려면 카탈로그에 행을 만들어야 하는데, 그러면 「목록에 안 나오는 게임」이라는
 * 전제가 깨진다.
 */
export async function listPrivateGameMembers(slug: string): Promise<PrivateGameMember[]> {
  const res = await apiClient.get<ApiResponse<PrivateGameMember[]>>(
    `${ADMIN_BASE}/private/${encodeURIComponent(slug)}/members`,
  );
  return res.data.data;
}

export async function grantPrivateGameAccess(
  slug: string,
  memberId: number,
  note?: string,
): Promise<PrivateGameMember> {
  const res = await apiClient.post<ApiResponse<PrivateGameMember>>(
    `${ADMIN_BASE}/private/${encodeURIComponent(slug)}/members`,
    { memberId, note },
  );
  return res.data.data;
}

export async function revokePrivateGameAccess(slug: string, memberId: number): Promise<void> {
  await apiClient.delete(`${ADMIN_BASE}/private/${encodeURIComponent(slug)}/members/${memberId}`);
}
