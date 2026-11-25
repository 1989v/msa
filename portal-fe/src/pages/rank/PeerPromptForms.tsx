import { useState, type FormEvent, type ReactNode } from 'react';
import { promptDomains, savePeerReview, type PromptDetail, type ReviewContent } from '../../api/peerPromptsApi';
import { blogErrorMessage } from '../../api/blogApi';

export function PeerDomainOptions() {
  return Object.entries(promptDomains).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}
const emptyReview: ReviewContent = { reviewerDomain: '', reviewerRole: '', score: 3, worked: '', limitations: '', context: '' };

export function PeerField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="peer-field"><span>{label}</span>{children}</label>;
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
