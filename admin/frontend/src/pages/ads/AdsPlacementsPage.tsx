import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  addPlacementFormat,
  adsErrorMessage,
  createPlacement,
  creditsToMicros,
  formatCredits,
  listPlacements,
  listUnregisteredPlacements,
  placementSpecs,
  removePlacementFormat,
  updatePlacement,
  updatePlacementFormatFloor,
  type AdPlacement,
  type PlacementFormat,
  type UnregisteredPlacement,
} from '@/api/ads';

const FORMATS: PlacementFormat[] = ['CARD', 'BANNER'];
const FORMAT_LABEL: Record<PlacementFormat, string> = { CARD: '카드', BANNER: '띠배너' };
const DEFAULT_RATIO: Record<PlacementFormat, string> = { CARD: '1.91:1', BANNER: '6.4:1' };

interface SpecDraft {
  format: PlacementFormat;
  aspectRatios: string;
  floor: string;
}

const EMPTY_FORM = {
  key: '',
  host: '',
  format: 'CARD' as PlacementFormat,
  aspectRatios: '1.91:1',
  floor: '',
  description: '',
  paidAllowed: true,
};

/**
 * 지면 등록부 (ADR-0098) — 지면의 단일 원본. 최저가는 CPM(가시 노출 1,000회당) 크레딧이다.
 * 지면은 광고 형태(카드·띠배너)마다 규격(허용 비율 + 최저가)을 하나씩 갖고, 최소 하나는 남아야 한다.
 * 아래 「미등록 지면」은 등록부에 없는 키로 들어온 요청 — FE 오타나 등록을 빠뜨린 지면을 찾는 곳이다.
 */
