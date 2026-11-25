import axios from 'axios';
import { attachRefreshRetry } from '../auth/refresh';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089', timeout: 15_000 });
attachRefreshRetry(api);
interface Envelope<T> { data: T }
const read = <T,>(response: { data: Envelope<T> }) => response.data.data;
export const promptDomains = {
  SOFTWARE: '소프트웨어', DATA: '데이터', DESIGN: '디자인', MARKETING: '마케팅',
  BUSINESS: '비즈니스', EDUCATION: '교육', OTHER: '기타',
} as const;
export type PromptDomain = keyof typeof promptDomains;
export const promptTags = { ANALYSIS: '분석', WRITING: '작성', REVIEW: '검토', PLANNING: '기획', SUMMARY: '요약' } as const;
export type PromptTag = keyof typeof promptTags;
export interface PromptContent { domain: PromptDomain; title: string; purpose: string; modelContext: string; promptText: string; tags?: string[] }
export interface ReviewContent { reviewerDomain: string; reviewerRole: string; score: number; worked: string; limitations: string; context: string }
export interface PromptSummary {
  id: number; domain: PromptDomain; title: string; purpose: string; authorName: string; createdAt: string;
  reviewCount: number; ratingAverage: number | null; ranked: boolean; mine: boolean;
  tags?: string[];
}
export interface PeerReview { id: number; reviewerName: string; content: ReviewContent; createdAt: string; mine: boolean }
export interface PromptDetail { summary: PromptSummary; content: PromptContent; reviews: PeerReview[]; myReview: PeerReview | null }
export interface PromptPage { items: PromptSummary[]; page: number; size: number; hasMore: boolean }
export const fetchPeerPrompts = (domain: string, page: number, tag = '') => api.get<Envelope<PromptPage>>('/api/v1/blog/peer-prompts', { params: { domain: domain || undefined, tag: tag || undefined, page } }).then(read);
export const fetchPeerPrompt = (id: string) => api.get<Envelope<PromptDetail>>(`/api/v1/blog/peer-prompts/${id}`).then(read);
export const createPeerPrompt = (content: PromptContent, displayName: string) => api.post<Envelope<PromptDetail>>('/api/v1/blog/me/peer-prompts', { content, displayName }).then(read);
export const savePeerReview = (id: number, content: ReviewContent, displayName: string) => api.put<Envelope<PromptDetail>>(`/api/v1/blog/me/peer-prompts/${id}/review`, { content, displayName }).then(read);
export const removePeerPrompt = (id: number) => api.delete(`/api/v1/blog/me/peer-prompts/${id}`);
export const removePeerReview = (id: number, reviewId: number) => api.delete(`/api/v1/blog/me/peer-prompts/${id}/reviews/${reviewId}`);

export function reviewLabel(prompt: Pick<PromptSummary, 'ratingAverage' | 'reviewCount' | 'ranked'>): string {
  if (!prompt.reviewCount || prompt.ratingAverage == null) return '아직 리뷰 없음 · 순위 미정';
  return `${prompt.ratingAverage.toFixed(1)} / 5 · 리뷰 ${prompt.reviewCount}개${prompt.ranked ? '' : ' · 잠정 평가 (3개부터 순위)'}`;
}
