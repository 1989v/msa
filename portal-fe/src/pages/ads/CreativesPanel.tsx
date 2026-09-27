import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  REJECT_REASON_LABEL,
  adsErrorMessage,
  archiveCreative,
  fetchCatalog,
  fetchCreatives,
  reviseCreative,
  specFor,
  submitCreative,
  type AdFormat,
  type Creative,
} from '../../api/adsConsoleApi';
import { PreviewImage, StatePill } from './consoleParts';
import { CREATIVE_STATE } from './consoleView';
import { fileTypeLabels, inspectUpload, type UploadInspection } from './imageHeader';

const TITLE_MAX = 40;
const BODY_MAX = 90;

/** 제작 권장 크기 — 규칙이 아니라 안내다(허용 판정은 비율·한도가 한다) */
const RECOMMENDED: Record<AdFormat, string> = { CARD: '1200×628', BANNER: '1280×200' };

interface DraftState {
  title: string;
  body: string;
  landingUrl: string;
  image: File | null;
}

const EMPTY: DraftState = { title: '', body: '', landingUrl: 'https://', image: null };

const hasFiles = (e: { dataTransfer: DataTransfer | null }) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * 캠페인의 소재 — 올리기·고치기(다시 심사 대기)·보관, 심사 상태와 반려 사유.
 * 광고주가 적은 문구는 텍스트로만 그린다. 띠배너는 제목·설명 대신 대체 텍스트 하나를 쓴다.
 *
 * 이미지는 끌어다 놓거나 골라 올린다. 보내기 전에 형식·용량·헤더 크기·비율을 보고, 하나라도 어기면 보내지 않는다.
 * 한도는 카탈로그의 업로드 규칙이 원본이다 — 규칙을 못 받았으면 사전 검사 없이 서버가 판정한다.
 */
