import axios, { type AxiosError } from 'axios';
import { getAccessToken } from '../auth/auth';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path (운영 / K8s ingress 경유).
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8089';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * 블로그 전용 클라이언트.
 *
 * shopApi 의 인스턴스를 재사용하지 않는 이유는 그쪽 401 처리가 `/shop/login` 으로 강제
 * 이동하기 때문이다. 블로그는 대부분의 화면이 비로그인으로 동작하므로, 401 은 화면이
 * 스스로 처리한다.
 */
const api = axios.create({ baseURL: BASE_URL, timeout: 10_000 });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function blogErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = (err as AxiosError).response?.data as ApiResponse<unknown> | undefined;
    if (body?.error?.message) return body.error.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ── 타입 ──────────────────────────────────────────────────────────

export type PostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ProfileRole = 'READER' | 'AUTHOR';
export type ProfileStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';
export type CommentStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';

export interface BlogCategoryNode {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  path: string;
  depth: number;
  postCount: number;
  children: BlogCategoryNode[];
}

export interface BlogAuthorSummary {
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface BlogPostSummary {
  id: number;
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  categoryPath: string;
  categoryName: string;
  author: BlogAuthorSummary;
  status: PostStatus;
  publishedAt: string | null;
  readingMinutes: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  ratingAverage: number;
  ratingCount: number;
}

export interface BlogCrumb {
  name: string;
  path: string;
}

export interface BlogPostDetail {
  post: BlogPostSummary;
  body: string;
  breadcrumb: BlogCrumb[];
  liked: boolean;
  myScore: number | null;
}

export interface BlogPage<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface BlogAuthorSpace {
  author: BlogAuthorSummary;
  postCount: number;
  posts: BlogPostSummary[];
}

export interface BlogCommentNode {
  id: number;
  author: BlogAuthorSummary;
  body: string;
  status: CommentStatus;
  mine: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  replies: BlogCommentNode[];
}

export interface BlogReaction {
  liked: boolean;
  likeCount: number;
  ratingAverage: number;
  ratingCount: number;
  myScore: number | null;
}

export interface BlogProfile {
  id: number;
  memberId: number;
  handle: string | null;
  displayName: string;
  bio: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  postCount: number;
  approvedAt: string | null;
  createdAt: string | null;
}

export interface BlogStudioOverview {
  profile: BlogProfile | null;
  canWrite: boolean;
  draftCount: number;
  publishedCount: number;
  totalViews: number;
}

export interface BlogPostInput {
  title: string;
  slug: string | null;
  categoryId: number;
  summary: string | null;
  body: string;
  coverImageUrl: string | null;
}

// ── 공개 조회 ─────────────────────────────────────────────────────

const unwrap = <T,>(res: { data: ApiResponse<T> }): T => res.data.data;

export const fetchCategories = () =>
  api.get<ApiResponse<BlogCategoryNode[]>>('/api/v1/blog/categories').then(unwrap);

export const fetchPosts = (params: {
  categoryPath?: string;
  handle?: string;
  page?: number;
  size?: number;
}) => api.get<ApiResponse<BlogPage<BlogPostSummary>>>('/api/v1/blog/posts', { params }).then(unwrap);

export const fetchPost = (slug: string) =>
  api.get<ApiResponse<BlogPostDetail>>(`/api/v1/blog/posts/${slug}`).then(unwrap);

export const fetchComments = (slug: string) =>
  api.get<ApiResponse<BlogCommentNode[]>>(`/api/v1/blog/posts/${slug}/comments`).then(unwrap);

export const fetchAuthorSpace = (handle: string) =>
  api.get<ApiResponse<BlogAuthorSpace>>(`/api/v1/blog/authors/${handle}`).then(unwrap);

// ── 상호작용 (좋아요·평점은 비로그인도 가능) ────────────────────────

export const toggleLike = (slug: string) =>
  api.post<ApiResponse<BlogReaction>>(`/api/v1/blog/posts/${slug}/like`).then(unwrap);

export const ratePost = (slug: string, score: number) =>
  api.put<ApiResponse<BlogReaction>>(`/api/v1/blog/posts/${slug}/rating`, { score }).then(unwrap);

export const clearRating = (slug: string) =>
  api.delete<ApiResponse<BlogReaction>>(`/api/v1/blog/posts/${slug}/rating`).then(unwrap);

export const createComment = (input: {
  postSlug: string;
  parentId: number | null;
  body: string;
  displayName?: string | null;
}) => api.post<ApiResponse<BlogCommentNode[]>>('/api/v1/blog/comments', input).then(unwrap);

export const editComment = (id: number, body: string) =>
  api.put<ApiResponse<BlogCommentNode[]>>(`/api/v1/blog/comments/${id}`, { body }).then(unwrap);

export const deleteComment = (id: number) =>
  api.delete<ApiResponse<BlogCommentNode[]>>(`/api/v1/blog/comments/${id}`).then(unwrap);

// ── 스튜디오 (로그인 필요) ─────────────────────────────────────────

export const fetchStudioOverview = () =>
  api.get<ApiResponse<BlogStudioOverview>>('/api/v1/blog/me/overview').then(unwrap);

export const updateMyProfile = (input: {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}) => api.put<ApiResponse<BlogProfile>>('/api/v1/blog/me/profile', input).then(unwrap);

export const applyAsAuthor = (input: { handle: string; displayName: string; bio: string | null }) =>
  api.post<ApiResponse<BlogProfile>>('/api/v1/blog/me/author-application', input).then(unwrap);

export const fetchMyPosts = (params: { status?: PostStatus; page?: number; size?: number }) =>
  api.get<ApiResponse<BlogPage<BlogPostSummary>>>('/api/v1/blog/me/posts', { params }).then(unwrap);

export const fetchMyPost = (id: number) =>
  api.get<ApiResponse<BlogPostDetail>>(`/api/v1/blog/me/posts/${id}`).then(unwrap);

export const createPost = (input: BlogPostInput) =>
  api.post<ApiResponse<BlogPostSummary>>('/api/v1/blog/me/posts', input).then(unwrap);

export const updatePost = (id: number, input: BlogPostInput) =>
  api.put<ApiResponse<BlogPostSummary>>(`/api/v1/blog/me/posts/${id}`, input).then(unwrap);

export const publishPost = (id: number) =>
  api.post<ApiResponse<BlogPostSummary>>(`/api/v1/blog/me/posts/${id}/publish`).then(unwrap);

export const archivePost = (id: number) =>
  api.post<ApiResponse<BlogPostSummary>>(`/api/v1/blog/me/posts/${id}/archive`).then(unwrap);

export const deletePost = (id: number) =>
  api.delete<ApiResponse<void>>(`/api/v1/blog/me/posts/${id}`).then(() => undefined);

/** 카테고리 트리를 평탄화 — 셀렉트 박스와 경로 조회에 함께 쓴다 */
export function flattenCategories(nodes: BlogCategoryNode[]): BlogCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}
