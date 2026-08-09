import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }
interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }

export type GameStatus = 'DRAFT' | 'REVIEW' | 'BETA' | 'PUBLISHED' | 'SUSPENDED';

export type Genre =
  | 'ARCADE' | 'ACTION' | 'PUZZLE' | 'RPG' | 'EDUCATION'
  | 'STRATEGY' | 'DEFENSE' | 'VERSUS' | 'CASUAL';

export const GENRES: Genre[] = [
  'ARCADE', 'ACTION', 'PUZZLE', 'RPG', 'EDUCATION', 'STRATEGY', 'DEFENSE', 'VERSUS', 'CASUAL',
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
