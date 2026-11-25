import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPeerPrompt, promptDomains, promptTags, type PromptContent, type PromptTag } from '../../api/peerPromptsApi';
import { blogErrorMessage, fetchStudioOverview } from '../../api/blogApi';
import { useAuth } from '../../auth/useAuth';
import { PeerDomainOptions, PeerField } from './PeerPromptForms';
import { peerLoginHref } from './peerPromptLinks';
import { peerPromptExamples } from './peerPromptExamples';
import { clearPeerDraft, draftRevision, hasDraftContent, newPeerDraft, readPeerDraft, savePeerDraft, validatePeerDraft, type DraftErrors, type PeerDraft } from './peerPromptDraft';

function exampleContent(example: typeof peerPromptExamples[number]): PromptContent {
  return { domain: example.domain, title: example.title, purpose: example.purpose, modelContext: example.modelContext,
    promptText: example.promptText, tags: example.tags.filter(tag => tag in promptTags).slice(0, 3) };
}

export default function PromptComposer() {
  const { isLoggedIn, userId } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const account = useQuery({ queryKey: ['peer-prompt-account', userId], queryFn: fetchStudioOverview, enabled: isLoggedIn, retry: false });
  const accountName = account.data?.profile?.displayName;
  const [params, setParams] = useSearchParams();
  const [initial] = useState(() => {
    const saved = readPeerDraft();
    const example = peerPromptExamples.find(item => item.slug === params.get('example'));
    return { saved, example, draft: saved && (!example || hasDraftContent(saved)) ? saved : newPeerDraft(example ? exampleContent(example) : undefined) };
  });
  const [draft, setDraft] = useState(initial.draft);
  const effectiveDraft = accountName ? { ...draft, displayName: accountName } : draft;
  const [pendingExample, setPendingExample] = useState(initial.saved && initial.example && hasDraftContent(initial.saved) ? initial.example : null);
  const expectedRevision = useRef(initial.saved?.revision ?? null);
  const [saveState, setSaveState] = useState<'saved' | 'memory' | 'conflict' | 'unavailable'>(initial.saved ? 'saved' : 'memory');
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const publishing = useRef(false);
  const [message, setMessage] = useState('');
  const top = useRef<HTMLDivElement>(null);

  // Consume only the template key after preserving its actual fields. Reload and OAuth return
  // restore the same draft, rather than re-applying the original example over subsequent edits.
  useEffect(() => {
    if (!initial.example || pendingExample || !params.has('example')) return;
    if (savePeerDraft(draft, expectedRevision.current) !== 'saved') return;
    expectedRevision.current = draft.revision;
    const next = new URLSearchParams(params); next.delete('example');
    setParams(next, { replace: true });
  }, [draft, initial.example, params, pendingExample, setParams]);

  function update(next: PeerDraft): boolean {
    const value = { ...next, revision: draftRevision() };
    const state = savePeerDraft(value, expectedRevision.current);
    setSaveState(state);
    if (state === 'saved') expectedRevision.current = value.revision;
    setDraft(value);
    return state === 'saved';
  }
  function setContent(key: keyof PromptContent, value: string | string[]) {
    update({ ...draft, content: { ...draft.content, [key]: value }, step: 'edit' });
    setErrors(old => ({ ...old, [key]: undefined }));
  }
  function applyExample(replace: boolean) {
    if (replace && pendingExample) update({ ...draft, content: exampleContent(pendingExample), step: 'edit' });
    setPendingExample(null);
    const next = new URLSearchParams(params); next.delete('example'); setParams(next, { replace: true });
  }
  function preview(event: FormEvent) {
    event.preventDefault();
    const found = validatePeerDraft(effectiveDraft);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage('입력 내용을 확인해 주세요. 아직 공개되지 않았습니다.');
      document.getElementById(`peer-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    update({ ...effectiveDraft, step: 'preview' }); setMessage(''); top.current?.focus();
  }
  async function publish() {
    if (publishing.current || !isLoggedIn || draft.step !== 'preview' || pendingExample) return;
    const found = validatePeerDraft(effectiveDraft);
    if (Object.keys(found).length) { setErrors(found); update({ ...draft, step: 'edit' }); return; }
    if (savePeerDraft(draft, expectedRevision.current) === 'conflict') { setSaveState('conflict'); return; }
    publishing.current = true; setBusy(true); setMessage('');
    try {
      const result = await createPeerPrompt(draft.content, effectiveDraft.displayName.trim());
      clearPeerDraft(draft.revision);
      await client.invalidateQueries({ queryKey: ['peer-prompts'] });
      navigate(`/prompts/${result.summary.id}`);
    } catch (error) { setMessage(blogErrorMessage(error, '공개하지 못했습니다. 초안은 이 탭에 유지됩니다.')); }
    finally { publishing.current = false; setBusy(false); }
  }
  const field = (key: 'title' | 'purpose' | 'modelContext' | 'promptText', label: string, max: number, placeholder: string, multiline = true) => {
    const props = { id: `peer-${key}`, 'aria-label': label, value: draft.content[key], maxLength: max, 'aria-invalid': !!errors[key],
      'aria-describedby': errors[key] ? `peer-${key}-error` : undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContent(key, event.target.value), placeholder };
    return <PeerField label={label}>{multiline ? <textarea {...props} className={key === 'promptText' ? 'peer-prompt-input' : undefined} spellCheck={key !== 'promptText'} /> : <input {...props} />}{errors[key] && <small className="peer-field-error" id={`peer-${key}-error`}>{errors[key]}</small>}</PeerField>;
  };
  return <div className="peer-compose" ref={top} tabIndex={-1}>
    <ol className="peer-steps" aria-label="공유 단계"><li aria-current={draft.step === 'edit' ? 'step' : undefined}>1 작성</li><li aria-current={draft.step === 'preview' ? 'step' : undefined}>2 미리보기</li><li>3 공개 게시</li></ol>
    {pendingExample && <section className="peer-callout" role="alert"><h2>작성 중인 초안이 있습니다</h2><p>‘{pendingExample.title}’ 예시로 바꾸면 현재 작성 내용을 대체합니다.</p><div className="peer-actions"><button type="button" className="kh-button" onClick={() => applyExample(true)}>예시로 바꾸기</button><button type="button" className="kh-button kh-button-ghost" onClick={() => applyExample(false)}>내 초안 계속 작성</button></div></section>}
    {saveState === 'conflict' && <div className="peer-callout" role="alert"><h2>다른 초안이 저장되어 있습니다</h2><p>현재 입력으로 덮어쓰지 않았습니다. 저장된 초안을 불러오거나 현재 내용을 복사해 보관하세요.</p><button type="button" className="kh-button kh-button-ghost" onClick={() => { const stored = readPeerDraft(); if (stored) { expectedRevision.current = stored.revision; setDraft(stored); setSaveState('saved'); } }}>저장된 초안 불러오기</button></div>}
    {draft.step === 'edit' ? <form className="peer-panel peer-form" noValidate onSubmit={preview}>
      <p className="peer-note">로그인 전에도 작성할 수 있어요. 미리보기 후 직접 게시하기 전까지 공개되지 않습니다.</p>
      {field('title', '제목', 160, '예: 고객 문의에서 반복되는 배송 문제 찾기', false)}
      {field('promptText', '프롬프트 원문', 30000, '다른 사람이 복사해 사용할 수 있도록 원문을 적어주세요.')}
      <PeerField label="분야"><select value={draft.content.domain} onChange={event => setContent('domain', event.target.value)}><PeerDomainOptions /></select></PeerField>
      <fieldset className="peer-tag-picker"><legend>업무 태그 <small>선택 · 최대 3개</small></legend><div className="peer-chips">{Object.entries(promptTags).map(([tag, label]) => {
        const selected = draft.content.tags?.includes(tag) ?? false;
        return <label className={`peer-check-chip ${selected ? 'is-selected' : ''}`} key={tag}><input type="checkbox" checked={selected} disabled={!selected && (draft.content.tags?.length ?? 0) >= 3} onChange={() => setContent('tags', selected ? draft.content.tags!.filter(item => item !== tag) : [...(draft.content.tags ?? []), tag as PromptTag])} />{label}</label>;
      })}</div></fieldset>
      {field('purpose', '업무 목적 · 기대 결과', 1000, '누구의 어떤 문제를 풀고, 어떤 결과물을 얻나요?')}
      {field('modelContext', '모델 · 버전 · 사용 맥락', 2000, '사용한 모델, 입력 자료, 도구와 제약 조건을 알려주세요.')}
      {accountName ? <p className="peer-note">게시 이름: <strong>{accountName}</strong> · 기존 계정의 표시 이름을 사용합니다.</p> : <>
        <PeerField label="표시 이름 (첫 참여 시 사용)"><input aria-label="표시 이름 (첫 참여 시 사용)" id="peer-displayName" maxLength={40} autoComplete="nickname" value={draft.displayName} aria-invalid={!!errors.displayName} aria-describedby={errors.displayName ? 'peer-displayName-error' : undefined} onChange={event => { update({ ...draft, displayName: event.target.value }); setErrors(old => ({ ...old, displayName: undefined })); }} />{errors.displayName && <small className="peer-field-error" id="peer-displayName-error">{errors.displayName}</small>}</PeerField>
      <p className="peer-note">기존 계정에 표시 이름이 있으면 그 이름으로 게시됩니다.</p></>}
      <p className="peer-note">비밀키·개인정보·회사 기밀은 제외해 주세요. 공개 후에는 원문을 수정할 수 없으며 삭제 후 새 글로 공유할 수 있습니다.</p>
      <div className="peer-compose-bar"><span className="peer-note" role="status">{saveState === 'saved' ? '이 탭에 초안 저장됨' : saveState === 'conflict' ? '다른 초안과 충돌 · 자동 저장 중지' : saveState === 'memory' ? '작성 중 · 게시 전까지 비공개' : '로그인 전 초안 저장 상태를 확인해 주세요'}</span><button className="kh-button" disabled={saveState === 'conflict' || !!pendingExample}>미리보기</button></div>
    </form> : <section className="peer-panel peer-preview"><p className="kh-section-label">공개 전 미리보기</p><h2>{draft.content.title}</h2><p className="peer-note">{promptDomains[draft.content.domain]} · {effectiveDraft.displayName} · {(draft.content.tags ?? []).map(tag => promptTags[tag as PromptTag]).join(' · ') || '업무 태그 없음'}</p>
      <h3>업무 목적</h3><p className="peer-prewrap">{draft.content.purpose}</p><h3>모델 · 사용 맥락</h3><p className="peer-prewrap">{draft.content.modelContext}</p><h3>프롬프트 원문</h3><pre className="peer-prompt-text" tabIndex={0}>{draft.content.promptText}</pre>
      <p className="peer-note">아직 공개되지 않았습니다. 게시하면 누구나 원문과 사용 맥락을 볼 수 있습니다.</p>
      <div className="peer-actions"><button type="button" className="kh-button kh-button-ghost" disabled={busy} onClick={() => update({ ...draft, step: 'edit' })}>돌아가서 수정</button>
        {isLoggedIn ? <button type="button" className="kh-button" disabled={busy || saveState === 'conflict' || !!pendingExample} onClick={() => void publish()}>{busy ? '게시 중…' : '공개 게시하기'}</button> : <a className="kh-button" href={peerLoginHref()} onClick={event => { if (!update(draft)) { event.preventDefault(); setMessage('이 탭에 초안을 저장하지 못해 로그인 이동을 멈췄습니다. 내용을 복사해 보관한 뒤 다시 시도해 주세요.'); } }}>로그인하고 돌아오기</a>}
      </div></section>}
    {message && <p className="peer-callout" role="alert">{message}</p>}
    {saveState === 'unavailable' && hasDraftContent(draft) && <p className="peer-note">이 탭의 저장 공간을 사용할 수 없으면 새로고침·로그인 이동 전에 원문을 별도로 보관해 주세요.</p>}
    <p className="peer-note"><Link to="/prompts#examples">예시에서 시작하기</Link> · 초안은 이 브라우저 탭에만 보관됩니다. 공용 기기에서는 내용을 남기지 마세요.</p>
  </div>;
}
