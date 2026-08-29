import axios from 'axios';
import { getAccessToken } from '../auth/auth';
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

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

attachRefreshRetry(api);

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
