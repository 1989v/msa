import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PickSheet from '../../components/dispenser/PickSheet';
import { escapeHtml } from '../../lib/card-dispenser';
import { Link } from 'react-router-dom';
import { fetchCategories, fetchPosts, type BlogCategoryNode, type BlogPostSummary } from '../../api/blogApi';
import { blogHubMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import BlogShell from './BlogShell';
import PostCard from './PostCard';
import './Blog.css';

const PAGE_SIZE = 12;
const RECENT_PER_SPACE = 2;

/**
 * 공간 입구 카드. 홈은 "이 블로그엔 이런 공간들이 있다"를 먼저 보이는 전체 랜딩이다 —
 * 최신 글 목록만 있으면 성격이 다른 발행물(기술 / 일상 / 하네스 공유)이 한 덩어리로 섞인다.
 */
function SpaceCard({
  space,
  recentTitles,
}: {
  space: BlogCategoryNode;
  recentTitles: string[];
}) {
  return (
    <li>
      <Link className="blog-space-card kh-slab kh-slab-offset kh-grain kh-press" to={`/c${space.path}`}>
        <span className="blog-space-card__count kh-mono">{space.postCount}편</span>
        <h3 className="blog-space-card__name">{space.name}</h3>
        {space.description && <p className="blog-space-card__desc">{space.description}</p>}
        {recentTitles.length > 0 && (
          <ul className="blog-space-card__recent">
            {recentTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}
      </Link>
    </li>
  );
}

export default function BlogHomePage() {
  useHeritageSurface();
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const [pickOpen, setPickOpen] = useState(false);
  const pickPool = useQuery({
    queryKey: ['blog', 'posts', 'pick'],
    queryFn: () => fetchPosts({ categoryPath: undefined, size: 60 }),
    enabled: pickOpen,
    staleTime: 5 * 60 * 1000,
  });

  const categories = useQuery({
    queryKey: ['blog', 'categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
  const posts = useQuery({
    queryKey: ['blog', 'posts', page],
    queryFn: () => fetchPosts({ page, size: PAGE_SIZE }),
  });

  const spaces = categories.data ?? [];
  // 공간별 최근 글 제목 — 최신 목록 첫 페이지가 특정 공간만 담을 수 있어 목록에서 거르지 않고
  // 공간마다 따로 (아주 작게) 묻는다. staleTime 을 카테고리와 맞춰 재방문에 다시 묻지 않는다.
  const recentBySpace = useQueries({
    queries: spaces.map((space) => ({
      queryKey: ['blog', 'posts', space.path, 'recent'],
      queryFn: () => fetchPosts({ categoryPath: space.path, size: RECENT_PER_SPACE }),
      staleTime: 5 * 60 * 1000,
    })),
  });

  useSeo(blogHubMeta(posts.data?.totalElements));

  return (
    <BlogShell
      title="기록"
      subtitle="서버·검색·데이터부터 취미와 일상까지, 직접 만들고 겪은 것을 남깁니다."
    >
      <main>
        {spaces.length > 0 && (
          <section aria-label="공간">
            <h2 className="kh-section-label">공간</h2>
            <ul className="blog-spaces">
              {spaces.map((space, i) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  recentTitles={(recentBySpace[i]?.data?.items ?? []).map((p) => p.title)}
                />
              ))}
            </ul>
          </section>
        )}

        <div className="blog-section-row">
          <h2 className="kh-section-label">최신 글</h2>
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
        {posts.isError && <p className="blog-status">글을 불러오지 못했습니다.</p>}
        {posts.data && posts.data.items.length === 0 && (
          <p className="blog-empty">아직 발행된 글이 없습니다.</p>
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
