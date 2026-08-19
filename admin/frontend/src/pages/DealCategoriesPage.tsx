import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createDealCategory,
  deleteDealCategory,
  listDealCategories,
  updateDealCategory,
  type DealCategory,
  type DisplayStatus,
} from '@/api/deals';

const STATUS_LABEL: Record<DisplayStatus, string> = {
  OPEN: '노출 중',
  PREOPEN: '노출 대기',
  HOLD: '내림',
};

const EMPTY_FORM = {
  id: null as number | null,
  code: '',
  label: '',
  tagline: '',
  status: 'OPEN' as DisplayStatus,
  orderNo: 0,
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function DealCategoriesPage() {
  const [categories, setCategories] = useState<DealCategory[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const reload = useCallback(async () => {
    setCategories(await listDealCategories());
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
      setMessage('실패했습니다 — 코드는 소문자·숫자·하이픈만, 오퍼가 남은 분류는 지울 수 없습니다');
    }
  };

  if (!categories) {
    return (
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <span>{message ?? '불러오는 중…'}</span>
        {message && (
          <Button size="sm" variant="outline" onClick={() => { setMessage(null); reload().catch(() => setMessage('불러오지 못했습니다')); }}>
            다시 시도
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">혜택 분류</h1>
          <p className="text-sm text-zinc-500">deal.1989v.com 의 카테고리입니다.</p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="p-4">
        <p className="text-xs text-zinc-500">
          의료·금융은 분류를 만들지 않습니다. 의료법 27조(영리 목적 환자 소개·알선)와
          금융소비자보호법(대출모집인 등록)이 "링크로 유입 → 결제 시 수수료" 구조를 직접 겨눕니다.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-medium">분류</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3">순서</th>
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">코드</th>
                <th className="py-2 pr-3">설명</th>
                <th className="py-2 pr-3">오퍼</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr
                  key={c.code}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    c.status === 'HOLD' ? 'text-zinc-400' : ''
                  }`}
                >
                  <td className="py-2 pr-3 tabular-nums text-zinc-500">{c.orderNo}</td>
                  <td className="py-2 pr-3 font-medium">{c.label}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{c.code}</td>
                  <td className="py-2 pr-3 text-zinc-500">{c.tagline ?? '—'}</td>
                  <td className="py-2 pr-3 tabular-nums text-zinc-500">{c.offerCount}</td>
                  <td className="py-2 pr-3">{STATUS_LABEL[c.status]}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setForm({
                        id: c.id,
                        code: c.code,
                        label: c.label,
                        tagline: c.tagline ?? '',
                        status: c.status,
                        orderNo: c.orderNo,
                      })}
                    >
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => run(() => deleteDealCategory(c.id), '삭제했습니다')}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-zinc-500">아직 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="코드 (travel)"
              value={form.code}
              disabled={form.id !== null}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              placeholder="이름 (여행)"
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
            <select
              className="h-9 rounded-md border border-zinc-300 bg-transparent px-2 text-sm dark:border-zinc-700"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as DisplayStatus })}
            >
              <option value="OPEN">노출 중</option>
              <option value="PREOPEN">노출 대기</option>
              <option value="HOLD">내림</option>
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
                const payload = {
                  code: form.code.trim(),
                  label: form.label.trim(),
                  tagline: blankToNull(form.tagline),
                  status: form.status,
                  orderNo: form.orderNo,
                };
                if (form.id === null) await createDealCategory(payload);
                else await updateDealCategory(form.id, payload);
                setForm(EMPTY_FORM);
              }, '저장했습니다')}
            >
              저장
            </Button>
            <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>초기화</Button>
            {form.id !== null && (
              <span className="text-xs text-zinc-500">코드는 바꿀 수 없습니다 — 공유된 링크가 깨집니다.</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
