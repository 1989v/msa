import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Markdown from '../../components/Markdown';
import { captureShareToken, fetchResumeOverview, type ResumeOverview } from '../../api/resumeApi';
import { hydrateEmails, protectEmails } from './protectEmail';
import './Resume.css';

export default function ResumePage() {
  const [overview, setOverview] = useState<ResumeOverview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'closed'>('loading');
  const bodyRef = useRef<HTMLDivElement>(null);

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
        <Markdown className="resume-body" source={overview.main.bodyMarkdown} transformHtml={transform} />

        {overview.details.length > 0 && (
          <nav className="resume-details" aria-label="상세">
            <h2 className="resume-details-title">상세</h2>
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
          인쇄 · PDF 저장
        </button>
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
