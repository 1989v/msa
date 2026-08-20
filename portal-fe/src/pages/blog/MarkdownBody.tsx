import { useMemo } from 'react';
import { renderMarkdown } from './markdown';

/** 본문 렌더. sanitize 는 renderMarkdown 안에 있고 여기서 우회할 방법을 두지 않는다 */
export default function MarkdownBody({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  return <div className={className ?? 'blog-body'} dangerouslySetInnerHTML={{ __html: html }} />;
}
