import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adsErrorMessage,
  changeCampaignStatus,
  createCampaign,
  creditsToMicros,
  fetchCampaign,
  fetchCatalog,
  formatCredits,
  microsToCreditsInput,
  updateCampaign,
  type BidType,
  type Campaign,
  type CampaignAction,
  type CampaignInput,
} from '../../api/adsConsoleApi';
import CreativesPanel from './CreativesPanel';
import { CreditNote, StatePill } from './consoleParts';
import { campaignState, consoleHref } from './consoleView';

interface FormState {
  name: string;
  bidType: BidType;
  bid: string;
  dailyBudget: string;
  totalBudget: string;
  startAt: string;
  endAt: string;
  frequencyCap: string;
  placementKeys: string[];
  categoryCodes: string[];
}

const DEFAULT_FREQUENCY_CAP = '3';

function emptyForm(): FormState {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return {
    name: '',
    bidType: 'CPM',
    bid: '',
    dailyBudget: '',
    totalBudget: '',
    startAt: toLocalInput(now.toISOString()),
    endAt: '',
    frequencyCap: DEFAULT_FREQUENCY_CAP,
    placementKeys: [],
    categoryCodes: [],
  };
}

/** 서버의 LocalDateTime(`2026-09-24T10:00:00`) ↔ `datetime-local` 입력값(`2026-09-24T10:00`) */
function toLocalInput(value: string): string {
  if (value.endsWith('Z')) {
    // 새 캠페인 기본값 — 브라우저 시계가 아니라 KST 로 맞춘다(서버의 「하루」가 KST 다)
    const kst = new Date(new Date(value).getTime() + 9 * 3_600_000);
    return kst.toISOString().slice(0, 16);
  }
  return value.slice(0, 16);
}

function fromCampaign(campaign: Campaign): FormState {
  return {
    name: campaign.name,
    bidType: campaign.bidType ?? 'CPM',
    bid: microsToCreditsInput(campaign.bidMicros),
    dailyBudget: microsToCreditsInput(campaign.dailyBudgetMicros),
    totalBudget: microsToCreditsInput(campaign.totalBudgetMicros),
    startAt: toLocalInput(campaign.startAt),
    endAt: campaign.endAt ? toLocalInput(campaign.endAt) : '',
    frequencyCap: campaign.frequencyCapPerDay != null ? String(campaign.frequencyCapPerDay) : DEFAULT_FREQUENCY_CAP,
    placementKeys: campaign.placementKeys,
    categoryCodes: campaign.categoryCodes,
  };
}

/**
 * 입력을 요청 모양으로 바꾼다. 여기서는 **읽을 수 있는지**만 본다 — 최저가·예산·지면 허용 같은
 * 저장 불변식은 서버가 판정하고, 거절 문구를 그대로 보여 준다(규칙을 화면에 사본으로 두지 않는다).
 */
function toInput(form: FormState): CampaignInput | string {
  const bidMicros = creditsToMicros(form.bid);
  const dailyBudgetMicros = creditsToMicros(form.dailyBudget);
  const totalBudgetMicros = form.totalBudget.trim() ? creditsToMicros(form.totalBudget) : null;
  if (!form.name.trim()) return '캠페인 이름을 적어 주세요.';
  if (bidMicros == null) return '입찰가를 크레딧 숫자로 적어 주세요.';
  if (dailyBudgetMicros == null) return '일예산을 크레딧 숫자로 적어 주세요.';
  if (form.totalBudget.trim() && totalBudgetMicros == null) return '총예산을 크레딧 숫자로 적어 주세요.';
  if (!form.startAt) return '시작 시각을 골라 주세요.';
  if (form.placementKeys.length === 0) return '지면을 하나 이상 골라 주세요.';
  const cap = form.frequencyCap.trim() ? Number(form.frequencyCap) : null;
  if (cap != null && !Number.isInteger(cap)) return '빈도 제한은 정수로 적어 주세요.';
  return {
    name: form.name.trim(),
    bidType: form.bidType,
    bidMicros,
    dailyBudgetMicros,
    totalBudgetMicros,
    startAt: `${form.startAt}:00`,
    endAt: form.endAt ? `${form.endAt}:00` : null,
    frequencyCapPerDay: cap,
    placementKeys: form.placementKeys,
    categoryCodes: form.categoryCodes,
  };
}

