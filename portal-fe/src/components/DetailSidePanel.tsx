import { useState, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { fetchConceptDetail } from '../api/searchApi';
import type { ConceptDetail } from '../types/graph';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../types';
import type { Category } from '../types';
import './DetailSidePanel.css';

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: '#00b894',
  INTERMEDIATE: '#fdcb6e',
  ADVANCED: '#e17055',
};

interface DetailSidePanelProps {
  conceptId: string | null;
  onClose: () => void;
  onNavigate: (conceptId: string) => void;
}

/**
 * 개념 상세 — 데스크탑은 우측 레일, 모바일(<768px)은 바텀시트로 동작한다.
 * 시트는 핸들을 아래로 끌어 닫을 수 있다.
 */
export default function DetailSidePanel({ conceptId, onClose, onNavigate }: DetailSidePanelProps) {
  // 어느 conceptId 의 응답인지 함께 저장 — loading 은 파생값 (effect 내 동기 setState 회피)
  const [loaded, setLoaded] = useState<{ id: string; detail: ConceptDetail | null } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; dy: number } | null>(null);

  useEffect(() => {
    if (!conceptId) return;
    let cancelled = false;
    fetchConceptDetail(conceptId)
      .then((d) => {
        if (!cancelled) setLoaded({ id: conceptId, detail: d });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ id: conceptId, detail: null });
      });
    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  const detail = conceptId && loaded?.id === conceptId ? loaded.detail : null;
  const loading = conceptId !== null && loaded?.id !== conceptId;

  /* ---- 바텀시트 스와이프 닫기 (핸들은 모바일에서만 보인다) ---- */
  const handleDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 이미 해제된 포인터 등 — 캡처 실패해도 드래그 추적은 계속한다
    }
    dragRef.current = { startY: e.clientY, dy: 0 };
  };

  const handleDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    drag.dy = Math.max(0, e.clientY - drag.startY);
    panel.style.transform = `translateY(${drag.dy}px)`;
  };

  const handleDragEnd = () => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    dragRef.current = null;
    if (!panel) return;
    panel.style.transform = '';
    if (drag && drag.dy > 80) onClose();
  };

  return (
    <>
      <div
        className={`detail-panel-backdrop ${conceptId ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`detail-side-panel ${conceptId ? 'open' : ''}`}
        role="complementary"
        aria-label="개념 상세"
      >
        <div
          className="detail-panel-handle"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          aria-hidden="true"
        />
        <button className="detail-panel-close" onClick={onClose} aria-label="상세 닫기">
          ✕
        </button>

        {loading && <p className="detail-panel-loading">불러오는 중…</p>}

        {detail && !loading && (
          <>
            <div className="detail-panel-header">
              <h2 className="detail-panel-name">{detail.name}</h2>
              <div className="detail-panel-badges">
                <span className="detail-badge" style={{ background: CATEGORY_COLORS[detail.category as Category] }}>
                  {CATEGORY_LABELS[detail.category as Category]}
                </span>
                <span className="detail-badge" style={{ background: LEVEL_COLORS[detail.level] || '#94a3b8' }}>
                  {detail.level}
                </span>
              </div>
            </div>

            <div className="detail-panel-section">
              <h3>Description</h3>
              <p className="detail-panel-description">{detail.description}</p>
            </div>

            {detail.codeSnippets.length > 0 && (
              <div className="detail-panel-section">
                <h3>Code Snippets</h3>
                {detail.codeSnippets.map((snippet, i) => (
                  <div key={i} className="detail-snippet">
                    <div className="detail-snippet-path">
                      {snippet.gitUrl ? (
                        <a href={snippet.gitUrl} target="_blank" rel="noopener noreferrer">
                          {snippet.filePath}:{snippet.lineStart}-{snippet.lineEnd}
                        </a>
                      ) : (
                        `${snippet.filePath}:${snippet.lineStart}-${snippet.lineEnd}`
                      )}
                    </div>
                    <pre className="detail-snippet-code">{snippet.codeSnippet}</pre>
                  </div>
                ))}
              </div>
            )}

            {detail.relatedConcepts.length > 0 && (
              <div className="detail-panel-section">
                <h3>Related Concepts</h3>
                <ul className="detail-related-list">
                  {detail.relatedConcepts.map((rc) => (
                    <li key={rc.conceptId}>
                      <button
                        type="button"
                        className="detail-related-item"
                        onClick={() => onNavigate(rc.conceptId)}
                      >
                        {rc.name}
                        <span className="detail-related-category">{rc.category}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
