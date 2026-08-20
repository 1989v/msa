import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  categoryLabel,
  createBlogCategory,
  deleteBlogCategory,
  flattenBlogCategories,
  listBlogCategories,
  parentOf,
  updateBlogCategory,
  type BlogCategoryNode,
} from '@/api/blog';

const EMPTY_FORM = {
  id: null as number | null,
  parentId: null as number | null,
  slug: '',
  name: '',
  description: '',
  orderNo: 0,
  hidden: false,
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 계층 카테고리 관리 (ADR-0072). 3단이 상한이고 서버가 강제한다. */
export function BlogCategoriesPage() {
  const [tree, setTree] = useState<BlogCategoryNode[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const reload = useCallback(async () => {
    setTree(await listBlogCategories());
  }, []);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const flat = useMemo(() => flattenBlogCategories(tree ?? []), [tree]);
  // 부모 후보는 3단 미만만 — 3단 밑에 만들면 서버가 거부하고, 고를 수 있게 두면 그 거부가
  // 사용자에게는 원인 없는 실패로 보인다
  const parentOptions = flat.filter((c) => c.depth < 3 && c.id !== form.id);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      await reload();
      setForm(EMPTY_FORM);
      setMessage(ok);
    } catch {
      setMessage('실패했습니다 — 슬러그는 소문자·숫자·하이픈만, 글이나 하위가 남은 분류는 지울 수 없습니다');
    }
  };

  if (!tree) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  const payload = () => ({
    parentId: form.parentId,
    slug: form.slug.trim().toLowerCase(),
    name: form.name.trim(),
    description: blankToNull(form.description),
    orderNo: form.orderNo,
    hidden: form.hidden,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">블로그 분류</h1>
          <p className="text-sm text-zinc-500">
            blog.1989v.com 의 계층 카테고리입니다. 최대 3단 (기술 &gt; 서버 &gt; 검색).
          </p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            상위 분류
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-transparent p-2 text-sm"
              value={form.parentId ?? ''}
              onChange={(e) => setForm({ ...form, parentId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">(최상위)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c, flat)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            슬러그 (URL 세그먼트)
            <Input
              className="mt-1"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="server"
            />
          </label>
          <label className="text-sm">
            이름
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="서버"
            />
          </label>
          <label className="text-sm">
            정렬
            <Input
              className="mt-1"
              type="number"
              value={form.orderNo}
              onChange={(e) => setForm({ ...form, orderNo: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm md:col-span-2">
            설명
            <Input
              className="mt-1"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hidden}
              onChange={(e) => setForm({ ...form, hidden: e.target.checked })}
            />
            숨김 (목록·네비에서 감춤. 이미 발행된 글 주소는 살아 있습니다)
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!form.slug.trim() || !form.name.trim()}
            onClick={() =>
              run(
                async () => {
                  if (form.id) await updateBlogCategory(form.id, payload());
                  else await createBlogCategory(payload());
                },
                form.id ? '수정했습니다' : '추가했습니다',
              )
            }
          >
            {form.id ? '수정' : '추가'}
          </Button>
          {form.id && (
            <Button size="sm" variant="outline" onClick={() => setForm(EMPTY_FORM)}>
              취소
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">분류</th>
              <th className="p-3 text-left">경로</th>
              <th className="p-3 text-left">글</th>
              <th className="p-3 text-left">정렬</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {flat.map((category) => (
              <tr key={category.id} className="border-t border-zinc-800">
                <td className="p-3">{categoryLabel(category, flat)}</td>
                <td className="p-3 font-mono text-xs text-zinc-500">{category.path}</td>
                <td className="p-3">{category.postCount}</td>
                <td className="p-3">{category.orderNo}</td>
                <td className="p-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm({
                        id: category.id,
                        // 부모를 비워 두면 "수정" 한 번에 최상위로 올라가고, 하위 경로가 전부 다시 쓰인다
                        parentId: parentOf(category, flat)?.id ?? null,
                        slug: category.slug,
                        name: category.name,
                        description: category.description ?? '',
                        orderNo: category.orderNo,
                        hidden: false,
                      })
                    }
                  >
                    수정
                  </Button>{' '}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => deleteBlogCategory(category.id), '삭제했습니다')}
                  >
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
