import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { promptDomains, removePeerPrompt, removePeerReview, reviewLabel, type PeerReview, type PromptDetail } from '../../api/peerPromptsApi';
import { blogErrorMessage } from '../../api/blogApi';
import { useAuth } from '../../auth/useAuth';
import { PEER_ORIGIN, peerLoginHref } from './peerPromptLinks';
import { PeerReviewForm } from './PeerPromptForms';

export default function PeerPromptView({ detail }: { detail: PromptDetail }) {
  const { summary, content, reviews, myReview } = detail;
  const { isLoggedIn } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const url = `${PEER_ORIGIN}/prompts/${summary.id}`;
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['peer-prompt'] }); await client.invalidateQueries({ queryKey: ['peer-prompts'] }); };
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('복사했습니다.'); }
    catch { setNotice('복사하지 못했습니다. 원문이나 주소를 직접 선택해 복사해 주세요.'); }
  }
  async function remove(reviewId?: number) {
    setBusy(true); setNotice('');
    try { if (reviewId) { await removePeerReview(summary.id, reviewId); await refresh(); } else { await removePeerPrompt(summary.id); await refresh(); navigate('/prompts'); } }
    catch (err) { setNotice(blogErrorMessage(err, '삭제하지 못했습니다.')); }
    finally { setBusy(false); }
  }
  return <>
    <article className="peer-panel">
      <p className="peer-note">{promptDomains[summary.domain]} · {summary.authorName} · {new Date(summary.createdAt).toLocaleDateString('ko-KR')}</p>
      <h2>{summary.title}</h2><p>{reviewLabel(summary)}</p><h3>업무 목적</h3><p className="peer-prewrap">{content.purpose}</p>
      <h3>모델 · 사용 맥락</h3><p className="peer-prewrap">{content.modelContext}</p>
      <div className="peer-actions"><h3>프롬프트 원문</h3><button onClick={() => void copy(content.promptText)}>원문 복사</button><button onClick={() => void copy(url)}>링크 복사</button></div>
      <pre className="peer-prompt-text" tabIndex={0}>{content.promptText}</pre><p className="peer-note">고정 주소: <a href={url}>{url}</a></p>
      <div className="peer-actions"><a href={`mailto:1989v@naver.com?subject=${encodeURIComponent('프롬프트 게시물 신고')}&body=${encodeURIComponent(`게시물: ${url}\n신고 사유: `)}`}>게시물·리뷰 신고</a>{summary.mine && <button disabled={busy} onClick={() => setConfirmRemove(true)}>내 프롬프트 삭제</button>}</div>
      {confirmRemove && <div role="alert"><p>원문과 리뷰를 공개 목록에서 내립니다. 삭제할까요?</p><button disabled={busy} onClick={() => void remove()}>삭제 확인</button><button disabled={busy} onClick={() => setConfirmRemove(false)}>취소</button></div>}
    </article>
    {notice && <p role="status">{notice}</p>}
    <section className="peer-panel"><h2>동료 리뷰 {summary.reviewCount}개</h2><p className="peer-note">분야·역할은 리뷰어 본인의 설명이며 검증된 전문가 자격이 아닙니다. 사용 환경에 따라 결과가 달라집니다.</p>
      {reviews.length === 0 && <p>아직 리뷰가 없습니다. 직접 사용한 맥락과 한계를 남겨주세요.</p>}
      {summary.reviewCount > reviews.length && <p>최근 리뷰 {reviews.length}개를 표시합니다. 평점은 전체 {summary.reviewCount}개를 반영합니다.</p>}
      {reviews.map((review) => <Review key={review.id} review={review} busy={busy} onRemove={() => void remove(review.id)} />)}
      {myReview && !reviews.some((review) => review.mine) && <><h3>이전에 작성한 내 리뷰</h3><Review review={myReview} busy={busy} onRemove={() => void remove(myReview.id)} /></>}
    </section>
    {summary.mine ? <p>작성자는 자신의 프롬프트를 평가할 수 없습니다.</p> : isLoggedIn ? <PeerReviewForm key={myReview?.id ?? 'new'} detail={detail} onSaved={refresh} /> : <a href={peerLoginHref()}>로그인하고 리뷰 남기기</a>}
  </>;
}

function Review({ review, busy, onRemove }: { review: PeerReview; busy: boolean; onRemove: () => void }) {
  return <article className="peer-review"><h3>{review.reviewerName} · {review.content.score} / 5</h3><p className="peer-note">{review.content.reviewerDomain} / {review.content.reviewerRole} (본인 소개) · {new Date(review.createdAt).toLocaleDateString('ko-KR')}</p>
    <dl><dt>유용했던 점</dt><dd>{review.content.worked}</dd><dt>한계 · 주의점</dt><dd>{review.content.limitations}</dd><dt>테스트 맥락</dt><dd>{review.content.context}</dd></dl>
    {review.mine && <button disabled={busy} onClick={onRemove}>내 리뷰 삭제</button>}
  </article>;
}
