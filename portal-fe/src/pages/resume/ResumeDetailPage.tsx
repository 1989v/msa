import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Markdown from '../../components/Markdown';
import { captureShareToken, fetchResumeDocument, type ResumeDocument } from '../../api/resumeApi';
import { ResumeClosed } from './ResumePage';
import { hydrateEmails, protectEmails } from './protectEmail';
import './Resume.css';

export default function ResumeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [document, setDocument] = useState<ResumeDocument | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'closed'>('loading');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    captureShareToken(window.location.search);
    let cancelled = false;
    setState('loading');
    fetchResumeDocument(slug)
      .then((data) => {
        if (cancelled) return;
        setDocument(data);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('closed');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (state === 'ready') hydrateEmails(bodyRef.current);
  }, [state, document]);

  const transform = useCallback((html: string) => protectEmails(html), []);

  if (state === 'loading') {
    return <div className="resume-page resume-status">불러오는 중…</div>;
  }

  if (state === 'closed' || !document) {
    return <ResumeClosed />;
  }

  return (
    <div className="resume-page">
      <article className="resume-sheet" ref={bodyRef}>
        <Link className="resume-back" to="/">
          ← 이력서
        </Link>
        <Markdown className="resume-body" source={document.bodyMarkdown} transformHtml={transform} />
      </article>

      <div className="resume-actions">
        <button type="button" className="resume-print" onClick={() => window.print()}>
          인쇄 · PDF 저장
        </button>
      </div>
    </div>
  );
}
