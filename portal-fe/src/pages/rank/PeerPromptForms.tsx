import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createPeerPrompt, promptDomains, savePeerReview, type PromptContent, type PromptDetail, type PromptDomain, type ReviewContent } from '../../api/peerPromptsApi';
import { blogErrorMessage } from '../../api/blogApi';
import { useAuth } from '../../auth/useAuth';
import { peerLoginHref } from './peerPromptLinks';

export function PeerDomainOptions() {
  return Object.entries(promptDomains).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}
const emptyPrompt: PromptContent = { domain: 'SOFTWARE', title: '', purpose: '', modelContext: '', promptText: '' };
const emptyReview: ReviewContent = { reviewerDomain: '', reviewerRole: '', score: 3, worked: '', limitations: '', context: '' };

export function PeerField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="peer-field"><span>{label}</span>{children}</label>;
}

export function PromptForm() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [content, setContent] = useState(emptyPrompt);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof PromptContent, value: string) => setContent((old) => ({ ...old, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { const result = await createPeerPrompt(content, name); await client.invalidateQueries({ queryKey: ['peer-prompts'] }); navigate(`/prompts/${result.summary.id}`); }
    catch (err) { setError(blogErrorMessage(err, '공유하지 못했습니다. 입력을 확인해 주세요.')); }
    finally { setBusy(false); }
  }
  if (!isLoggedIn) return <section className="peer-panel"><h2>로그인하고 프롬프트 공유하기</h2><p>기존 계정으로 로그인하면 바로 공개할 수 있습니다.</p><a href={peerLoginHref()}>로그인 후 돌아오기</a></section>;
  return <form className="peer-panel peer-form" onSubmit={(e) => void submit(e)}>
    <h2>프롬프트 공개하기</h2><p>게시 즉시 공개됩니다. 리뷰가 평가한 원문을 보존하기 위해 게시 후 수정은 지원하지 않습니다.</p>
    <PeerField label="표시 이름 (첫 참여 시 사용)"><input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" /></PeerField>
    <PeerField label="분야"><select value={content.domain} onChange={(e) => set('domain', e.target.value as PromptDomain)}><PeerDomainOptions /></select></PeerField>
    <PeerField label="제목"><input required maxLength={160} value={content.title} onChange={(e) => set('title', e.target.value)} /></PeerField>
    <PeerField label="업무 목적 · 기대 결과"><textarea required maxLength={1000} value={content.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="어떤 문제를 해결하고 어떤 결과물을 얻었나요?" /></PeerField>
    <PeerField label="모델 · 버전 · 사용 맥락"><textarea required maxLength={2000} value={content.modelContext} onChange={(e) => set('modelContext', e.target.value)} placeholder="사용한 모델, 입력 자료, 대상 독자, 필요한 도구와 제약을 적어주세요." /></PeerField>
    <PeerField label="프롬프트 원문"><textarea className="peer-prompt-input" required maxLength={30000} value={content.promptText} onChange={(e) => set('promptText', e.target.value)} spellCheck={false} /></PeerField>
    {error && <p role="alert">{error}</p>}<button className="kh-button" disabled={busy}>{busy ? '공유 중…' : '공개 공유하기'}</button>
  </form>;
}

export function PeerReviewForm({ detail, onSaved }: { detail: PromptDetail; onSaved: () => Promise<void> }) {
  const mine = detail.myReview;
  const [content, setContent] = useState<ReviewContent>(mine?.content ?? emptyReview);
  const [name, setName] = useState(mine?.reviewerName ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const set = (key: keyof ReviewContent, value: string | number) => setContent((old) => ({ ...old, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try { await savePeerReview(detail.summary.id, content, name); await onSaved(); setMessage('리뷰를 저장했습니다.'); }
    catch (err) { setMessage(blogErrorMessage(err, '리뷰를 저장하지 못했습니다.')); }
    finally { setBusy(false); }
  }
  return <form className="peer-panel peer-form" onSubmit={(e) => void submit(e)}><h2>{mine ? '내 리뷰 수정' : '사용 경험 리뷰하기'}</h2>
    <p>한 사람당 리뷰 한 개입니다. 다시 저장하면 기존 리뷰와 평점이 교체됩니다. 분야·역할은 본인 소개로 공개됩니다.</p>
    <PeerField label="표시 이름 (첫 참여 시 사용)"><input required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></PeerField>
    <PeerField label="나의 분야 (본인 소개)"><input required maxLength={80} value={content.reviewerDomain} onChange={(e) => set('reviewerDomain', e.target.value)} /></PeerField>
    <PeerField label="나의 역할 (본인 소개)"><input required maxLength={80} value={content.reviewerRole} onChange={(e) => set('reviewerRole', e.target.value)} /></PeerField>
    <PeerField label="평점"><select value={content.score} onChange={(e) => set('score', Number(e.target.value))}>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select></PeerField>
    <PeerField label="유용했던 점"><textarea required maxLength={2000} value={content.worked} onChange={(e) => set('worked', e.target.value)} /></PeerField>
    <PeerField label="한계 · 주의점"><textarea required maxLength={2000} value={content.limitations} onChange={(e) => set('limitations', e.target.value)} /></PeerField>
    <PeerField label="테스트 맥락 · 모델 · 입력 조건"><textarea required maxLength={2000} value={content.context} onChange={(e) => set('context', e.target.value)} /></PeerField>
    {message && <p role="status">{message}</p>}<button className="kh-button" disabled={busy}>{busy ? '저장 중…' : '리뷰 저장'}</button>
  </form>;
}
