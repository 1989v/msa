import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

export type ResumeVisibility = 'PUBLIC' | 'TOKEN_ONLY';
export type ResumeDocumentKind = 'MAIN' | 'DETAIL';

export interface ResumeDocumentSummary {
  slug: string;
  title: string;
  kind: ResumeDocumentKind;
  orderNo: number;
  published: boolean;
  updatedAt: string | null;
}

export interface ResumeDocument extends Omit<ResumeDocumentSummary, 'published' | 'updatedAt'> {
  bodyMarkdown: string;
}

export interface ResumeShareLink {
  id: number;
  token: string;
  label: string;
  note: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  visitCount: number;
  firstVisitedAt: string | null;
  lastVisitedAt: string | null;
}

export interface ResumeVisit {
  label: string | null;
  slug: string;
  visitedAt: string;
}

const BASE = '/api/v1/admin/resume';

export async function fetchVisibility(): Promise<ResumeVisibility> {
  const res = await apiClient.get<ApiResponse<{ visibility: ResumeVisibility }>>(`${BASE}/visibility`);
  return res.data.data.visibility;
}

export async function updateVisibility(visibility: ResumeVisibility): Promise<ResumeVisibility> {
  const res = await apiClient.put<ApiResponse<{ visibility: ResumeVisibility }>>(
    `${BASE}/visibility`,
    { visibility },
  );
  return res.data.data.visibility;
}

export async function listDocuments(): Promise<ResumeDocumentSummary[]> {
  const res = await apiClient.get<ApiResponse<ResumeDocumentSummary[]>>(`${BASE}/documents`);
  return res.data.data;
}

export async function getDocument(slug: string): Promise<ResumeDocument> {
  const res = await apiClient.get<ApiResponse<ResumeDocument>>(`${BASE}/documents/${slug}`);
  return res.data.data;
}

export async function upsertDocument(payload: {
  slug: string;
  title: string;
  bodyMarkdown: string;
  kind: ResumeDocumentKind;
  orderNo: number;
  published: boolean;
}): Promise<ResumeDocumentSummary> {
  const res = await apiClient.put<ApiResponse<ResumeDocumentSummary>>(`${BASE}/documents`, payload);
  return res.data.data;
}

export async function deleteDocument(slug: string): Promise<void> {
  await apiClient.delete(`${BASE}/documents/${slug}`);
}

export async function listShareLinks(): Promise<ResumeShareLink[]> {
  const res = await apiClient.get<ApiResponse<ResumeShareLink[]>>(`${BASE}/share-links`);
  return res.data.data;
}

export async function createShareLink(label: string, note?: string): Promise<ResumeShareLink> {
  const res = await apiClient.post<ApiResponse<ResumeShareLink>>(`${BASE}/share-links`, { label, note });
  return res.data.data;
}

export async function revokeShareLink(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/share-links/${id}`);
}

export async function listVisits(limit = 100): Promise<ResumeVisit[]> {
  const res = await apiClient.get<ApiResponse<ResumeVisit[]>>(`${BASE}/visits`, { params: { limit } });
  return res.data.data;
}

export const RESUME_ORIGIN = 'https://resume.1989v.com';

export function shareUrl(token: string): string {
  return `${RESUME_ORIGIN}/?k=${token}`;
}