const ACTIONS: Record<Campaign['status'], { action: CampaignAction; label: string }[]> = {
  DRAFT: [{ action: 'START', label: '시작' }],
  ACTIVE: [
    { action: 'PAUSE', label: '일시정지' },
    { action: 'END', label: '종료' },
  ],
  PAUSED: [
    { action: 'RESUME', label: '재개' },
    { action: 'END', label: '종료' },
  ],
  ENDED: [],
};

/** 캠페인 만들기·고치기 + 상태 전이 + (기존 캠페인이면) 소재. 지면·카테고리는 카탈로그에서 고른다. */
export default function CampaignEditor({ readOnly, existing = false }: { readOnly: boolean; existing?: boolean }) {
  const params = useParams();
  const campaignId = existing ? Number(params.id) : null;
  const campaign = useQuery({
    queryKey: ['ads', 'campaign', campaignId],
    queryFn: () => fetchCampaign(campaignId as number),
    enabled: campaignId != null && Number.isFinite(campaignId),
  });

  if (existing && campaign.isLoading) return <p className="adc-status">불러오는 중…</p>;
  if (existing && (campaign.isError || !campaign.data)) {
    return (
      <p className="adc-status adc-status--error" role="alert">
        캠페인을 찾을 수 없습니다.
      </p>
    );
  }
  // 폼의 초기값은 불러온 캠페인에서 한 번만 읽는다 — 캠페인이 바뀌면 key 로 새로 만든다
  return <CampaignEditorBody key={campaignId ?? 'new'} current={campaign.data ?? null} readOnly={readOnly} />;
}

