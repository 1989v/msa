import { Link } from 'react-router-dom';
import type { BlogPostSummary } from '../../api/blogApi';
import FavoriteButton from '../../components/favorite/FavoriteButton';

export function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <li className="blog-card-cell">
      {/* 판(kh-slab) 없이 offset 만 걸면 라이트에서 깊은 판이 글자 밑에 그대로 비친다 —
          offset 은 언제나 판 위에 얹는다 (k-heritage.html slab-offset 견본). 목록 카드는
          런처 타일처럼 조용한 판으로 두고, 어긋난 깊이는 홈의 공간 카드가 갖는다. */}
      <Link className="blog-card kh-slab kh-press" to={`/posts/${post.slug}`}>
        {post.coverImageUrl && (
          <img className="blog-card__cover" src={post.coverImageUrl} alt="" loading="lazy" />
        )}
        {/* kh-caps 를 걸지 않는다 — 분류명은 한글이라 넓은 자간만 남는다 (DESIGN.md §12 주의) */}
        <span className="blog-card__category">{post.categoryName}</span>
        <h3 className="blog-card__title">{post.title}</h3>
        <p className="blog-card__summary">{post.summary}</p>
        <div className="blog-card__meta kh-mono">
          <span>{post.author.displayName}</span>
          <span>{formatDate(post.publishedAt)}</span>
          <span>{post.readingMinutes}분</span>
          <span>조회 {post.viewCount}</span>
          {post.likeCount > 0 && <span>좋아요 {post.likeCount}</span>}
        </div>
      </Link>
      {/* 찜 — 카드 링크와 형제로 앉힌다. 좋아요(공감 신호)와 달리 찜은 내 목록에 담는 행위다 (ADR-0074) */}
      <span className="blog-card-favorite">
        <FavoriteButton type="BLOG_POST" targetKey={post.slug} compact />
      </span>
    </li>
  );
}
