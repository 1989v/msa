import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  deleteDisplayService,
  listDisplayServices,
  upsertDisplayService,
  type DisplayService,
  type DisplayStatus,
} from '@/api/displayServices';

const STATUS_LABEL: Record<DisplayStatus, string> = {
  OPEN: '전시 · 진입 가능',
  PREOPEN: '전시 · 오픈 예정',
  HOLD: '전시 중지',
};

const EMPTY_FORM = {
  id: null as number | null,
  code: '',
  label: '',
  tagline: '',
  href: '',
  status: 'PREOPEN' as DisplayStatus,
  orderNo: 0,
};

/** 빈 문자열은 "값 없음"이다 */
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function DisplayServicesPage() {
  const [services, setServices] = useState<DisplayService[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const reload = useCallback(async () => {
    setServices(await listDisplayServices());
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch {
      setMessage('실패했습니다 — 코드는 소문자·숫자·하이픈만, OPEN 에는 링크가 필요합니다');
    }
  };

  if (!services) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  const openCount = services.filter((s) => s.status === 'OPEN').length;
  const preopenCount = services.filter((s) => s.status === 'PREOPEN').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">메인 전시</h1>
          <p className="text-sm text-zinc-500">
            1989v.com 메인에 전시하는 서비스입니다. 완성되면 오픈 예정을 진입 가능으로 바꾸세요.
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-8">
          <Stat label="진입 가능" value={`${openCount}개`} />
          <Stat label="오픈 예정" value={`${preopenCount}개`} />
          <Stat label="전시 중지" value={`${services.length - openCount - preopenCount}개`} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          오픈 예정이 많으면 "진행 중인 게 많다"가 아니라 "끝맺은 게 없다"로 읽힙니다.
          실제 로드맵만 오픈 예정으로 두세요. 전시할 생각이 없는 프라이빗 서비스는 아예 등록하지 않습니다.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">전시 서비스</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3">순서</th>
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">코드</th>
                <th className="py-2 pr-3">설명</th>
                <th className="py-2 pr-3">링크</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.code}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    s.status === 'HOLD' ? 'text-zinc-400' : ''
                  }`}
                >
                  <td className="py-2 pr-3 tabular-nums text-zinc-500">{s.orderNo}</td>
                  <td className="py-2 pr-3 font-medium">{s.label}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{s.code}</td>
                  <td className="py-2 pr-3 text-zinc-500">{s.tagline ?? '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{s.href ?? '—'}</td>
                  <td className="py-2 pr-3">{STATUS_LABEL[s.status]}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setForm({
                        id: s.id,
                        code: s.code,
                        label: s.label,
                        tagline: s.tagline ?? '',
                        href: s.href ?? '',
                        status: s.status,
                        orderNo: s.orderNo,
                      })}
                    >
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => s.id && run(() => deleteDisplayService(s.id!), '삭제했습니다')}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-zinc-500">아직 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="코드 (place)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              placeholder="이름 (한국 관광 검색)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="한 줄 설명 (선택)"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              className="sm:col-span-2"
              placeholder="링크 (/place · /shop · https://…)"
              value={form.href}
              onChange={(e) => setForm({ ...form, href: e.target.value })}
            />
            <select
              className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as DisplayStatus })}
            >
              <option value="OPEN">전시 · 진입 가능</option>
              <option value="PREOPEN">전시 · 오픈 예정 (딤드)</option>
              <option value="HOLD">전시 중지</option>
            </select>
            <Input
              type="number"
              value={form.orderNo}
              onChange={(e) => setForm({ ...form, orderNo: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => run(async () => {
                await upsertDisplayService({
                  id: form.id ?? undefined,
                  code: form.code,
                  label: form.label,
                  tagline: blankToNull(form.tagline),
                  href: blankToNull(form.href),
                  status: form.status,
                  orderNo: form.orderNo,
                });
                setForm(EMPTY_FORM);
              }, '저장했습니다')}
            >
              저장
            </Button>
            <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>초기화</Button>
            <span className="text-xs text-zinc-500">
              링크는 상대 경로를 권장합니다 — place/game 은 프로덕션에서 서브도메인으로 자동 이동합니다.
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
