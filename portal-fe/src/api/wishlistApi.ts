import axios from 'axios';
import { attachRefreshRetry } from '../auth/refresh';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path (운영 / K8s ingress 경유).
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8089';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * 찜하기 클라이언트 (ADR-0074). shell/apiClient 를 쓰지 않는 이유는 그쪽 401 처리가
 * apex `/login` 으로 강제 이동하기 때문이다 — 하트는 게임·블로그·place 화면 어디에나
 * 있고, 토큰 만료가 화면 이탈이 되면 안 된다. 401 은 토큰을 재발급해 그 자리에서
 * 재시도하고, 재발급까지 실패하면 그 호출만 실패로 남긴다.
 */
const api = axios.create({ baseURL: BASE_URL, timeout: 10_000 });


attachRefreshRetry(api);

/** 테스트가 어댑터를 바꿔 끼운다 — 404 를 가르는 판단까지 실제 모듈로 돌리려고 */
export { api as wishlistHttp };

export type FavoriteTargetType = 'PRODUCT' | 'GAME' | 'ATTRACTION' | 'BLOG_POST';

export interface FavoriteItem {
  id: number;
  targetType: FavoriteTargetType;
  targetKey: string;
  /** 소속 묶음 — null 이면 미분류 (ADR-0080) */
  collectionId: number | null;
  createdAt: string;
}

export interface FavoriteCollection {
  id: number;
  name: string;
  itemCount: number;
  createdAt: string;
}

export interface FavoritePage {
  items: FavoriteItem[];
  totalCount: number;
}

export async function addFavorite(type: FavoriteTargetType, targetKey: string): Promise<FavoriteItem> {
  const res = await api.put<ApiResponse<FavoriteItem>>(
    `/api/v1/wishlist/${type}/${encodeURIComponent(targetKey)}`,
  );
  return res.data.data;
}

export async function removeFavorite(type: FavoriteTargetType, targetKey: string): Promise<void> {
  await api.delete(`/api/v1/wishlist/${type}/${encodeURIComponent(targetKey)}`);
}

export async function fetchFavorites(params: {
  type?: FavoriteTargetType;
  /** 지정하면 그 묶음만. 생략은 **전체**이지 미분류가 아니다 */
  collectionId?: number;
  /** 미분류만 — collectionId 와 겸하지 않는다 */
  unclassified?: boolean;
  page?: number;
  size?: number;
}): Promise<FavoritePage> {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.collectionId != null) search.set('collectionId', String(params.collectionId));
  if (params.unclassified) search.set('unclassified', 'true');
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? 50));
  const res = await api.get<ApiResponse<FavoritePage>>(`/api/v1/wishlist?${search}`);
  return res.data.data;
}

/** 목록 화면의 "찜됨" 하이드레이션 — 타입 하나의 내 찜 키만 싸게 받는다 */
export async function fetchFavoriteKeys(type: FavoriteTargetType): Promise<string[]> {
  const res = await api.get<ApiResponse<{ keys: string[] }>>(`/api/v1/wishlist/keys?type=${type}`);
  return res.data.data.keys;
}

// ── 여행 묶음 (ADR-0080) ─────────────────────────────────────────────────────

export async function fetchCollections(): Promise<FavoriteCollection[]> {
  const res = await api.get<ApiResponse<FavoriteCollection[]>>('/api/v1/wishlist/collections');
  return res.data.data;
}

export async function createCollection(name: string): Promise<FavoriteCollection> {
  const res = await api.post<ApiResponse<FavoriteCollection>>('/api/v1/wishlist/collections', { name });
  return res.data.data;
}

export async function renameCollection(id: number, name: string): Promise<FavoriteCollection> {
  const res = await api.patch<ApiResponse<FavoriteCollection>>(`/api/v1/wishlist/collections/${id}`, { name });
  return res.data.data;
}

/** 묶음만 지운다 — 소속 찜은 미분류로 남는다 */
export async function deleteCollection(id: number): Promise<void> {
  await api.delete(`/api/v1/wishlist/collections/${id}`);
}

/** 찜을 묶음으로 옮긴다. `null` 이면 미분류로 뺀다 (찜 자체는 남는다) */
export async function moveFavorite(
  type: FavoriteTargetType,
  targetKey: string,
  collectionId: number | null,
): Promise<void> {
  await api.patch(`/api/v1/wishlist/${type}/${encodeURIComponent(targetKey)}/collection`, { collectionId });
}

// ── 묶음 공유 링크 (ADR-0107) ────────────────────────────────────────────────

export interface CollectionShareLink {
  token: string;
  /** 짧은 주소(`/c/{token}`) — 서버가 호스트까지 붙여 준다 */
  url: string;
  /** null 이면 만료 없음 */
  expiresAt: string | null;
}

/**
 * 묶음의 공유 상태. 404 는 「공유를 쓸 수 없음」(설정 꺼짐·없는 묶음)이라 오류가 아니라 값으로 돌려준다 —
 * 화면은 그때 공유 버튼을 숨긴다. 그 밖의 오류(5xx·네트워크)는 던진다.
 */
export type CollectionShareState = { available: false } | { available: true; link: CollectionShareLink | null };

function isNotFound(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

export async function fetchCollectionShare(id: number): Promise<CollectionShareState> {
  try {
    const res = await api.get<ApiResponse<{ link: CollectionShareLink | null }>>(
      `/api/v1/wishlist/collections/${id}/share`,
    );
    return { available: true, link: res.data.data.link };
  } catch (err) {
    if (isNotFound(err)) return { available: false };
    throw err;
  }
}

/**
 * 새 링크를 만든다 — 살아 있던 링크는 서버가 폐기한다(묶음당 하나).
 * `expiresInDays` 를 생략하면 본문 없이 보내 서버 기본(30일)을, `null` 이면 만료 없음을 고른다.
 */
export async function createCollectionShare(id: number, expiresInDays?: number | null): Promise<CollectionShareLink> {
  const res = await api.post<ApiResponse<CollectionShareLink>>(
    `/api/v1/wishlist/collections/${id}/share`,
    expiresInDays === undefined ? undefined : { expiresInDays },
  );
  return res.data.data;
}

/** 멱등 — 링크가 없어도 200 */
export async function revokeCollectionShare(id: number): Promise<void> {
  await api.delete(`/api/v1/wishlist/collections/${id}/share`);
}

export interface SharedCollection {
  name: string;
  items: { targetType: 'ATTRACTION'; targetKey: string }[];
  /** 100건을 넘어 잘렸는지 */
  truncated: boolean;
}

/** 로그인 없이 읽는 공개 묶음. 없음·폐기·만료·꺼짐은 모두 404 라 null 로 돌려준다 */
export async function fetchSharedCollection(token: string): Promise<SharedCollection | null> {
  try {
    const res = await api.get<ApiResponse<SharedCollection>>(`/api/v1/wishlist/shared/${encodeURIComponent(token)}`);
    return res.data.data;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}
