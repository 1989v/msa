import { Link } from 'react-router-dom';
import type { BlogPostSummary } from '../../api/blogApi';

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
    <li>
      <Link className="blog-card kh-slab-offset" to={`/posts/${post.slug}`}>
        {post.coverImageUrl && (
          <img className="blog-card__cover" src={post.coverImageUrl} alt="" loading="lazy" />
        )}
        <span className="blog-card__category kh-caps">{post.categoryName}</span>
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
    </li>
  );
}