export function AdsPlacementsPage() {
  const [items, setItems] = useState<AdPlacement[] | null>(null);
  const [unregistered, setUnregistered] = useState<UnregisteredPlacement[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // 새 최저가 입력 — 키는 `지면키:형태`
  const [floors, setFloors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<Record<string, SpecDraft | undefined>>({});

  const reload = useCallback(async () => {
    const [placements, unknown] = await Promise.all([listPlacements(), listUnregisteredPlacements()]);
    setItems(placements);
    setUnregistered(unknown);
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<unknown>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch (err) {
      setMessage(adsErrorMessage(err, '실패했습니다'));
    }
  };

  const onCreate = () => {
    const floorMicros = creditsToMicros(form.floor);
    if (floorMicros == null) {
      setMessage('최저가를 크레딧 숫자로 적어 주세요');
      return;
    }
    run(
      () =>
        createPlacement({
          key: form.key.trim(),
          host: form.host.trim(),
          format: form.format,
          aspectRatios: form.aspectRatios.split(',').map((r) => r.trim()).filter(Boolean),
          floorMicros,
          active: true,
          paidAllowed: form.paidAllowed,
          description: form.description.trim(),
        }).then(() => setForm(EMPTY_FORM)),
      '등록했습니다',
    );
  };

  const onFloor = (key: string, format: PlacementFormat) => {
    const floorMicros = creditsToMicros(floors[`${key}:${format}`] ?? '');
    if (floorMicros == null) {
      setMessage('최저가를 크레딧 숫자로 적어 주세요');
      return;
    }
    run(() => updatePlacementFormatFloor(key, format, floorMicros), '최저가를 바꿨습니다');
  };

  const onRemoveSpec = (key: string, format: PlacementFormat) => {
    const ok = window.confirm(
      `${key} 에서 ${FORMAT_LABEL[format]} 규격을 뺍니다. 그 형태의 유료 캠페인은 이 지면 결정에서 빠지고 시작·재개도 거절됩니다. 뺄까요?`,
    );
    if (!ok) return;
    run(() => removePlacementFormat(key, format), '형태를 뺐습니다');
  };

  const onAddSpec = (key: string, draft: SpecDraft) => {
    const floorMicros = creditsToMicros(draft.floor);
    if (floorMicros == null) {
      setMessage('최저가를 크레딧 숫자로 적어 주세요');
      return;
    }
    run(
      () =>
        addPlacementFormat(key, {
          format: draft.format,
          aspectRatios: draft.aspectRatios.split(',').map((r) => r.trim()).filter(Boolean),
          floorMicros,
        }).then(() => setAdding((prev) => ({ ...prev, [key]: undefined }))),
      '형태를 더했습니다',
    );
  };

  if (!items) return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">광고 지면</h1>
          <p className="text-sm text-zinc-500">
            바뀐 값은 1분 안에 결정에 반영됩니다. 최저가가 오르면 그보다 낮게 입찰한 그 형태의 캠페인은 그 지면에서
            빠집니다. 형태를 빼면 그 형태의 유료 캠페인이 그 지면 결정에서 빠지고 시작·재개도 거절됩니다(타기팅은
            남습니다).
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">키</th>
              <th className="p-3 text-left">호스트</th>
              <th className="p-3 text-left">설명</th>
              <th className="p-3 text-left">형태 규격 · 최저 CPM</th>
              <th className="p-3 text-left">활성</th>
              <th className="p-3 text-left">유료 허용</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.key} className="border-t border-zinc-800">
                <td className="p-3 font-mono text-xs">{p.key}</td>
                <td className="p-3 font-mono text-xs">{p.host}</td>
                <td className="p-3">{p.description}</td>
                <td className="p-3">
                  <SpecCell
                    placement={p}
                    floors={floors}
                    onFloorInput={(format, value) => setFloors((prev) => ({ ...prev, [`${p.key}:${format}`]: value }))}
                    onFloor={(format) => onFloor(p.key, format)}
                    onRemove={(format) => onRemoveSpec(p.key, format)}
                    draft={adding[p.key]}
                    onDraft={(draft) => setAdding((prev) => ({ ...prev, [p.key]: draft }))}
                    onAdd={(draft) => onAddSpec(p.key, draft)}
                  />
                </td>
                <td className="p-3 align-top">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => updatePlacement(p.key, { active: !p.active }), '바꿨습니다')}
                  >
                    {p.active ? '활성' : '비활성'}
                  </Button>
                </td>
                <td className="p-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => updatePlacement(p.key, { paidAllowed: !p.paidAllowed }), '바꿨습니다')}
                  >
                    {p.paidAllowed ? '유료 허용' : 'HOUSE 전용'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">지면 등록</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="키 (kebab-case)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          <Input placeholder="호스트 (blog.1989v.com)" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          <Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as PlacementFormat })}>
            <option value="CARD">CARD</option>
            <option value="BANNER">BANNER</option>
          </Select>
          <Input
            placeholder="허용 비율 (쉼표로, 1.91:1)"
            value={form.aspectRatios}
            onChange={(e) => setForm({ ...form, aspectRatios: e.target.value })}
          />
          <Input
            placeholder="최저 CPM 크레딧"
            inputMode="decimal"
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
          />
          <Input placeholder="설명" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.paidAllowed}
            onChange={(e) => setForm({ ...form, paidAllowed: e.target.checked })}
          />
          유료 광고 허용 (끄면 HOUSE 전용)
        </label>
        <Button size="sm" onClick={onCreate}>
          등록
        </Button>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="p-3 text-sm font-semibold">미등록 지면 (닫힌 시각까지)</div>
        {unregistered.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-zinc-500">없습니다.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="p-3 text-left">키</th>
                <th className="p-3 text-right">요청</th>
                <th className="p-3 text-left">처음</th>
                <th className="p-3 text-left">마지막</th>
              </tr>
            </thead>
            <tbody>
              {unregistered.map((u) => (
                <tr key={u.placementKey} className="border-t border-zinc-800">
                  <td className="p-3 font-mono text-xs">{u.placementKey}</td>
                  <td className="p-3 text-right">{u.requests.toLocaleString('ko-KR')}</td>
                  <td className="p-3 text-xs">{u.firstSeenAt}</td>
                  <td className="p-3 text-xs">{u.lastSeenAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/** 한 지면의 형태 규격 표 — 형태마다 비율·최저가·최저가 변경·빼기, 아직 없는 형태는 더하기 */
function SpecCell({
  placement,
  floors,
  onFloorInput,
  onFloor,
  onRemove,
  draft,
  onDraft,
  onAdd,
}: {
  placement: AdPlacement;
  floors: Record<string, string>;
  onFloorInput: (format: PlacementFormat, value: string) => void;
  onFloor: (format: PlacementFormat) => void;
  onRemove: (format: PlacementFormat) => void;
  draft: SpecDraft | undefined;
  onDraft: (draft: SpecDraft) => void;
  onAdd: (draft: SpecDraft) => void;
}) {
  const specs = placementSpecs(placement);
  const missing = FORMATS.filter((f) => !specs.some((s) => s.format === f));
  const last = specs.length === 1;
  const next: SpecDraft = draft ?? {
    format: missing[0] ?? 'CARD',
    aspectRatios: DEFAULT_RATIO[missing[0] ?? 'CARD'],
    floor: '',
  };
  return (
    <div className="space-y-2" data-testid={`specs-${placement.key}`}>
      <ul className="space-y-1">
        {specs.map((spec) => (
          <li key={spec.format} className="flex flex-wrap items-center gap-2" data-format={spec.format}>
            <span className="w-14 text-xs font-semibold">{FORMAT_LABEL[spec.format]}</span>
            <span className="w-16 font-mono text-xs text-zinc-500">{spec.aspectRatios.join(', ')}</span>
            <span className="w-16 font-mono text-xs">{formatCredits(spec.floorMicros)}</span>
            <Input
              aria-label={`${placement.key} ${FORMAT_LABEL[spec.format]} 새 최저가`}
              className="h-8 w-24 text-xs"
              inputMode="decimal"
              value={floors[`${placement.key}:${spec.format}`] ?? ''}
              onChange={(e) => onFloorInput(spec.format, e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => onFloor(spec.format)}>
              변경
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={last}
              title={last ? '마지막 형태는 뺄 수 없습니다' : undefined}
              aria-label={`${placement.key} ${FORMAT_LABEL[spec.format]} 빼기`}
              onClick={() => onRemove(spec.format)}
            >
              빼기
            </Button>
          </li>
        ))}
      </ul>
      {last && <p className="text-xs text-zinc-500">마지막 형태는 뺄 수 없습니다 — 다른 형태를 먼저 더하세요.</p>}
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`${placement.key} 더할 형태`}
            className="h-8 text-xs"
            value={next.format}
            onChange={(e) => {
              const format = e.target.value as PlacementFormat;
              onDraft({ ...next, format, aspectRatios: DEFAULT_RATIO[format] });
            }}
          >
            {missing.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </Select>
          <Input
            aria-label={`${placement.key} 더할 형태 비율`}
            className="h-8 w-20 text-xs"
            value={next.aspectRatios}
            onChange={(e) => onDraft({ ...next, aspectRatios: e.target.value })}
          />
          <Input
            aria-label={`${placement.key} 더할 형태 최저가`}
            className="h-8 w-24 text-xs"
            inputMode="decimal"
            placeholder="최저 CPM"
            value={next.floor}
            onChange={(e) => onDraft({ ...next, floor: e.target.value })}
          />
          <Button size="sm" variant="outline" onClick={() => onAdd(next)}>
            형태 추가
          </Button>
        </div>
      )}
    </div>
  );
}