function CampaignEditorBody({ current, readOnly }: { current: Campaign | null; readOnly: boolean }) {
  const campaignId = current?.id ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ['ads', 'catalog'], queryFn: fetchCatalog, staleTime: 5 * 60 * 1000 });

  const [form, setForm] = useState<FormState>(() => (current ? fromCampaign(current) : emptyForm()));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ads', 'campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['ads', 'campaign', campaignId] });
  };

  const save = useMutation({
    mutationFn: (input: CampaignInput) => (campaignId != null ? updateCampaign(campaignId, input) : createCampaign(input)),
    onSuccess: (saved) => {
      setError(null);
      setNotice('저장했습니다.');
      invalidate();
      if (campaignId == null) navigate(consoleHref(`/campaigns/${saved.id}`));
    },
    onError: (err) => {
      setNotice(null);
      setError(adsErrorMessage(err, '캠페인을 저장하지 못했습니다.'));
    },
  });

  const transition = useMutation({
    mutationFn: (action: CampaignAction) => changeCampaignStatus(campaignId as number, action),
    onSuccess: () => {
      setError(null);
      setNotice('상태를 바꿨습니다.');
      invalidate();
    },
    onError: (err) => {
      setNotice(null);
      setError(adsErrorMessage(err, '상태를 바꾸지 못했습니다.'));
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = toInput(form);
    if (typeof input === 'string') {
      setNotice(null);
      setError(input);
      return;
    }
    save.mutate(input);
  };

  const onAction = (action: CampaignAction) => {
    if (action === 'END' && !window.confirm('종료한 캠페인은 되돌릴 수 없습니다. 종료할까요?')) return;
    transition.mutate(action);
  };

  const toggle = (field: 'placementKeys' | 'categoryCodes', value: string) =>
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));

  const ended = current?.status === 'ENDED';
  const locked = readOnly || ended;
  const state = current ? campaignState(current, null) : null;

  return (
    <div className="adc-stack">
      <section className="adc-section">
        <div className="adc-section__head">
          <h1>{current ? current.name : '새 캠페인'}</h1>
          {state && <StatePill tone={state.tone} label={state.label} />}
          <Link className="adc-link adc-section__aside" to={consoleHref('')}>
            대시보드로
          </Link>
        </div>

        {current && !readOnly && ACTIONS[current.status].length > 0 && (
          <div className="adc-actions">
            {ACTIONS[current.status].map(({ action, label }) => (
              <button
                key={action}
                type="button"
                className={action === 'END' ? 'adc-btn adc-btn--ghost' : 'adc-btn'}
                disabled={transition.isPending}
                onClick={() => onAction(action)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <form className="adc-form" onSubmit={onSubmit} aria-label="캠페인">
          <fieldset className="adc-fieldset" disabled={locked}>
            <label className="adc-field">
              <span className="adc-field__label">캠페인 이름</span>
              <input
                className="kh-field"
                value={form.name}
                maxLength={100}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <div className="adc-field" role="radiogroup" aria-label="입찰 방식">
              <span className="adc-field__label">입찰 방식</span>
              <div className="adc-choice-row">
                {(['CPM', 'CPC'] as BidType[]).map((type) => (
                  <label key={type} className="adc-choice">
                    <input
                      type="radio"
                      name="bidType"
                      value={type}
                      checked={form.bidType === type}
                      onChange={() => setForm({ ...form, bidType: type })}
                    />
                    <span>{type === 'CPM' ? 'CPM · 가시 노출 1,000회당' : 'CPC · 클릭 1회당'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="adc-grid">
              <MoneyField label="입찰가" value={form.bid} onChange={(bid) => setForm({ ...form, bid })} />
              <MoneyField
                label="일예산"
                value={form.dailyBudget}
                onChange={(dailyBudget) => setForm({ ...form, dailyBudget })}
              />
              <MoneyField
                label="총예산(선택)"
                value={form.totalBudget}
                onChange={(totalBudget) => setForm({ ...form, totalBudget })}
              />
              <label className="adc-field">
                <span className="adc-field__label">방문자당 하루 노출 상한</span>
                <input
                  className="kh-field adc-num"
                  inputMode="numeric"
                  value={form.frequencyCap}
                  onChange={(e) => setForm({ ...form, frequencyCap: e.target.value })}
                />
              </label>
              <label className="adc-field">
                <span className="adc-field__label">시작(KST)</span>
                <input
                  className="kh-field"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </label>
              <label className="adc-field">
                <span className="adc-field__label">끝(KST, 선택)</span>
                <input
                  className="kh-field"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </label>
            </div>
            <p className="adc-hint">
              금액 단위 크레딧 · <CreditNote />
            </p>

            <fieldset className="adc-fieldset adc-picks">
              <legend className="adc-field__label">지면</legend>
              {catalog.isLoading && <p className="adc-status">지면 목록을 불러오는 중…</p>}
              {(catalog.data?.placements ?? []).map((placement) => (
                <label key={placement.key} className="adc-pick">
                  <input
                    type="checkbox"
                    checked={form.placementKeys.includes(placement.key)}
                    onChange={() => toggle('placementKeys', placement.key)}
                  />
                  <span className="adc-pick__body">
                    <span className="adc-pick__title">{placement.description}</span>
                    <span className="adc-pick__meta">
                      <code>{placement.key}</code> · {placement.host} · 비율 {placement.aspectRatios.join(', ')} · 최저
                      CPM {formatCredits(placement.floorMicros)} · 하루 평균 요청{' '}
                      {placement.averageDailyRequests.toLocaleString('ko-KR')}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="adc-fieldset adc-picks">
              <legend className="adc-field__label">문맥 카테고리(고르지 않으면 전체)</legend>
              <div className="adc-choice-row">
                {(catalog.data?.categories ?? []).map((category) => (
                  <label key={category.code} className="adc-choice">
                    <input
                      type="checkbox"
                      checked={form.categoryCodes.includes(category.code)}
                      onChange={() => toggle('categoryCodes', category.code)}
                    />
                    <span>{category.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </fieldset>

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
          {!locked && (
            <button className="adc-btn" type="submit" disabled={save.isPending}>
              {current ? '저장' : '만들기'}
            </button>
          )}
        </form>
      </section>

      {current && <CreativesPanel campaignId={current.id} readOnly={locked} />}
    </div>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="adc-field">
      <span className="adc-field__label">{label}</span>
      <input className="kh-field adc-num" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
