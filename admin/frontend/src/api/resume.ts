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

// ─── 구조화 영역 (회사 · 프로젝트 · 카테고리 · 기술스택) ─────────────────────

export interface CareerSummary {
  totalMonths: number;
  years: number;
  months: number;
  yearsInField: number;
}

export interface ResumeCompany {
  id: number | null;
  name: string;
  startMonth: string;
  endMonth: string | null;
  ongoing: boolean;
  position: string | null;
  team: string | null;
  note: string | null;
  tenureMonths: number;
  tenureYears: number;
  tenureRemainderMonths: number;
}

export interface ResumeCategory {
  id: number | null;
  code: string;
  label: string;
  description: string | null;
  orderNo: number;
}

export interface ResumeProject {
  id: number | null;
  title: string;
  companyId: number | null;
  companyName: string | null;
  categoryId: number | null;
  categoryCode: string | null;
  categoryLabel: string | null;
  startMonth: string | null;
  endMonth: string | null;
  ongoing: boolean;
  summary: string | null;
  bodyMarkdown: string | null;
  publicBodyMarkdown: string | null;
  metrics: string[];
  skills: ResumeSkillRef[];
  detailSlug: string | null;
  orderNo: number;
  published: boolean;
}

export interface ResumeSkillRef {
  id: number;
  name: string;
}

export interface ResumeSkillGroup {
  id: number | null;
  label: string;
  skills: ResumeSkillRef[];
  note: string | null;
  orderNo: number;
}

export interface ResumeProfile {
  career: CareerSummary;
  companies: ResumeCompany[];
  categories: ResumeCategory[];
  projects: ResumeProject[];
  skills: ResumeSkillGroup[];
}

export async function fetchProfile(): Promise<ResumeProfile> {
  const res = await apiClient.get<ApiResponse<ResumeProfile>>(`${BASE}/profile`);
  return res.data.data;
}

export async function upsertCompany(payload: Partial<ResumeCompany> & { name: string; startMonth: string }) {
  await apiClient.put(`${BASE}/companies`, payload);
}

export async function deleteCompany(id: number) {
  await apiClient.delete(`${BASE}/companies/${id}`);
}

export async function upsertCategory(payload: Partial<ResumeCategory> & { code: string; label: string }) {
  await apiClient.put(`${BASE}/categories`, payload);
}

export async function deleteCategory(id: number) {
  await apiClient.delete(`${BASE}/categories/${id}`);
}

export async function upsertProject(payload: Partial<ResumeProject> & { title: string }) {
  await apiClient.put(`${BASE}/projects`, payload);
}

export async function deleteProject(id: number) {
  await apiClient.delete(`${BASE}/projects/${id}`);
}

export async function upsertSkillGroup(payload: { id?: number; label: string; note?: string | null; orderNo?: number }) {
  await apiClient.put(`${BASE}/skill-groups`, payload);
}

export async function upsertSkill(payload: { id?: number; name: string; groupId?: number | null; orderNo?: number }) {
  await apiClient.put(`${BASE}/skills`, payload);
}

export async function deleteSkill(id: number) {
  await apiClient.delete(`${BASE}/skills/${id}`);
}

export async function deleteSkillGroup(id: number) {
  await apiClient.delete(`${BASE}/skill-groups/${id}`);
}
