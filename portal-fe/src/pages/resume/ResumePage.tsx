import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ResumeBody from './ResumeBody';
import { captureShareToken, fetchResumeOverview, type ResumeOverview } from '../../api/resumeApi';
import { resumeTitle } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { hydrateEmails, protectEmails } from './protectEmail';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import ThemeToggle from '../../components/ThemeToggle';
import './Resume.css';

/** 게이트에 막혔을 때는 탭 제목도 404 와 같은 말을 해야 한다 */
export const CLOSED_TITLE = '페이지를 찾을 수 없습니다';

export default function ResumePage() {
  useHeritageSurface();
  const [overview, setOverview] = useState<ResumeOverview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'closed'>('loading');
  const bodyRef = useRef<HTMLDivElement>(null);

  // 브라우저가 PDF 머리말에 문서 제목을 찍으므로, 탭 제목이 곧 인쇄물의 머리말이다.
  useSeo({ title: state === 'closed' ? CLOSED_TITLE : resumeTitle(), noindex: true });

  useEffect(() => {
    captureShareToken(window.location.search);
    let cancelled = false;
    fetchResumeOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('closed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state === 'ready') hydrateEmails(bodyRef.current);
  }, [state, overview]);

  const transform = useCallback((html: string) => protectEmails(html), []);

  if (state === 'loading') {
    return <div className="resume-page resume-status">불러오는 중…</div>;
  }

  if (state === 'closed' || !overview?.main) {
    return <ResumeClosed />;
  }

  return (
    <div className="resume-page">
      <article className="resume-sheet" ref={bodyRef}>
        <ResumeBody
          source={overview.main.bodyMarkdown}
          profile={overview.profile}
          transformHtml={transform}
        />

        {overview.details.length > 0 && (
          <nav className="resume-details" aria-label="프로젝트 상세">
            <h2 className="resume-details-title">프로젝트 상세</h2>
            <p className="resume-details-hint">각 항목을 누르면 문제 정의부터 결과까지 확인할 수 있습니다.</p>
            <ul className="resume-details-list">
              {overview.details.map((doc) => (
                <li key={doc.slug}>
                  <Link className="resume-details-link" to={`/d/${doc.slug}`}>
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>

      <div className="resume-actions">
        <button type="button" className="resume-print" onClick={() => window.print()}>
          이 화면 인쇄
        </button>
        <a className="resume-print" href="/print">
          전체 인쇄 (상세 포함)
        </a>
        {/* resume 는 자기 호스트의 첫 화면인데 GNB 가 없다 — 여기 없으면 톤을 바꿀 수단이 없다 */}
        <ThemeToggle />
      </div>
    </div>
  );
}

/**
 * 구직 중이 아니거나 토큰이 유효하지 않을 때. 무엇이 막혔는지 알려주지 않는다 —
 * 문서의 존재 자체를 노출하지 않는 것이 게이트의 목적이다 (ADR-0064).
 */
export function ResumeClosed() {
  return (
    <div className="resume-page resume-status">
      <h1 className="resume-closed-title">페이지를 찾을 수 없습니다</h1>
      <p className="resume-closed-body">
        주소가 정확한지 확인해 주세요. 다른 서비스는 <a href="https://1989v.com">1989v.com</a> 에 있습니다.
      </p>
    </div>
  );
}