export default function CreativesPanel({
  campaignId,
  readOnly,
  format,
  placementKeys,
}: {
  campaignId: number;
  readOnly: boolean;
  format: AdFormat;
  placementKeys: string[];
}) {
  const queryClient = useQueryClient();
  const creatives = useQuery({ queryKey: ['ads', 'creatives', campaignId], queryFn: () => fetchCreatives(campaignId) });
  const catalog = useQuery({ queryKey: ['ads', 'catalog'], queryFn: fetchCatalog, staleTime: 5 * 60 * 1000 });
  const [editing, setEditing] = useState<Creative | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inspection, setInspection] = useState<UploadInspection | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const banner = format === 'BANNER';
  const rules = catalog.data?.uploadRules;
  const specs = (catalog.data?.placements ?? []).map((p) => ({ key: p.key, spec: specFor(p, format) }));
  // 타기팅한 지면마다 이 형태 규격의 비율 — 고른 지면이 없으면 이 형태를 받는 모든 지면 중 하나에 맞으면 된다
  const targeted = specs.filter((s) => s.spec && placementKeys.includes(s.key)).map((s) => s.spec!.aspectRatios);
  const anyRatio = specs.flatMap((s) => s.spec?.aspectRatios ?? []);
  const ratioGroups = targeted.length > 0 ? targeted : anyRatio.length > 0 ? [anyRatio] : [];
  const ratioLabel = [...new Set(ratioGroups.flat())].join(' 또는 ');
  const ratioKey = JSON.stringify(ratioGroups);
  const image = draft.image;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ads', 'creatives', campaignId] });

  // 고른 파일을 검사한다. 카탈로그가 파일보다 늦게 와도 규칙이 오면 그때 검사한다.
  // 파일을 빨리 바꾸면 늦게 끝난 앞 파일의 결과는 버린다
  useEffect(() => {
    if (!image || !rules) return undefined;
    let live = true;
    inspectUpload(image, rules, JSON.parse(ratioKey) as string[][])
      .catch((): UploadInspection => ({
        ok: false,
        checks: [{ key: 'format', label: `형식 — ${fileTypeLabels(rules.fileTypes)}`, actual: '읽지 못함', ok: false }],
      }))
      .then((result) => {
        if (!live) return;
        setInspection(result);
        // 미리보기는 모든 검사를 통과한 파일만 푼다
        if (result.ok && typeof URL.createObjectURL === 'function') setPreviewUrl(URL.createObjectURL(image));
      });
    return () => {
      live = false;
    };
  }, [image, rules, ratioKey]);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // 영역 밖에 놓아도 브라우저가 파일을 열며 편집 화면을 떠나지 않게 한다 — 파일 끌기만 막고 글자 끌기는 둔다
  useEffect(() => {
    if (readOnly) return undefined;
    const block = (e: globalThis.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, [readOnly]);

  const clearImage = () => {
    setDraft((prev) => ({ ...prev, image: null }));
    setInspection(null);
    setPreviewUrl(null);
    setDropNotice(null);
    setInputKey((k) => k + 1);
  };

  const pickFile = (file: File) => {
    setDraft((prev) => ({ ...prev, image: file }));
    setInspection(null);
    setPreviewUrl(null);
    setError(null);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    pickFile(files[0]);
    setDropNotice(files.length > 1 ? `파일을 ${files.length}개 놓아 첫 파일(${files[0].name})만 씁니다.` : null);
  };

  const save = useMutation({
    mutationFn: (input: DraftState) => (editing ? reviseCreative(editing.id, input) : submitCreative(campaignId, input)),
    onSuccess: () => {
      setError(null);
      setNotice(editing ? '고쳤습니다. 다시 심사를 기다립니다.' : '올렸습니다. 심사를 기다립니다.');
      setEditing(null);
      setDraft(EMPTY);
      clearImage();
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
    if (!draft.title.trim() || (!banner && !draft.body.trim())) {
      setError(banner ? '대체 텍스트를 적어 주세요.' : '제목과 문구를 적어 주세요.');
      return;
    }
    if (!editing && !draft.image) {
      setError('이미지를 골라 주세요.');
      return;
    }
    if (draft.image && rules) {
      if (!inspection) {
        setError('이미지를 확인하는 중입니다. 잠시 뒤에 다시 눌러 주세요.');
        return;
      }
      if (!inspection.ok) {
        setError('이미지가 검사를 통과하지 못해 보내지 않았습니다.');
        return;
      }
    }
    // 띠배너는 설명이 없다 — 대체 텍스트는 제목 칸으로 간다
    save.mutate(banner ? { ...draft, body: '' } : draft);
  };

  const startEdit = (creative: Creative) => {
    setEditing(creative);
    setDraft({ title: creative.title, body: creative.body, landingUrl: creative.landingUrl, image: null });
    clearImage();
    setError(null);
    setNotice(null);
  };

  const list = (creatives.data ?? []).filter((c) => c.status !== 'ARCHIVED');
  const previewShape = banner ? 'adc-preview adc-preview--banner' : 'adc-preview';

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
                <PreviewImage url={creative.imageUrl} alt={creative.title} className={previewShape} />
              ) : (
                <span className={`${previewShape} adc-preview--empty`} aria-hidden="true" />
              )}
              <div className="adc-creative__body">
                <div className="adc-creative__head">
                  <StatePill tone={state.tone} label={state.label} />
                </div>
                {banner ? (
                  <p className="adc-creative-title">
                    <span className="adc-creative__label">대체 텍스트</span> {creative.title}
                  </p>
                ) : (
                  <>
                    <p className="adc-creative-title">{creative.title}</p>
                    <p className="adc-creative__copy">{creative.body}</p>
                  </>
                )}
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
          <h3 className="adc-subhead">
            {editing ? '소재 고치기' : '소재 올리기'} — {banner ? '띠배너' : '카드'}
          </h3>

          <div
            className={dragOver ? 'adc-drop adc-drop--over' : 'adc-drop'}
            data-testid="creative-drop"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {!draft.image ? (
              <>
                <span className="adc-drop__title">
                  {dragOver ? '여기에 놓으면 올라갑니다' : '이미지를 여기로 끌어다 놓으세요'}
                  {editing && <span className="adc-muted"> (비우면 지금 이미지 그대로)</span>}
                </span>
                {rules && (
                  <span className="adc-drop__rule">
                    {fileTypeLabels(rules.fileTypes)} · {Math.floor(rules.maxBytes / 1024)}KB 이하 · 가로·세로{' '}
                    {rules.maxDimension.toLocaleString('ko-KR')}px 이하
                  </span>
                )}
                <span className="adc-drop__rule">
                  비율 {ratioLabel || '—'} · 권장 <span className="adc-mono">{RECOMMENDED[format]}</span>
                  {banner && ' · 모바일에서는 높이 약 56px — 글자를 크게'}
                </span>
              </>
            ) : (
              <div className="adc-upload">
                {previewUrl && (
                  <img
                    className={banner ? 'adc-upload__preview adc-upload__preview--banner' : 'adc-upload__preview'}
                    src={previewUrl}
                    alt=""
                  />
                )}
                <div className="adc-upload__file">
                  <span className="adc-mono">{draft.image.name}</span>
                  <button type="button" className="adc-link adc-upload__cancel" onClick={clearImage}>
                    파일 취소
                  </button>
                </div>
                {!rules && <p className="adc-hint">사전 검사 규칙을 받지 못해 서버가 판정합니다.</p>}
                {rules && !inspection && <p className="adc-hint">이미지를 확인하는 중…</p>}
                {inspection && (
                  <ul className="adc-checks" aria-label="이미지 검사">
                    {inspection.checks.map((check) => (
                      <li key={check.key} className={check.ok ? 'adc-check' : 'adc-check adc-check--bad'} data-check={check.key}>
                        <span className="adc-check__mark" aria-hidden="true">
                          {check.ok ? '✓' : '✕'}
                        </span>
                        <span>
                          {check.label}
                          <span className="adc-sr">{check.ok ? ' 통과' : ' 실패'}</span>
                        </span>
                        <span className="adc-check__value adc-mono">{check.actual}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {inspection && !inspection.ok && (
                  <p className="adc-error" role="alert">
                    이 파일은 올릴 수 없습니다 — 서버에 보내기 전에 여기서 막습니다. 권장 크기{' '}
                    <span className="adc-mono">{RECOMMENDED[format]}</span>
                    {banner && ' (모바일에서는 높이 약 56px — 글자를 크게)'}.
                  </p>
                )}
              </div>
            )}
            <label className="adc-btn adc-btn--ghost adc-drop__pick">
              {draft.image ? '다른 파일로' : '파일 고르기'}
              <input
                key={inputKey}
                className="adc-sr"
                type="file"
                accept="image/png,image/jpeg"
                aria-label="이미지 파일"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setDropNotice(null);
                    pickFile(file);
                  }
                }}
              />
            </label>
          </div>
          {dropNotice && (
            <p className="adc-hint" role="status">
              {dropNotice}
            </p>
          )}

          <label className="adc-field">
            <span className="adc-field__label">
              {banner ? '대체 텍스트' : '제목'} ({draft.title.length}/{TITLE_MAX})
            </span>
            <input
              className="kh-field"
              value={draft.title}
              maxLength={TITLE_MAX}
              placeholder={banner ? '이미지를 못 보는 사람에게 읽어 줄 문구' : undefined}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          {!banner && (
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
          )}
          <label className="adc-field">
            <span className="adc-field__label">랜딩 URL(https)</span>
            <input
              className="kh-field"
              type="url"
              value={draft.landingUrl}
              onChange={(e) => setDraft({ ...draft, landingUrl: e.target.value })}
            />
          </label>
          <p className="adc-hint">
            {banner
              ? '띠배너는 제목·설명 칸이 없습니다. 글자는 이미지 안에 넣고, 대체 텍스트는 화면에 보이지 않고 화면 낭독기와 심사에 쓰입니다.'
              : '카드는 제목과 설명이 이미지 아래에 글자로 붙습니다.'}
          </p>
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
                  clearImage();
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
