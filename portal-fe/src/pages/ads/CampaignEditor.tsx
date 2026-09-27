import { useId, useState, type FormEvent } from 'react';
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
  type CatalogPlacement,
} from '../../api/adsConsoleApi';
import { PLACEMENT_GUIDE, estimateSpend } from './campaignGuide';
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

  const placements = catalog.data?.placements ?? [];
  const hourlyCapPercent = catalog.data?.hourlyCapPercent;
  const bidMicros = creditsToMicros(form.bid);
  const dailyMicros = creditsToMicros(form.dailyBudget);
  const totalMicros = form.totalBudget.trim() ? creditsToMicros(form.totalBudget) : null;
  const estimate =
    hourlyCapPercent != null ? estimateSpend(form.bidType, bidMicros, dailyMicros, totalMicros, hourlyCapPercent) : null;
  // 안내만 한다 — 저장 판정은 서버가 한다. 최저가는 CPM 입찰에만 걸리고, 고른 지면 중 가장 높은 값이 문다
  const floorMicros = Math.max(
    0,
    ...placements.filter((p) => form.placementKeys.includes(p.key)).map((p) => p.floorMicros),
  );
  const belowFloor = form.bidType === 'CPM' && bidMicros != null && floorMicros > 0 && bidMicros < floorMicros;

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

        <form className="adc-form adc-campaign" onSubmit={onSubmit} aria-label="캠페인">
          <div className="adc-campaign__main">
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

              <section className="adc-step" aria-labelledby="adc-step-where">
                <h2 id="adc-step-where" className="adc-step__title">
                  ① 어디에 보일까 — 지면
                </h2>
                <p className="adc-step__lead">
                  지면은 광고 카드가 들어가는 자리입니다. 모두 페이지를 <b>다 읽은 뒤</b> 나오는 자리라 읽기를 방해하지
                  않고, 카드 모양은 같습니다 — 가로 1.91:1 이미지 + 제목 + 설명.
                </p>
                {catalog.isLoading && <p className="adc-status">지면 목록을 불러오는 중…</p>}
                <div className="adc-places">
                  {placements.map((placement) => (
                    <PlacementCard
                      key={placement.key}
                      placement={placement}
                      checked={form.placementKeys.includes(placement.key)}
                      onToggle={() => toggle('placementKeys', placement.key)}
                    />
                  ))}
                </div>

                <fieldset className="adc-fieldset adc-picks">
                  <legend className="adc-field__label">문맥 카테고리 — 고르지 않으면 모든 글·장소·게임에</legend>
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
              </section>

              <section className="adc-step" aria-labelledby="adc-step-bid">
                <h2 id="adc-step-bid" className="adc-step__title">
                  ② 얼마씩 낼까 — 입찰 방식과 입찰가
                </h2>
                <p className="adc-step__lead">
                  무엇에 돈을 낼지 고릅니다. 금액은 모두 크레딧입니다 · <CreditNote />
                </p>
                <div className="adc-bidtypes" role="radiogroup" aria-label="입찰 방식">
                  {BID_TYPES.map((type) => (
                    <label key={type.value} className="adc-bidtype">
                      <input
                        type="radio"
                        name="bidType"
                        value={type.value}
                        checked={form.bidType === type.value}
                        onChange={() => setForm({ ...form, bidType: type.value })}
                      />
                      <span className="adc-bidtype__title">{type.title}</span>
                      <span className="adc-bidtype__body">{type.body}</span>
                      <span className="adc-bidtype__fit">{type.fit}</span>
                    </label>
                  ))}
                </div>

                <div className="adc-bidrow">
                  <MoneyField
                    label="입찰가"
                    value={form.bid}
                    onChange={(bid) => setForm({ ...form, bid })}
                    hint={
                      form.bidType === 'CPM'
                        ? '크레딧 · 가시 노출 1,000회당. 예: 0.5 → 1,000번 보이면 0.5'
                        : '크레딧 · 클릭 1회당. 예: 0.2 → 한 번 누르면 0.2'
                    }
                    warning={
                      belowFloor
                        ? `고른 지면의 최저가(CPM ${formatCredits(floorMicros)})보다 낮아 저장되지 않습니다.`
                        : null
                    }
                  />
                  <div className="adc-explain">
                    <p className="adc-explain__title">경매는 이렇게 이깁니다</p>
                    <ol>
                      <li>방문자가 지면에 오면 그 지면을 고른 광고끼리 그 자리에서 겨룹니다.</li>
                      <li>
                        방식이 달라도 비교되도록 모두 <b>1,000번 보일 때의 값</b>으로 바꿉니다. CPC 는 「입찰가 × 예상
                        클릭률 × 1,000」.
                      </li>
                      <li>
                        값이 가장 큰 광고가 보이고, <b>적어 낸 입찰가 그대로</b> 냅니다(1가 경매). 이긴 뒤 깎아 주지
                        않으니 낼 수 있는 만큼만 적으세요.
                      </li>
                    </ol>
                  </div>
                </div>
              </section>

              <section className="adc-step" aria-labelledby="adc-step-budget">
                <h2 id="adc-step-budget" className="adc-step__title">
                  ③ 얼마까지 쓸까 — 예산
                </h2>
                <p className="adc-step__lead">
                  한도는 네 겹입니다. 안쪽 한도에 먼저 닿으면 그 구간 동안 광고가 쉬고, 다음 구간에 다시 나옵니다.
                </p>
                <dl className="adc-layers">
                  <div className="adc-layers__row">
                    <dt>잔액</dt>
                    <dd>충전해 둔 크레딧. 바닥나면 모든 캠페인이 멈춥니다.</dd>
                  </div>
                  <div className="adc-layers__row">
                    <dt>
                      총예산 <span className="adc-muted">(선택)</span>
                    </dt>
                    <dd>
                      이 캠페인이 <b>기간 전체</b>에 쓸 수 있는 합계. 비우면 잔액이 곧 한도입니다.
                    </dd>
                  </div>
                  <div className="adc-layers__row">
                    <dt>일예산</dt>
                    <dd>하루(한국 시간 0시~24시)에 쓸 수 있는 최대. 다음 날 0시에 다시 채워집니다.</dd>
                  </div>
                  <div className="adc-layers__row">
                    <dt>
                      시간당 <span className="adc-muted">(자동)</span>
                    </dt>
                    <dd>
                      한 시간에 일예산의 <b>{hourlyCapPercent ?? '—'}%</b>까지만 씁니다. 하루치를 오전에 다 쓰지 않고
                      하루에 나눠 보이게 하려는 것이라 따로 적지 않습니다.
                    </dd>
                  </div>
                </dl>
                <div className="adc-grid">
                  <MoneyField
                    label="일예산"
                    value={form.dailyBudget}
                    onChange={(dailyBudget) => setForm({ ...form, dailyBudget })}
                    hint="예: 5 → 하루 최대 5 크레딧"
                  />
                  <MoneyField
                    label="총예산(선택)"
                    value={form.totalBudget}
                    onChange={(totalBudget) => setForm({ ...form, totalBudget })}
                    hint="비우면 잔액까지. 예: 50 → 일예산 5 로 가장 빨리 쓰면 10일"
                  />
                </div>
              </section>

              <section className="adc-step" aria-labelledby="adc-step-when">
                <h2 id="adc-step-when" className="adc-step__title">
                  ④ 언제·몇 번 — 기간과 빈도
                </h2>
                <div className="adc-grid adc-grid--3">
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
                  <label className="adc-field">
                    <span className="adc-field__label">방문자당 하루 노출 상한</span>
                    <input
                      className="kh-field adc-num"
                      inputMode="numeric"
                      value={form.frequencyCap}
                      onChange={(e) => setForm({ ...form, frequencyCap: e.target.value })}
                    />
                  </label>
                </div>
                <p className="adc-hint">
                  시작 시각이 지나고 소재 심사가 끝나야 나옵니다. 끝을 비우면 직접 멈추거나 예산이 닿을 때까지 나옵니다.
                  노출 상한은 같은 방문자에게 하루 몇 번까지 보일지이며 1 이상이어야 합니다.
                </p>
              </section>
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
          </div>

          <aside className="adc-campaign__aside" aria-label="미리보기와 예상">
            <div className="adc-mock" aria-hidden="true">
              <div className="adc-mock__img">소재 이미지 1.91:1</div>
              <div className="adc-mock__body">
                <span className="adc-mock__tag">광고</span>
                <span className="adc-mock__title">소재 제목</span>
                <span className="adc-mock__text">소재 설명 한두 줄</span>
              </div>
            </div>
            <p className="adc-hint">
              {current ? '소재는 아래에서 올리고, 심사를 거쳐야 나옵니다.' : '캠페인을 만든 뒤 소재를 올리고, 심사를 거쳐야 나옵니다.'}
            </p>

            <div className="adc-estimate">
              <p className="adc-explain__title">이 설정이면</p>
              <p className="adc-estimate__lead">
                {estimate
                  ? form.bidType === 'CPM'
                    ? `광고가 1,000번 보일 때마다 ${formatCredits(bidMicros)} 크레딧, 하루에 ${formatCredits(dailyMicros)} 크레딧까지 씁니다.`
                    : `누가 클릭할 때마다 ${formatCredits(bidMicros)} 크레딧, 하루에 ${formatCredits(dailyMicros)} 크레딧까지 씁니다.`
                  : '입찰가와 일예산을 적으면 여기서 계산합니다.'}
              </p>
              <dl className="adc-estimate__rows">
                <div>
                  <dt>{form.bidType === 'CPM' ? '하루 최대 가시 노출' : '하루 최대 클릭'}</dt>
                  <dd>{estimate ? `${estimate.maxPerDay.toLocaleString('ko-KR')}회` : '—'}</dd>
                </div>
                <div>
                  <dt>한 시간 최대 사용</dt>
                  <dd>{estimate ? `${formatCredits(estimate.hourlyCapMicros)} 크레딧` : '—'}</dd>
                </div>
                <div>
                  <dt>총예산을 다 쓰는 데 최소</dt>
                  <dd>{estimate?.minDays != null ? `${estimate.minDays}일` : '—'}</dd>
                </div>
                <div>
                  <dt>고른 지면</dt>
                  <dd>{form.placementKeys.length}곳</dd>
                </div>
              </dl>
              <p className="adc-hint">
                「최대」는 경매에서 매번 이겼을 때의 상한입니다. 실제로는 다른 광고와 나눠 보이고, 지면 요청 수보다 많이
                보일 수 없습니다.
              </p>
            </div>

            {!locked && (
              <button className="adc-btn adc-btn--block" type="submit" disabled={save.isPending}>
                {current ? '저장' : '만들기'}
              </button>
            )}
          </aside>
        </form>
      </section>

      {current && <CreativesPanel campaignId={current.id} readOnly={locked} />}
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  hint,
  warning = null,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  warning?: string | null;
}) {
  const id = useId();
  return (
    <div className="adc-field">
      <label className="adc-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="kh-field adc-num"
        inputMode="decimal"
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={`${id}-hint`} className="adc-hint">
        {hint}
        {warning && <span className="adc-warn"> {warning}</span>}
      </p>
    </div>
  );
}

