import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownProps {
  source: string;
  className?: string;
  /** 정화 후 한 번 더 손볼 기회 — 이력서는 여기서 이메일을 조각낸다 */
  transformHtml?: (html: string) => string;
}

marked.setOptions({ gfm: true, breaks: false });

/**
 * 마크다운 본문 렌더러.
 *
 * 본문은 어드민에서만 입력되지만, 저장소가 오염됐을 때 그대로 실행되는 일이 없도록
 * 렌더 직전에 정화한다. 표는 부모가 가로 스크롤 컨테이너를 씌운다.
 */
export default function Markdown({ source, className, transformHtml }: MarkdownProps) {
  const html = useMemo(() => {
    const parsed = marked.parse(source, { async: false }) as string;
    const clean = DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } });
    return transformHtml ? transformHtml(clean) : clean;
  }, [source, transformHtml]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
