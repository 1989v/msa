import { useMemo } from 'react';
import { useHeritageTheme } from '../../hooks/useHeritageSurface';
import { renderMarkdown } from './markdown';

/**
 * 본문 렌더. sanitize 는 renderMarkdown 안에 있고 여기서 우회할 방법을 두지 않는다.
 *
 * 테마를 의존성에 넣는 이유 — 본문의 다이어그램은 그리는 시점에 페이지 색을 읽어
 * 그 값을 SVG 안에 박는다. 한 번 그린 그림은 나중에 테마를 바꿔도 안 따라가므로,
 * 테마가 바뀌면 다시 그려야 한다. 이걸 빼면 다크로 전환했을 때 밝은 노드 채움이
 * 그대로 남는다 (2026-09-01 실측).
 */
export default function MarkdownBody({ source, className }: { source: string; className?: string }) {
  const [theme] = useHeritageTheme();
  const html = useMemo(() => renderMarkdown(source), [source, theme]);
  return <div className={className ?? 'blog-body'} dangerouslySetInnerHTML={{ __html: html }} />;
}
