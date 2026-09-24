import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  REJECT_REASON_LABEL,
  adsErrorMessage,
  archiveCreative,
  fetchCreatives,
  reviseCreative,
  submitCreative,
  type Creative,
} from '../../api/adsConsoleApi';
import { PreviewImage, StatePill } from './consoleParts';
import { CREATIVE_STATE } from './consoleView';

const TITLE_MAX = 40;
const BODY_MAX = 90;

/** 올리기 전에 거를 수 있는 것만 본다 — 형식·크기·비율 판정의 원본은 서버다. */
const IMAGE_TYPES = ['image/png', 'image/jpeg'];
const IMAGE_MAX_BYTES = 300 * 1024;

interface DraftState {
  title: string;
  body: string;
  landingUrl: string;
  image: File | null;
}

const EMPTY: DraftState = { title: '', body: '', landingUrl: 'https://', image: null };

/**
 * 캠페인의 소재 — 올리기·고치기(다시 심사 대기)·보관, 심사 상태와 반려 사유.
 * 광고주가 적은 문구는 텍스트로만 그린다.
 */
export default function CreativesPanel({ campaignId, readOnly }: { campaignId: number; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const creatives = useQuery({ queryKey: ['ads', 'creatives', campaignId], queryFn: () => fetchCreatives(campaignId) });
  const [editing, setEditing] = useState<Creative | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ads', 'creatives', campaignId] });

  const save = useMutation({
    mutationFn: (input: DraftState) => (editing ? reviseCreative(editing.id, input) : submitCreative(campaignId, input)),
    onSuccess: () => {
      setError(null);
      setNotice(editing ? '고쳤습니다. 다시 심사를 기다립니다.' : '올렸습니다. 심사를 기다립니다.');
      setEditing(null);
      setDraft(EMPTY);
      invalidate();
    },
    onError: (err) => {
      setNotice(null);
      setError(adsErrorMessage(err, '소재를 저장하지 못했습니다.'));
    },
  });

  const archive = useMutation({
    mutationFn: archiveCreative,
    onSuccess: invalidate,
    onError: (err) => setError(adsErrorMessage(err, '보관하지 못했습니다.')),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('제목과 문구를 적어 주세요.');
      return;
    }
    if (!editing && !draft.image) {
      setError('이미지를 골라 주세요.');
      return;
    }
    if (draft.image && !IMAGE_TYPES.includes(draft.image.type)) {
      setError('이미지는 PNG 나 JPEG 만 올릴 수 있습니다.');
      return;
    }
    if (draft.image && draft.image.size > IMAGE_MAX_BYTES) {
      setError('이미지는 300KB 이하만 올릴 수 있습니다.');
      return;
    }
    save.mutate(draft);
  };

  const startEdit = (creative: Creative) => {
    setEditing(creative);
    setDraft({ title: creative.title, body: creative.body, landingUrl: creative.landingUrl, image: null });
    setError(null);
    setNotice(null);
  };

  const list = (creatives.data ?? []).filter((c) => c.status !== 'ARCHIVED');

  return (
    <section className="adc-section">
      <div className="adc-section__head">
        <h2>소재</h2>
      </div>
      {creatives.isLoading && <p className="adc-status">불러오는 중…</p>}
      {creatives.isSuccess && list.length === 0 && <p className="adc-status">아직 소재가 없습니다.</p>}
      <ul className="adc-creatives">
        {list.map((creative) => {
          const state = CREATIVE_STATE[creative.status];
          return (
            <li key={creative.id} className="adc-creative">
              {creative.imageUrl ? (
                <PreviewImage url={creative.imageUrl} alt={creative.title} />
              ) : (
                <span className="adc-preview adc-preview--empty" aria-hidden="true" />
              )}
              <div className="adc-creative__body">
                <div className="adc-creative__head">
                  <StatePill tone={state.tone} label={state.label} />
                </div>
                <p className="adc-creative-title">{creative.title}</p>
                <p className="adc-creative__copy">{creative.body}</p>
                <p className="adc-creative__link">{creative.landingUrl}</p>
                {creative.rejectReason && (
                  <p className="adc-reason">반려 사유: {REJECT_REASON_LABEL[creative.rejectReason]}</p>
                )}
                {!readOnly && (
                  <div className="adc-actions">
                    <button type="button" className="adc-btn adc-btn--ghost" onClick={() => startEdit(creative)}>
                      고치기
                    </button>
                    <button
                      type="button"
                      className="adc-btn adc-btn--ghost"
                      disabled={archive.isPending}
                      onClick={() => archive.mutate(creative.id)}
                    >
                      보관
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <form className="adc-form" onSubmit={onSubmit} aria-label="소재">
          <h3 className="adc-subhead">{editing ? '소재 고치기' : '소재 올리기'}</h3>
          <label className="adc-field">
            <span className="adc-field__label">
              제목 ({draft.title.length}/{TITLE_MAX})
            </span>
            <input
              className="kh-field"
              value={draft.title}
              maxLength={TITLE_MAX}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="adc-field">
            <span className="adc-field__label">
              문구 ({draft.body.length}/{BODY_MAX})
            </span>
            <input
              className="kh-field"
              value={draft.body}
              maxLength={BODY_MAX}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <label className="adc-field">
            <span className="adc-field__label">랜딩 URL(https)</span>
            <input
              className="kh-field"
              type="url"
              value={draft.landingUrl}
              onChange={(e) => setDraft({ ...draft, landingUrl: e.target.value })}
            />
          </label>
          <label className="adc-field">
            <span className="adc-field__label">이미지(PNG·JPEG, 300KB 이하{editing ? ', 비우면 그대로' : ''})</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setDraft({ ...draft, image: e.target.files?.[0] ?? null })}
            />
          </label>
          {error && (
            <p className="adc-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="adc-done" role="status">
              {notice}
            </p>
          )}
          <div className="adc-actions">
            <button className="adc-btn" type="submit" disabled={save.isPending}>
              {editing ? '고친 내용으로 다시 심사' : '심사 요청'}
            </button>
            {editing && (
              <button
                type="button"
                className="adc-btn adc-btn--ghost"
                onClick={() => {
                  setEditing(null);
                  setDraft(EMPTY);
                }}
              >
                취소
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
