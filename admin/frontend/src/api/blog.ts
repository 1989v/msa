import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

/** DRAFT 초안 / PUBLISHED 발행 / ARCHIVED 내림. 예약 발행은 없다 (ADR-0072) */
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
  orderNo: number;
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

export interface BlogPostDetail {
  post: BlogPostSummary;
  body: string;
  breadcrumb: { name: string; path: string }[];
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

export interface BlogCommentAdmin {
  id: number;
  postId: number;
  postSlug: string;
  postTitle: string;
  author: BlogAuthorSummary;
  body: string;
  status: CommentStatus;
  createdAt: string | null;
}

export interface BlogViewDaily { date: string; count: number }

export interface BlogCategoryPayload {
  parentId: number | null;
  slug: string;
  name: string;
  description: string | null;
  orderNo: number;
  hidden: boolean;
}

export interface BlogPostPayload {
  title: string;
  slug: string | null;
  categoryId: number;
  summary: string | null;
  body: string;
  coverImageUrl: string | null;
}

const unwrap = <T,>(res: { data: ApiResponse<T> }): T => res.data.data;

// ─── 카테고리 ─────────────────────────────────────────────────────

export const listBlogCategories = () =>
  apiClient.get<ApiResponse<BlogCategoryNode[]>>('/api/v1/admin/blog/categories').then(unwrap);

export const createBlogCategory = (payload: BlogCategoryPayload) =>
  apiClient.post<ApiResponse<BlogCategoryNode>>('/api/v1/admin/blog/categories', payload).then(unwrap);

export const updateBlogCategory = (id: number, payload: BlogCategoryPayload) =>
  apiClient.put<ApiResponse<BlogCategoryNode>>(`/api/v1/admin/blog/categories/${id}`, payload).then(unwrap);

export const deleteBlogCategory = (id: number) =>
  apiClient.delete(`/api/v1/admin/blog/categories/${id}`).then(() => undefined);

// ─── 저자 ────────────────────────────────────────────────────────

export const listBlogProfiles = (params: { role?: ProfileRole; status?: ProfileStatus } = {}) =>
  apiClient.get<ApiResponse<BlogProfile[]>>('/api/v1/admin/blog/profiles', { params }).then(unwrap);

export const changeBlogProfileStatus = (id: number, status: ProfileStatus) =>
  apiClient
    .put<ApiResponse<BlogProfile>>(`/api/v1/admin/blog/profiles/${id}/status`, { status })
    .then(unwrap);

// ─── 글 ──────────────────────────────────────────────────────────

export const listBlogPosts = (params: { status?: PostStatus; page?: number; size?: number } = {}) =>
  apiClient.get<ApiResponse<BlogPage<BlogPostSummary>>>('/api/v1/admin/blog/posts', { params }).then(unwrap);

export const getBlogPost = (id: number) =>
  apiClient.get<ApiResponse<BlogPostDetail>>(`/api/v1/admin/blog/posts/${id}`).then(unwrap);

export const createBlogPost = (payload: BlogPostPayload) =>
  apiClient.post<ApiResponse<BlogPostSummary>>('/api/v1/admin/blog/posts', payload).then(unwrap);

export const updateBlogPost = (id: number, payload: BlogPostPayload) =>
  apiClient.put<ApiResponse<BlogPostSummary>>(`/api/v1/admin/blog/posts/${id}`, payload).then(unwrap);

export const changeBlogPostStatus = (id: number, status: PostStatus) =>
  apiClient
    .put<ApiResponse<BlogPostSummary>>(`/api/v1/admin/blog/posts/${id}/status`, null, { params: { status } })
    .then(unwrap);

export const deleteBlogPost = (id: number) =>
  apiClient.delete(`/api/v1/admin/blog/posts/${id}`).then(() => undefined);

export const listBlogPostViews = (id: number, from: string, to: string) =>
  apiClient
    .get<ApiResponse<BlogViewDaily[]>>(`/api/v1/admin/blog/posts/${id}/views`, { params: { from, to } })
    .then(unwrap);

// ─── 댓글 ────────────────────────────────────────────────────────

export const listBlogComments = (params: { status?: CommentStatus; page?: number; size?: number } = {}) =>
  apiClient.get<ApiResponse<BlogPage<BlogCommentAdmin>>>('/api/v1/admin/blog/comments', { params }).then(unwrap);

export const changeBlogCommentStatus = (id: number, status: CommentStatus) =>
  apiClient.put(`/api/v1/admin/blog/comments/${id}/status`, { status }).then(() => undefined);

/** 트리를 평탄화 — 셀렉트 박스는 계층을 경로 문자열로 보인다 */
export function flattenBlogCategories(nodes: BlogCategoryNode[]): BlogCategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenBlogCategories(node.children)]);
}

/**
 * 상위 분류. 응답에 parentId 가 없어 경로에서 되짚는다 — 트리를 그대로 쓰는 화면에는
 * 필요 없는 값이라 DTO 에 넣지 않았고, 편집 폼만 이 역산이 필요하다.
 */
export function parentOf(node: BlogCategoryNode, all: BlogCategoryNode[]): BlogCategoryNode | null {
  const parentPath = node.path.slice(0, node.path.lastIndexOf('/'));
  if (!parentPath) return null;
  return all.find((c) => c.path === parentPath) ?? null;
}

/** `/tech/server/search` → `기술 > 서버 > 검색` (이름은 평탄화 목록에서 찾는다) */
export function categoryLabel(node: BlogCategoryNode, all: BlogCategoryNode[]): string {
  const segments = node.path.trim().replace(/^\//, '').split('/');
  return segments
    .map((_, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return all.find((c) => c.path === path)?.name ?? segments[index];
    })
    .join(' > ');
}
