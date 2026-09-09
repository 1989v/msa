import { useEffect, useMemo, useRef } from 'react';
import { useHeritageTheme } from '../../hooks/useHeritageSurface';
import { renderMarkdown } from './markdown';
import PostToc from './PostToc';
import { decorateHeadings } from './toc';

/**
 * 본문 렌더. sanitize 는 renderMarkdown 안에 있고 여기서 우회할 방법을 두지 않는다.
 *
 * 테마를 의존성에 넣는 이유 — 본문의 다이어그램은 그리는 시점에 페이지 색을 읽어
 * 그 값을 SVG 안에 박는다. 한 번 그린 그림은 나중에 테마를 바꿔도 안 따라가므로,
 * 테마가 바뀌면 다시 그려야 한다. 이걸 빼면 다크로 전환했을 때 밝은 노드 채움이
 * 그대로 남는다 (2026-09-01 실측).
 *
 * `permalink`(글의 canonical 주소)가 있을 때만 목차와 제목 앵커를 켠다. 스튜디오
 * 미리보기에는 아직 공유할 주소가 없어서, 앵커를 그려 봐야 복사되는 것이 편집 화면
 * 주소가 된다 — 절 링크는 주소를 아는 화면에만 있다.
 */
export default function MarkdownBody({
  source,
  className,
  permalink,
}: {
  source: string;
  className?: string;
  permalink?: string;
}) {
  const [theme] = useHeritageTheme();
  const bodyRef = useRef<HTMLDivElement>(null);

  const { html, toc } = useMemo(() => {
    const rendered = renderMarkdown(source);
    return permalink ? decorateHeadings(rendered) : { html: rendered, toc: [] };
  }, [source, theme, permalink]);

  // 앵커 클릭 = 그 절로 이동(브라우저 기본 동작) + 절 주소 복사.
  // 본문이 innerHTML 이라 앵커마다 React 이벤트를 걸 수 없어 컨테이너에 한 번 위임한다.
  useEffect(() => {
    const container = bodyRef.current;
    if (!container || !permalink) return;

    const timers: number[] = [];
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a.blog-anchor');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const hash = anchor.getAttribute('href')?.slice(1);
      if (!hash) return;
      // 복사하는 것은 **canonical + 절** 이다. 지금 주소를 그대로 쓰면 쿼리스트링이
      // 같이 따라가 같은 글이 여러 주소로 돌아다닌다 (SharePanel 과 같은 판단).
      void copyLink(`${permalink}#${hash}`).then((copied) => {
        if (!copied) return;
        anchor.dataset.copied = '1';
        timers.push(window.setTimeout(() => delete anchor.dataset.copied, 1400));
      });
    };

    container.addEventListener('click', onClick);
    return () => {
      container.removeEventListener('click', onClick);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [permalink]);

  // 좁은 화면에서 편 표를 다시 표로 되돌리는 고르개. 앵커와 같은 이유로
  // 컨테이너에 한 번 위임한다 — 본문이 innerHTML 이라 버튼마다 못 건다.
  // `permalink` 에 매이지 않는다: 스튜디오 미리보기에서도 같이 확인해야 한다.
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.('button.kh-tableview');
      if (!(button instanceof HTMLButtonElement)) return;
      // 버튼은 표를 감싸지 않고 바로 앞 형제로 있다 (`markdownExtensions`).
      const table = button.nextElementSibling;
      if (!(table instanceof HTMLTableElement)) return;
      const asTable = table.dataset.view !== 'table';
      table.dataset.view = asTable ? 'table' : 'stack';
      button.setAttribute('aria-pressed', String(asTable));
      button.textContent = asTable ? '펴서 보기' : '표로 보기';
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [html]);

  // 절 주소로 바로 들어온 경우. 글은 비동기로 받아 오므로 브라우저가 처음 해시를
  // 처리할 때는 그 제목이 아직 문서에 없다 — 화면에 그려진 뒤 여기서 한 번 맞춘다.
  useEffect(() => {
    if (!permalink) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [html, permalink]);

  return (
    <>
      <PostToc items={toc} />
      <div
        ref={bodyRef}
        className={className ?? 'blog-body'}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

/** 클립보드 권한이 없는 브라우저에서는 주소창처럼 고를 수 있는 창으로 떨어뜨린다. */
async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt('링크 복사', url);
    return false;
  }
}
