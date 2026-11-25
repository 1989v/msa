import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import PeerPromptsPage from '../PeerPromptsPage';
import * as api from '../../../api/peerPromptsApi';
import { useAuth } from '../../../auth/useAuth';
import { newPeerDraft, PEER_DRAFT_KEY, readPeerDraft } from '../peerPromptDraft';
import { peerPromptExamples } from '../peerPromptExamples';
import { fetchStudioOverview } from '../../../api/blogApi';

vi.mock('../../../api/peerPromptsApi', async (original) => ({ ...await original<typeof api>(), fetchPeerPrompts: vi.fn(), fetchPeerPrompt: vi.fn(), createPeerPrompt: vi.fn(), savePeerReview: vi.fn(), removePeerReview: vi.fn(), removePeerPrompt: vi.fn() }));
vi.mock('../../../auth/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../../api/blogApi', async (original) => ({ ...await original<typeof import('../../../api/blogApi')>(), fetchStudioOverview: vi.fn() }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface: () => {} }));
vi.mock('../../../components/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../../components/shell/AppInstallMenu', () => ({ default: () => null }));
vi.mock('../../../seo/useSeo', () => ({ useSeo: () => {} }));

const summary: api.PromptSummary = { id: 7, domain: 'SOFTWARE', title: '코드 리뷰', purpose: '리뷰 목적', authorName: 'Alice', createdAt: '2026-11-25T12:00:00', reviewCount: 0, ratingAverage: null, ranked: false, mine: false };
const content: api.PromptContent = { domain: 'SOFTWARE', title: '코드 리뷰', purpose: '리뷰 목적', modelContext: '모델 A / 코드 변경', promptText: '<script>alert(1)</script>\n코드를 검토해주세요' };
const ownReview: api.PeerReview = { id: 5, reviewerName: 'Bob', mine: true, createdAt: '2026-11-25T12:00:00', content: { reviewerDomain: '개발', reviewerRole: '엔지니어', score: 4, worked: '의도 전달', limitations: '직접 검증 필요', context: '모델 A' } };
function LocationProbe() { const location = useLocation(); return <output data-testid="route-search">{location.search}</output>; }
function setup(path = '/prompts') {
  window.history.replaceState({}, '', path);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><LocationProbe /><Routes>
    <Route path="/prompts" element={<PeerPromptsPage />} /><Route path="/prompts/new" element={<PeerPromptsPage create />} /><Route path="/prompts/:id" element={<PeerPromptsPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(fetchStudioOverview).mockResolvedValue({ profile: null, canWrite: false, draftCount: 0, publishedCount: 0, totalViews: 0 });
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: false, userId: null, login: vi.fn(), logout: vi.fn() });
  vi.mocked(api.fetchPeerPrompts).mockResolvedValue({ items: [], page: 0, size: 20, hasMore: false });
  vi.mocked(api.fetchPeerPrompt).mockResolvedValue({ summary, content, reviews: [], myReview: null });
});

it('shows an honest empty state and changes domain query instead of fake counts', async () => {
  setup();
  expect(await screen.findByText(/아직 공유된 프롬프트가 없습니다\./)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '디자인' }));
  await waitFor(() => expect(api.fetchPeerPrompts).toHaveBeenLastCalledWith('DESIGN', 0, ''));
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
  fireEvent.click(screen.getByRole('button', { name: '미리보기' }));
  expect(api.createPeerPrompt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '공개 게시하기' }));
  await waitFor(() => expect(api.createPeerPrompt).toHaveBeenCalledWith({ ...content, tags: [] }, 'Alice'));
  expect(await screen.findByRole('button', { name: '원문 복사' })).toBeTruthy();
});

