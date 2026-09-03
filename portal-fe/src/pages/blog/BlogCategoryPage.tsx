import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PickSheet from '../../components/dispenser/PickSheet';
import { escapeHtml } from '../../lib/card-dispenser';
import { useParams } from 'react-router-dom';
import { fetchCategories, fetchPosts, flattenCategories, type BlogPostSummary } from '../../api/blogApi';
import { blogCategoryMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import BlogShell from './BlogShell';
import CategoryNav from './CategoryNav';
import PostCard from './PostCard';
import './Blog.css';

const PAGE_SIZE = 12;

/**
 * 공간 홈 + 하위 분류 페이지. 경로 세그먼트가 그대로 카테고리 경로가 된다
 * (`/c/tech/server/search`). 상위를 고르면 하위 글까지 나온다 — 서버가 서브트리로
 * 조회하기 때문이다.
 *
 * 제목 자리는 언제나 **공간**(depth-1)이다 — 하위 분류는 칩의 활성 상태가 말해 준다.
 * 공간이 페이지의 정체성이고, 공간 전환은 머리의 SpaceSwitcher 몫이다 (ADR-0072).
 */
export default function BlogCategoryPage() {
  useHeritageSurface();
  const params = useParams();
  const path = `/${params['*'] ?? ''}`.replace(/\/+$/, '');
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const [pickOpen, setPickOpen] = useState(false);
  const pickPool = useQuery({
    queryKey: ['blog', 'posts', path, 'pick'],
    queryFn: () => fetchPosts({ categoryPath: path, size: 60 }),
    enabled: pickOpen,
    staleTime: 5 * 60 * 1000,
  });

  const categories = useQuery({
    queryKey: ['blog', 'categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
  const posts = useQuery({
    queryKey: ['blog', 'posts', path, page],
    queryFn: () => fetchPosts({ categoryPath: path, page, size: PAGE_SIZE }),
    enabled: path.length > 1,
  });

  const space = (categories.data ?? []).find(
    (c) => path === c.path || path.startsWith(`${c.path}/`),
  );
  const category = flattenCategories(categories.data ?? []).find((c) => c.path === path);
  useSeo(
    category
      ? blogCategoryMeta(category)
      : { title: '', canonical: undefined },
  );

  return (
    <BlogShell
      title={space?.name ?? '공간'}
      subtitle={category?.description ?? space?.description ?? undefined}
      nav={<CategoryNav categories={categories.data ?? []} activePath={path} />}
    >
      <main>
        <div className="blog-section-row">
          <h2 className="kh-section-label">글</h2>
          <button type="button" className="blog-chip kh-press" aria-haspopup="dialog" onClick={() => setPickOpen(true)}>
            아무 글이나
          </button>
        </div>
        {pickOpen && (
          <PickSheet<BlogPostSummary>
            label="아무 글이나"
            items={pickPool.data ? pickPool.data.items : null}
            error={pickPool.isError}
            render={(post, i) =>
              `<div class="cd-body cd-body--text"><span class="cd-seal">${escapeHtml(post.categoryName)}</span>` +
              `<b class="cd-title cd-title--wrap">${escapeHtml(post.title)}</b><span class="cd-meta">${escapeHtml((post.publishedAt ?? '').slice(0, 10))} · ${post.readingMinutes}분</span>` +
              `<span class="cd-num">${String(i + 1).padStart(2, '0')}</span></div>`
            }
            describe={(post) => ({ title: post.title, meta: `${post.categoryName} · ${(post.publishedAt ?? '').slice(0, 10)} · ${post.readingMinutes}분` })}
            caption={['지금 분류', `글 ${pickPool.data?.totalElements ?? 0}편`]}
            goLabel="읽기"
            onGo={(post) => {
              setPickOpen(false);
              navigate(`/posts/${post.slug}`);
            }}
            onClose={() => setPickOpen(false)}
            skin="paper"
            minCards={24}
          />
        )}
        {posts.isLoading && <p className="blog-status">불러오는 중…</p>}
        {posts.data && posts.data.items.length === 0 && (
          <p className="blog-empty">이 분류에는 아직 글이 없습니다.</p>
        )}
        {posts.data && posts.data.items.length > 0 && (
          <ul className="blog-list">
            {posts.data.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </ul>
        )}
        {posts.data && posts.data.totalPages > 1 && (
          <div className="blog-pager">
            <button
              type="button"
              className="blog-btn blog-btn--ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              이전
            </button>
            <span className="kh-mono">
              {page + 1} / {posts.data.totalPages}
            </span>
            <button
              type="button"
              className="blog-btn blog-btn--ghost"
              disabled={page + 1 >= posts.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </div>
        )}
      </main>
    </BlogShell>
  );
}
