import { useCallback, useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  categoryLabel,
  changeBlogPostStatus,
  createBlogPost,
  deleteBlogPost,
  flattenBlogCategories,
  getBlogPost,
  listBlogCategories,
  listBlogPosts,
  listBlogPostViews,
  updateBlogPost,
  type BlogCategoryNode,
  type BlogPostSummary,
  type BlogViewDaily,
  type PostStatus,
} from '@/api/blog';

const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: '초안',
  PUBLISHED: '발행됨',
  ARCHIVED: '내림',
};

const EMPTY_FORM = {
  id: null as number | null,
  title: '',
  slug: '',
  categoryId: null as number | null,
  summary: '',
  coverImageUrl: '',
  body: '',
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 미리보기도 sanitize 를 거친다 — 어드민 화면이라고 스크립트를 실행시킬 이유가 없다 */
function preview(source: string): string {
  return DOMPurify.sanitize(marked.parse(source ?? '', { async: false, gfm: true }) as string);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * 블로그 글 관리 (ADR-0072 §7 — 운영자의 기본 작성 경로).
 *
 * 저장·발행은 스튜디오와 **같은 서버 서비스**를 부른다. 여기가 어드민이라고 규칙이
 * 달라지지 않는다 — 다른 것은 남의 글도 고칠 수 있다는 것뿐이다.
 */
export function BlogPostsPage() {
  const [posts, setPosts] = useState<BlogPostSummary[] | null>(null);
  const [categories, setCategories] = useState<BlogCategoryNode[]>([]);
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [views, setViews] = useState<{ id: number; rows: BlogViewDaily[] } | null>(null);

  const reload = useCallback(async () => {
    const [page, tree] = await Promise.all([
      listBlogPosts({ status: statusFilter || undefined, size: 50 }),
      listBlogCategories(),
    ]);
    setPosts(page.items);
    setCategories(tree);
  }, [statusFilter]);

  useEffect(() => {
    reload().catch(() => setMessage('불러오지 못했습니다'));
  }, [reload]);

  const flat = useMemo(() => flattenBlogCategories(categories), [categories]);
  // 잎에만 글을 붙인다 — 상위에 붙이면 하위 분류가 비어 보이고, 상위 조회는 어차피
  // 서브트리를 긁으므로 잃는 것이 없다
  const leaves = flat.filter((c) => c.children.length === 0);

  useEffect(() => {
    if (form.categoryId == null && leaves.length > 0) {
      setForm((prev) => ({ ...prev, categoryId: leaves[0].id }));
    }
  }, [leaves, form.categoryId]);

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      await reload();
      setMessage(ok);
    } catch {
      setMessage('실패했습니다 — 슬러그 중복이거나 권한이 없습니다');
    }
  };

  const payload = () => ({
    title: form.title.trim(),
    // 슬러그는 새 글에서만 정한다. 발행 뒤 주소가 바뀌면 공유된 링크와 색인이 죽는다.
    slug: form.id ? null : blankToNull(form.slug),
    categoryId: form.categoryId as number,
    summary: blankToNull(form.summary),
    body: form.body,
    coverImageUrl: blankToNull(form.coverImageUrl),
  });

  const edit = async (id: number) => {
    const detail = await getBlogPost(id);
    setForm({
      id: detail.post.id,
      title: detail.post.title,
      slug: detail.post.slug,
      categoryId: flat.find((c) => c.path === detail.post.categoryPath)?.id ?? null,
      summary: detail.post.summary,
      coverImageUrl: detail.post.coverImageUrl ?? '',
      body: detail.body,
    });
  };

  if (!posts) {
    return <div className="text-sm text-zinc-500">{message ?? '불러오는 중…'}</div>;
  }

  const ready = form.title.trim().length > 0 && form.body.trim().length > 0 && form.categoryId != null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">블로그 글</h1>
          <p className="text-sm text-zinc-500">blog.1989v.com — 여기서 쓴 글의 저자는 로그인한 관리자입니다.</p>
        </div>
        {message && <span className="text-sm text-zinc-500">{message}</span>}
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            제목
            <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          {!form.id && (
            <label className="text-sm">
              슬러그 (비우면 서버가 정합니다 — 한글 제목이면 날짜+임의값)
              <Input className="mt-1" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
          )}
          <label className="text-sm">
            분류
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-transparent p-2 text-sm"
              value={form.categoryId ?? ''}
              onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
            >
              {leaves.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c, flat)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            요약 (검색결과·공유 카드. 비우면 본문에서 뽑습니다)
            <Input
              className="mt-1"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <label className="text-sm md:col-span-2">
            대표 이미지 URL (업로드는 아직 없습니다 — 외부 주소)
            <Input
              className="mt-1"
              value={form.coverImageUrl}
              onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            본문 (마크다운)
            <textarea
              className="mt-1 h-96 w-full rounded border border-zinc-700 bg-transparent p-3 font-mono text-xs"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          <div className="text-sm">
            미리보기
            <div
              className="prose prose-invert mt-1 h-96 overflow-y-auto rounded border border-zinc-800 p-3 text-sm"
              dangerouslySetInnerHTML={{ __html: preview(form.body) }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!ready}
            onClick={() =>
              run(
                async () => {
                  if (form.id) await updateBlogPost(form.id, payload());
                  else await createBlogPost(payload());
                  setForm(EMPTY_FORM);
                },
                form.id ? '수정했습니다' : '초안으로 저장했습니다',
              )
            }
          >
            {form.id ? '수정' : '초안 저장'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!ready}
            onClick={() =>
              run(async () => {
                const saved = form.id ? await updateBlogPost(form.id, payload()) : await createBlogPost(payload());
                await changeBlogPostStatus(saved.id, 'PUBLISHED');
                setForm(EMPTY_FORM);
              }, '발행했습니다')
            }
          >
            저장 후 발행
          </Button>
          {form.id && (
            <Button size="sm" variant="outline" onClick={() => setForm(EMPTY_FORM)}>
              새 글로
            </Button>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">상태</span>
        <select
          className="rounded border border-zinc-700 bg-transparent p-1"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PostStatus | '')}
        >
          <option value="">전체</option>
          <option value="DRAFT">초안</option>
          <option value="PUBLISHED">발행됨</option>
          <option value="ARCHIVED">내림</option>
        </select>
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="p-3 text-left">제목</th>
              <th className="p-3 text-left">저자</th>
              <th className="p-3 text-left">분류</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3 text-left">조회</th>
              <th className="p-3 text-left">반응</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-t border-zinc-800">
                <td className="p-3">
                  <a
                    href={`https://blog.1989v.com/posts/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {post.title}
                  </a>
                </td>
                <td className="p-3">{post.author.displayName}</td>
                <td className="p-3 text-zinc-500">{post.categoryName}</td>
                <td className="p-3">{STATUS_LABEL[post.status]}</td>
                <td className="p-3">{post.viewCount}</td>
                <td className="p-3 text-zinc-500">
                  ♥{post.likeCount} · ★{post.ratingCount > 0 ? post.ratingAverage.toFixed(1) : '-'} · 댓
                  {post.commentCount}
                </td>
                <td className="space-x-1 p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => void edit(post.id)}>
                    수정
                  </Button>
                  {post.status !== 'PUBLISHED' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(() => changeBlogPostStatus(post.id, 'PUBLISHED').then(() => undefined), '발행했습니다')}
                    >
                      발행
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(() => changeBlogPostStatus(post.id, 'ARCHIVED').then(() => undefined), '내렸습니다')}
                    >
                      내리기
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const rows = await listBlogPostViews(post.id, isoDaysAgo(30), isoDaysAgo(0));
                      setViews({ id: post.id, rows });
                    }}
                  >
                    조회 추이
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm('삭제하면 댓글과 반응도 함께 사라집니다. 계속할까요?')) {
                        void run(() => deleteBlogPost(post.id), '삭제했습니다');
                      }
                    }}
                  >
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  글이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {views && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-zinc-500">최근 30일 일별 조회 (원장 기준 · 봇 제외)</span>
            <Button size="sm" variant="outline" onClick={() => setViews(null)}>
              닫기
            </Button>
          </div>
          {views.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">기간 내 조회가 없습니다.</p>
          ) : (
            <ul className="grid gap-1 text-xs md:grid-cols-3">
              {views.rows.map((row) => (
                <li key={row.date} className="font-mono">
                  {row.date} · {row.count}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