it('combines independent domain and purpose chips before requesting the next page', async () => {
  vi.mocked(api.fetchPeerPrompts).mockResolvedValue({ items: [summary], page: 0, size: 20, hasMore: true });
  setup();
  fireEvent.click(screen.getByRole('button', { name: '데이터' }));
  fireEvent.click(screen.getByRole('button', { name: '분석' }));
  await waitFor(() => expect(api.fetchPeerPrompts).toHaveBeenLastCalledWith('DATA', 0, 'ANALYSIS'));
  fireEvent.click(await screen.findByRole('button', { name: '다음' }));
  await waitFor(() => expect(api.fetchPeerPrompts).toHaveBeenLastCalledWith('DATA', 1, 'ANALYSIS'));
  fireEvent.click(screen.getByRole('button', { name: '요약' }));
  await waitFor(() => expect(api.fetchPeerPrompts).toHaveBeenLastCalledWith('DATA', 0, 'SUMMARY'));
});

it('keeps editorial examples discoverable during a community API failure and filters them without ratings', async () => {
  vi.mocked(api.fetchPeerPrompts).mockRejectedValue(new Error('일시 오류'));
  setup();
  await screen.findByRole('alert');
  expect(screen.getByText('사용 예시')).toBeTruthy();
  expect(screen.getByText(/예시 출력은 설명용이며 실제 모델 응답이 아닙니다/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '소프트웨어' }));
  const shown = peerPromptExamples.filter(example => example.domain === 'SOFTWARE');
  expect(screen.getAllByText('입력·출력 예시와 원문 보기')).toHaveLength(shown.length);
  expect(screen.queryByText(/리뷰 0개/)).toBeNull();
});

it('composes while logged out, preserves the preview through login return and only publishes explicitly', async () => {
  const draft = newPeerDraft({ ...content, tags: ['REVIEW'] });
  draft.displayName = 'Alice';
  sessionStorage.setItem(PEER_DRAFT_KEY, JSON.stringify(draft));
  const mounted = setup('/prompts/new');
  expect(screen.getByLabelText('제목')).toHaveValue(content.title);
  fireEvent.click(screen.getByRole('button', { name: '미리보기' }));
  expect(api.createPeerPrompt).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: '로그인하고 돌아오기' })).toBeTruthy();
  expect(readPeerDraft()?.step).toBe('preview');
  mounted.unmount();
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: true, userId: '10', login: vi.fn(), logout: vi.fn() });
  vi.mocked(api.createPeerPrompt).mockResolvedValue({ summary, content, reviews: [], myReview: null });
  setup('/prompts/new');
  expect(screen.getByRole('button', { name: '공개 게시하기' })).toBeTruthy();
  expect(api.createPeerPrompt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '공개 게시하기' }));
  await waitFor(() => expect(api.createPeerPrompt).toHaveBeenCalledTimes(1));
  expect(api.createPeerPrompt).toHaveBeenCalledWith({ ...content, tags: ['REVIEW'] }, 'Alice');
  await waitFor(() => expect(readPeerDraft()).toBeNull());
});

it('requires confirmation before applying an example over an existing draft', () => {
  const draft = newPeerDraft(content); draft.displayName = 'Alice';
  sessionStorage.setItem(PEER_DRAFT_KEY, JSON.stringify(draft));
  setup(`/prompts/new?example=${peerPromptExamples[0].slug}`);
  expect(screen.getByLabelText('제목')).toHaveValue(content.title);
  expect(screen.getByText('작성 중인 초안이 있습니다')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '예시로 바꾸기' }));
  expect(screen.getByLabelText('제목')).toHaveValue(peerPromptExamples[0].title);
  expect(readPeerDraft()?.content.promptText).toBe(peerPromptExamples[0].promptText);
  expect(api.createPeerPrompt).not.toHaveBeenCalled();
});

it('validates near each field and limits purpose tags to three choices', () => {
  setup('/prompts/new');
  fireEvent.click(screen.getByRole('button', { name: '미리보기' }));
  expect(screen.getByLabelText('제목')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('제목을 입력해 주세요.')).toBeTruthy();
  for (const name of ['분석', '작성', '검토']) fireEvent.click(screen.getByRole('checkbox', { name }));
  expect(screen.getByRole('checkbox', { name: '기획' })).toBeDisabled();
  expect(readPeerDraft()?.content.tags).toEqual(['ANALYSIS', 'WRITING', 'REVIEW']);
  expect(api.createPeerPrompt).not.toHaveBeenCalled();
});

