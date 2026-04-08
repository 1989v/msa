import { useState, useEffect } from 'react';
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

export default function DetailSidePanel({ conceptId, onClose, onNavigate }: DetailSidePanelProps) {
  const [detail, setDetail] = useState<ConceptDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conceptId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    fetchConceptDetail(conceptId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [conceptId]);

  return (
    <div className={`detail-side-panel ${conceptId ? 'open' : ''}`}>
      <button className="detail-panel-close" onClick={onClose}>✕</button>

      {loading && <p style={{ color: '#888' }}>Loading...</p>}

      {detail && !loading && (
        <>
          <div className="detail-panel-header">
            <h2 className="detail-panel-name">{detail.name}</h2>
            <div className="detail-panel-badges">
              <span className="detail-badge" style={{ background: CATEGORY_COLORS[detail.category as Category] }}>
                {CATEGORY_LABELS[detail.category as Category]}
              </span>
              <span className="detail-badge" style={{ background: LEVEL_COLORS[detail.level] || '#888' }}>
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
                  <li key={rc.conceptId} className="detail-related-item" onClick={() => onNavigate(rc.conceptId)}>
                    {rc.name}
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#666' }}>{rc.category}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