/** 지면 하나 — 페이지 도식에 광고 자리를 표시하고, 카탈로그의 최저가·요청 수를 붙인다 */
function PlacementCard({
  placement,
  checked,
  onToggle,
}: {
  placement: CatalogPlacement;
  checked: boolean;
  onToggle: () => void;
}) {
  const guide = PLACEMENT_GUIDE[placement.key];
  return (
    <label className={checked ? 'adc-place adc-place--on' : 'adc-place'}>
      {guide && (
        <span className="adc-place__page" aria-hidden="true">
          <span className="adc-place__host">{placement.host}</span>
          {guide.blocks.map((block) => (
            <span
              key={block.label}
              className={
                block.ad ? 'adc-place__block adc-place__block--ad' : block.size === 'lg' ? 'adc-place__block adc-place__block--lg' : 'adc-place__block'
              }
            >
              {block.label}
            </span>
          ))}
        </span>
      )}
      <span className="adc-place__head">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="adc-place__title">{placement.description}</span>
      </span>
      {guide && <span className="adc-place__where">{guide.where}</span>}
      <span className="adc-place__meta">
        <span>하루 평균 요청 {placement.averageDailyRequests.toLocaleString('ko-KR')}</span>
        <span>최저 CPM {formatCredits(placement.floorMicros)}</span>
        <code>{placement.key}</code>
      </span>
    </label>
  );
}

const BID_TYPES: { value: BidType; title: string; body: string; fit: string }[] = [
  {
    value: 'CPM',
    title: 'CPM — 보인 만큼',
    body: '광고가 실제로 보인 1,000번마다 입찰가를 냅니다. 「보였다」는 카드 면적의 절반 이상이 1초 넘게 화면에 있었다는 뜻이라, 스크롤로 스쳐 간 것은 세지 않습니다.',
    fit: '알리는 게 목적일 때',
  },
  {
    value: 'CPC',
    title: 'CPC — 누른 만큼',
    body: '누가 광고를 클릭할 때마다 입찰가를 냅니다. 보이기만 하고 아무도 누르지 않으면 0 이고, 한 번 보인 광고를 여러 번 눌러도 한 번만 셉니다.',
    fit: '내 사이트로 데려오는 게 목적일 때',
  },
];