it('consumes only the example query and preserves template edits across preview and remount', async () => {
  const example = peerPromptExamples[0];
  const mounted = setup(`/prompts/new?example=${example.slug}&keep=1`);
  await waitFor(() => expect(screen.getByTestId('route-search')).toHaveTextContent('?keep=1'));
  expect(readPeerDraft()?.content.title).toBe(example.title);
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '나의 수정 제목' } });
  fireEvent.change(screen.getByLabelText(/표시 이름/), { target: { value: 'Alice' } });
  fireEvent.click(screen.getByRole('button', { name: '미리보기' }));
  expect(screen.getByRole('heading', { name: '나의 수정 제목' })).toBeTruthy();
  mounted.unmount();
  setup('/prompts/new?keep=1');
  expect(screen.queryByText('작성 중인 초안이 있습니다')).toBeNull();
  expect(screen.getByRole('heading', { name: '나의 수정 제목' })).toBeTruthy();
  expect(readPeerDraft()?.step).toBe('preview');
});

it('treats a domain-only draft as real input before applying a template', () => {
  const draft = newPeerDraft(); draft.content.domain = 'DATA';
  sessionStorage.setItem(PEER_DRAFT_KEY, JSON.stringify(draft));
  setup(`/prompts/new?example=${peerPromptExamples[0].slug}`);
  expect(screen.getByText('작성 중인 초안이 있습니다')).toBeTruthy();
  expect(screen.getByLabelText('분야')).toHaveValue('DATA');
  fireEvent.click(screen.getByRole('button', { name: '내 초안 계속 작성' }));
  expect(readPeerDraft()?.content.domain).toBe('DATA');
});

it('keeps the same example disclosure node mounted when loading settles to empty', async () => {
  let finish!: (page: api.PromptPage) => void;
  vi.mocked(api.fetchPeerPrompts).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  setup();
  const disclosure = screen.getAllByText('입력·출력 예시와 원문 보기')[0];
  fireEvent.click(disclosure);
  const details = disclosure.closest('details');
  expect(details?.open).toBe(true);
  finish({ items: [], page: 0, size: 20, hasMore: false });
  await screen.findByText(/아직 공유된 프롬프트가 없습니다\./);
  expect(screen.getAllByText('입력·출력 예시와 원문 보기')[0]).toBe(disclosure);
  expect(details?.open).toBe(true);
});

it('uses the existing account display name instead of asking for another author name', async () => {
  vi.mocked(useAuth).mockReturnValue({ isLoggedIn: true, userId: '10', login: vi.fn(), logout: vi.fn() });
  vi.mocked(fetchStudioOverview).mockResolvedValue({ profile: { id: 2, memberId: 10, handle: null, displayName: '계정 이름', bio: null, role: 'READER', status: 'ACTIVE', postCount: 0, approvedAt: null, createdAt: null }, canWrite: false, draftCount: 0, publishedCount: 0, totalViews: 0 });
  const draft = newPeerDraft(content);
  sessionStorage.setItem(PEER_DRAFT_KEY, JSON.stringify(draft));
  setup('/prompts/new');
  await screen.findByText('계정 이름');
  expect(screen.queryByLabelText(/표시 이름/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '미리보기' }));
  expect(screen.getByText(/소프트웨어 · 계정 이름/)).toBeTruthy();
  expect(api.createPeerPrompt).not.toHaveBeenCalled();
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
  expect(await screen.findByText(/아직 공유된 프롬프트가 없습니다\./)).toBeTruthy();
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
  expect(await screen.findByText(/아직 공유된 프롬프트가 없습니다\./)).toBeTruthy();
});
