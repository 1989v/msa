import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import PeerPromptsPage from '../PeerPromptsPage';
import * as api from '../../../api/peerPromptsApi';
import { useAuth } from '../../../auth/useAuth';

vi.mock('../../../api/peerPromptsApi', async (original) => ({ ...await original<typeof api>(), fetchPeerPrompts: vi.fn(), fetchPeerPrompt: vi.fn(), createPeerPrompt: vi.fn(), savePeerReview: vi.fn(), removePeerReview: vi.fn(), removePeerPrompt: vi.fn() }));
vi.mock('../../../auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface: () => {} }));
vi.mock('../../../components/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../../seo/useSeo', () => ({ useSeo: () => {} }));

const summary: api.PromptSummary = { id: 7, domain: 'SOFTWARE', title: '코드 리뷰', purpose: '리뷰 목적', authorName: 'Alice', createdAt: '2026-11-25T12:00:00', reviewCount: 0, ratingAverage: null, ranked: false, mine: false };
const content: api.PromptContent = { domain: 'SOFTWARE', title: '코드 리뷰', purpose: '리뷰 목적', modelContext: '모델 A / 코드 변경', promptText: '<script>alert(1)</script>\n코드를 검토해주세요' };
const ownReview: api.PeerReview = { id: 5, reviewerName: 'Bob', mine: true, createdAt: '2026-11-25T12:00:00', content: { reviewerDomain: '개발', reviewerRole: '엔지니어', score: 4, worked: '의도 전달', limitations: '직접 검증 필요', context: '모델 A' } };
function setup(path = '/prompts') {
  window.history.replaceState({}, '', path);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/prompts" element={<PeerPromptsPage />} /><Route path="/prompts/new" element={<PeerPromptsPage create />} /><Route path="/prompts/:id" element={<PeerPromptsPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: false, userId: null, login: vi.fn(), logout: vi.fn() });
  vi.mocked(api.fetchPeerPrompts).mockResolvedValue({ items: [], page: 0, size: 20, hasMore: false });
  vi.mocked(api.fetchPeerPrompt).mockResolvedValue({ summary, content, reviews: [], myReview: null });
});

it('shows an honest empty state and changes domain query instead of fake counts', async () => {
  setup();
  expect(await screen.findByText('아직 공유된 프롬프트가 없습니다')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('분야'), { target: { value: 'DESIGN' } });
  await waitFor(() => expect(api.fetchPeerPrompts).toHaveBeenLastCalledWith('DESIGN', 0));
  expect(screen.getByText(/자격 인증이 아닙니다/)).toBeTruthy();
});

it('distinguishes no reviews and provisional reviews without inventing a rank', async () => {
  vi.mocked(api.fetchPeerPrompts).mockResolvedValue({ items: [summary, { ...summary, id: 8, title: '잠정 프롬프트', reviewCount: 1, ratingAverage: 5 }], page: 0, size: 20, hasMore: false });
  setup('/prompts?domain=SOFTWARE');
  expect(await screen.findByText(/아직 리뷰 없음 · 순위 미정/)).toBeTruthy();
  expect(screen.getByText(/5.0 \/ 5 · 리뷰 1개 · 잠정 평가/)).toBeTruthy();
  expect(screen.queryByText('1위')).toBeNull();
});

it('safely renders prompt text, copies the stable link and offers deep-link login', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  setup('/prompts/7');
  await screen.findByRole('button', { name: '원문 복사' });
  expect(document.querySelector('pre')?.textContent).toBe(content.promptText);
  expect(document.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://rank.1989v.com/prompts/7'));
  expect(screen.getByRole('link', { name: '로그인하고 리뷰 남기기' }).getAttribute('href')).toBe('https://1989v.com/login?next=https%3A%2F%2Frank.1989v.com%2Fprompts%2F7');
});

it('keeps a review older than the 100-preview available for reading and editing', async () => {
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: true, userId: '10', login: vi.fn(), logout: vi.fn() });
  vi.mocked(api.fetchPeerPrompt).mockResolvedValue({ summary: { ...summary, reviewCount: 101, ratingAverage: 4, ranked: true }, content, reviews: [], myReview: ownReview });
  vi.mocked(api.savePeerReview).mockResolvedValue({ summary, content, reviews: [ownReview], myReview: ownReview });
  setup('/prompts/7');
  expect(await screen.findByText('이전에 작성한 내 리뷰')).toBeTruthy();
  expect(screen.getByLabelText('한계 · 주의점')).toHaveValue('직접 검증 필요');
  fireEvent.change(screen.getByLabelText('유용했던 점'), { target: { value: '개선된 리뷰' } });
  fireEvent.click(screen.getByRole('button', { name: '리뷰 저장' }));
  await waitFor(() => expect(api.savePeerReview).toHaveBeenCalledWith(7, { ...ownReview.content, worked: '개선된 리뷰' }, 'Bob'));
});

it('publishes complete content and navigates to its persistent detail', async () => {
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: true, userId: '10', login: vi.fn(), logout: vi.fn() });
  vi.mocked(api.createPeerPrompt).mockResolvedValue({ summary, content, reviews: [], myReview: null });
  setup('/prompts/new');
  fireEvent.change(screen.getByLabelText(/표시 이름/), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: content.title } });
  fireEvent.change(screen.getByLabelText('업무 목적 · 기대 결과'), { target: { value: content.purpose } });
  fireEvent.change(screen.getByLabelText('모델 · 버전 · 사용 맥락'), { target: { value: content.modelContext } });
  fireEvent.change(screen.getByLabelText('프롬프트 원문'), { target: { value: content.promptText } });
  fireEvent.click(screen.getByRole('button', { name: '공개 공유하기' }));
  await waitFor(() => expect(api.createPeerPrompt).toHaveBeenCalledWith(content, 'Alice'));
  expect(await screen.findByRole('button', { name: '원문 복사' })).toBeTruthy();
});

it('does not show a review form to the author', async () => {
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: true, userId: '10', login: vi.fn(), logout: vi.fn() });
  vi.mocked(api.fetchPeerPrompt).mockResolvedValue({ summary: { ...summary, mine: true }, content, reviews: [], myReview: null });
  setup('/prompts/7');
  expect(await screen.findByText('작성자는 자신의 프롬프트를 평가할 수 없습니다.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '리뷰 저장' })).toBeNull();
});

it('shows fetch failure and recovers on retry', async () => {
  vi.mocked(api.fetchPeerPrompts).mockRejectedValueOnce(new Error('네트워크 연결 실패'));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent('네트워크 연결 실패');
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
  expect(await screen.findByText('아직 공유된 프롬프트가 없습니다')).toBeTruthy();
});

it('requires confirmation before an author removes a published prompt', async () => {
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: true, userId: '10', login: vi.fn(), logout: vi.fn() });
  vi.mocked(api.fetchPeerPrompt).mockResolvedValue({ summary: { ...summary, mine: true }, content, reviews: [], myReview: null });
  vi.mocked(api.removePeerPrompt).mockResolvedValue({} as Awaited<ReturnType<typeof api.removePeerPrompt>>);
  setup('/prompts/7');
  fireEvent.click(await screen.findByRole('button', { name: '내 프롬프트 삭제' }));
  expect(api.removePeerPrompt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }));
  await waitFor(() => expect(api.removePeerPrompt).toHaveBeenCalledWith(7));
  expect(await screen.findByText('아직 공유된 프롬프트가 없습니다')).toBeTruthy();
});
