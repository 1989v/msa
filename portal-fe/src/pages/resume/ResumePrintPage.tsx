import { useCallback, useEffect, useRef, useState } from 'react';
import ResumeBody from './ResumeBody';
import Markdown from '../../components/Markdown';
import {
  captureShareToken,
  fetchResumeDocument,
  fetchResumeOverview,
  type ResumeDocument,
  type ResumeOverview,
} from '../../api/resumeApi';
import { resumeTitle } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { CLOSED_TITLE, ResumeClosed } from './ResumePage';
import { hydrateEmails, protectEmails } from './protectEmail';
import { useEditorialSurface } from '../../hooks/useEditorialSurface';
import './Resume.css';

/**
 * 전체 인쇄 (ADR-0064).
 *
 * 메인과 상세를 한 문서로 이어 붙인다. 채용 담당자가 PDF 한 장으로 받고 싶어 하는데,
 * 상세가 링크로만 걸려 있으면 인쇄본에서는 그 내용이 통째로 빠진다.
 */
export default function ResumePrintPage() {
  useEditorialSurface();
  const [overview, setOverview] = useState<ResumeOverview | null>(null);
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'closed'>('loading');
  const bodyRef = useRef<HTMLDivElement>(null);

  useSeo({ title: state === 'closed' ? CLOSED_TITLE : resumeTitle(), noindex: true });

  useEffect(() => {
    captureShareToken(window.location.search);
    let cancelled = false;

    fetchResumeOverview()
      .then(async (data) => {
        // 상세는 순서대로 받아야 인쇄물의 흐름이 화면과 같아진다.
        const details = await Promise.all(data.details.map((d) => fetchResumeDocument(d.slug)));
        if (cancelled) return;
        setOverview(data);
        setDocuments(details);
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
    if (state !== 'ready') return;
    hydrateEmails(bodyRef.current);
    // 렌더가 끝난 다음에 인쇄 대화상자를 띄운다 — 먼저 띄우면 빈 문서가 잡힌다.
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [state, documents]);

  const transform = useCallback((html: string) => protectEmails(html), []);

  if (state === 'loading') {
    return <div className="resume-page resume-status">인쇄본을 준비하는 중…</div>;
  }

  if (state === 'closed' || !overview?.main) {
    return <ResumeClosed />;
  }

  return (
    <div className="resume-page resume-print-view">
      <article className="resume-sheet" ref={bodyRef}>
        <ResumeBody
          source={overview.main.bodyMarkdown}
          profile={overview.profile}
          transformHtml={transform}
        />

        {documents.map((doc) => (
          <section key={doc.slug} className="resume-print-detail">
            <Markdown className="resume-body" source={doc.bodyMarkdown} transformHtml={transform} />
          </section>
        ))}
      </article>

      <div className="resume-actions">
        <button type="button" className="resume-print" onClick={() => window.print()}>
          다시 인쇄
        </button>
        <a className="resume-print-back" href="/">← 이력서로</a>
      </div>
    </div>
  );
}
