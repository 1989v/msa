import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  adsErrorMessage,
  createPlacement,
  creditsToMicros,
  formatCredits,
  listPlacements,
  listUnregisteredPlacements,
  updatePlacement,
  type AdPlacement,
  type PlacementFormat,
  type UnregisteredPlacement,
} from '@/api/ads';

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
 * 아래 「미등록 지면」은 등록부에 없는 키로 들어온 요청 — FE 오타나 등록을 빠뜨린 지면을 찾는 곳이다.
 */
export function AdsPlacementsPage() {
  const [items, setItems] = useState<AdPlacement[] | null>(null);
  const [unregistered, setUnregistered] = useState<UnregisteredPlacement[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [floors, setFloors] = useState<Record<string, string>>({});

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

  const onFloor = (key: string) => {
    const floorMicros = creditsToMicros(floors[key] ?? '');
    if (floorMicros == null) {
      setMessage('최저가를 크레딧 숫자로 적어 주세요');
      return;
    }
    run(() => updatePlacement(key, { floorMicros }), '최저가를 바꿨습니다');
  };

  if (!items) return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">광고 지면</h1>
          <p className="text-sm text-zinc-500">
            바뀐 값은 1분 안에 결정에 반영됩니다. 최저가가 오르면 그보다 낮게 입찰한 캠페인은 그 지면에서 빠집니다.
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
              <th className="p-3 text-left">형식</th>
              <th className="p-3 text-left">설명</th>
              <th className="p-3 text-right">최저 CPM</th>
              <th className="p-3 text-left">활성</th>
              <th className="p-3 text-left">유료 허용</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.key} className="border-t border-zinc-800">
                <td className="p-3 font-mono text-xs">{p.key}</td>
                <td className="p-3 font-mono text-xs">{p.host}</td>
                <td className="p-3 text-xs">
                  {p.format} · {p.aspectRatios.join(', ')}
                </td>
                <td className="p-3">{p.description}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono text-xs">{formatCredits(p.floorMicros)}</span>
                    <Input
                      aria-label={`${p.key} 새 최저가`}
                      className="h-8 w-24 text-xs"
                      inputMode="decimal"
                      value={floors[p.key] ?? ''}
                      onChange={(e) => setFloors((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    />
                    <Button size="sm" variant="outline" onClick={() => onFloor(p.key)}>
                      변경
                    </Button>
                  </div>
                </td>
                <td className="p-3">
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
