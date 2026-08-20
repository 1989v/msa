import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchCategories, fetchPosts } from '../../api/blogApi';
import { blogHubMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import BlogShell from './BlogShell';
import CategoryNav from './CategoryNav';
import PostCard from './PostCard';
import './Blog.css';

const PAGE_SIZE = 12;

export default function BlogHomePage() {
  useHeritageSurface();
  const [page, setPage] = useState(0);

  const categories = useQuery({
    queryKey: ['blog', 'categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
  const posts = useQuery({
    queryKey: ['blog', 'posts', page],
    queryFn: () => fetchPosts({ page, size: PAGE_SIZE }),
  });

  useSeo(blogHubMeta(posts.data?.totalElements));

  return (
    <BlogShell
      title="기록"
      subtitle="서버·검색·데이터부터 취미와 일상까지, 직접 만들고 겪은 것을 남깁니다."
      nav={<CategoryNav categories={categories.data ?? []} />}
    >
      <main>
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
