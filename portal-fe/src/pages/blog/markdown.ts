import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { inlineDiagrams } from 'fencesvg';

/**
 * 마크다운 → HTML.
 *
 * **반드시 sanitize 를 거친다.** 저자는 승인된 사람이지만, 승인이 곧 신뢰는 아니고
 * 계정 탈취 한 번이면 블로그 전체가 스크립트 배포 경로가 된다. 서버 렌더(크롤러용 사본)는
 * 아예 raw HTML 을 이스케이프하고, 화면 쪽은 여기서 화이트리스트로 거른다.
 *
 * 다이어그램 펜스는 marked 앞에서 SVG 로 바뀐다 (`docs/conventions/blog-diagram.md`).
 * 색을 토큰 참조로 내보내므로 테마 토글을 그대로 따라간다.
 */
export function renderMarkdown(source: string): string {
  const withDiagrams = inlineDiagrams(source ?? '', { accent: 'var(--ko-accent-primary)' });
  const raw = marked.parse(withDiagrams, { async: false, gfm: true, breaks: false }) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'iframe', 'form', 'input'],
  });
}
