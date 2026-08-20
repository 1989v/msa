import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchAuthorSpace } from '../../api/blogApi';
import { blogAuthorMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import BlogShell from './BlogShell';
import PostCard from './PostCard';
import './Blog.css';

/** 작성자 공간 — 여러 사람이 쓰는 블로그에서 각자의 착지점이 된다 (ADR-0072) */
export default function BlogAuthorPage() {
  useHeritageSurface();
  const { handle = '' } = useParams();

  const space = useQuery({
    queryKey: ['blog', 'author', handle],
    queryFn: () => fetchAuthorSpace(handle),
    enabled: handle.length > 0,
  });

  useSeo(
    space.data ? blogAuthorMeta(space.data.author, space.data.postCount) : { title: '' },
  );

  return (
    <BlogShell
      title={space.data?.author.displayName ?? '작성자'}
      subtitle={space.data?.author.bio ?? undefined}
    >
      <main>
        {space.isLoading && <p className="blog-status">불러오는 중…</p>}
        {space.isError && <p className="blog-status">작성자를 찾을 수 없습니다.</p>}
        {space.data && (
          <>
            <p className="blog-card__meta kh-mono" style={{ marginBottom: 'var(--ko-space-5)' }}>
              글 {space.data.postCount}편
            </p>
            {space.data.posts.length === 0 ? (
              <p className="blog-empty">아직 발행한 글이 없습니다.</p>
            ) : (
              <ul className="blog-list">
                {space.data.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </BlogShell>
  );
}
