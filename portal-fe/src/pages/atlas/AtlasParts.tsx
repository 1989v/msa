import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KIND_META } from '../../components/hierarchy/kindLabels';
import { useSuggest } from '../../hooks/useSuggest';
import type { ConceptKind } from '../../types/graph';

/** 노드 유형 글리프 — 모양으로 가른다(색만으로 가르지 않는다). 모양은 CSS 가 그린다 */
export function KindGlyph({ kind, className = '' }: { kind?: ConceptKind | null; className?: string }) {
  const k = (kind ?? 'TERM').toLowerCase();
  return <span className={`atlas-glyph atlas-glyph--${k} ${className}`} aria-hidden="true" />;
}

export function kindLabel(kind?: ConceptKind | null): string {
  return kind ? KIND_META[kind].label : '용어';
}

/** k-heritage 섹션 머리 — `01_` 순번이 제목 앞, 아래로 전폭 괘선 */
export function SectionHead({ index, title, meta }: { index: number; title: string; meta?: string }) {
  return (
    <div className="atlas-section-head">
      <span className="kh-mono atlas-section-head__index">{String(index).padStart(2, '0')}_</span>
      <h2>{title}</h2>
      {meta && <span className="kh-mono atlas-section-head__meta">{meta}</span>}
    </div>
  );
}

/** 개념으로 바로 가기 — 통합 검색의 concept 묶음(BM25 상위) */
export function ConceptSearch({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { suggestions } = useSuggest(query, 200);
  const navigate = useNavigate();
  const go = (id: string) => {
    setQuery('');
    setOpen(false);
    navigate(`/tech/c/${encodeURIComponent(id)}`);
  };
  return (
    <div className={`atlas-search ${compact ? 'atlas-search--compact' : ''}`}>
      <label className="atlas-search__field">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" />
          <path d="m13.2 13.2 3.8 3.8" />
        </svg>
        <input
          type="search"
          value={query}
          aria-label="개념 찾기"
          placeholder={compact ? '개념으로 바로 가기' : '개념으로 바로 가기 — HNSW, 멱등성…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions[0]) go(suggestions[0].conceptId);
            if (e.key === 'Escape') setOpen(false);
          }}
        />
      </label>
      {open && query.trim() && suggestions.length > 0 && (
        <ul className="atlas-search__list" role="listbox" aria-label="개념 후보">
          {suggestions.map((s) => (
            <li key={s.conceptId}>
              <button type="button" role="option" aria-selected="false" onClick={() => go(s.conceptId)}>
                <span>{s.name}</span>
                <span className="kh-mono">{s.conceptId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
