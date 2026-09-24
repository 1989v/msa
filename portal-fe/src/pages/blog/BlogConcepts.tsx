import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fetchConceptDetail, suggestConcepts } from '../../api/searchApi';
import { conceptHref } from '../../shell/serviceHref';

/** 글 하나에 고를 수 있는 개념 수 — 서버(`BlogPost.MAX_CONCEPTS`)와 같다 */
export const MAX_CONCEPTS = 12;

/**
 * 개념 id 목록의 표시 이름. 개념은 다른 서비스(개념 사전)가 갖고 글은 id 만 들고 있어서
 * 이름은 화면이 따로 받는다. 받지 못한 id 는 id 그대로 보인다 — 지워진 개념이어도 칩이 사라지지 않는다.
 */
function useConceptNames(ids: string[]): Record<string, string> {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['concept', 'detail', id],
      queryFn: () => fetchConceptDetail(id),
      staleTime: 30 * 60 * 1000,
      retry: false,
    })),
  });
  const names: Record<string, string> = {};
  ids.forEach((id, i) => {
    names[id] = results[i]?.data?.name ?? id;
  });
  return names;
}

/** 글 화면 — 이 글이 다루는 개념. 누르면 `/tech` 의 그 개념으로 간다 */
export function ConceptChips({ ids }: { ids: string[] }) {
  const names = useConceptNames(ids);
  if (ids.length === 0) return null;
  return (
    <nav className="blog-concepts" aria-label="이 글이 다루는 개념">
      <span className="blog-concepts__label kh-mono">개념</span>
      {ids.map((id) => (
        <a key={id} className="blog-chip" href={conceptHref(id)}>
          {names[id]}
        </a>
      ))}
    </nav>
  );
}

/** 편집기 — 개념 검색으로 골라 칩으로 쌓는다. 순서가 곧 글 화면의 표시 순서다 */
export function ConceptPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const suggestions = useQuery({
    queryKey: ['concept', 'suggest', debounced],
    queryFn: () => suggestConcepts(debounced, 8),
    enabled: debounced.length > 0,
    staleTime: 60 * 1000,
  });
  const names = useConceptNames(value);
  const full = value.length >= MAX_CONCEPTS;

  const add = (id: string) => {
    if (full || value.includes(id)) return;
    onChange([...value, id]);
    setQuery('');
  };

  return (
    <div className="blog-field">
      <span>개념 (최대 {MAX_CONCEPTS}개 — 글 화면에 칩으로 나가고 개념 화면에서 이 글이 보입니다)</span>
      {value.length > 0 && (
        <ul className="blog-concepts blog-concepts--edit">
          {value.map((id) => (
            <li key={id}>
              <button
                type="button"
                className="blog-chip is-active"
                aria-label={`${names[id]} 빼기`}
                onClick={() => onChange(value.filter((v) => v !== id))}
              >
                {names[id]} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className="blog-input"
        value={query}
        disabled={full}
        placeholder={full ? '더 고를 수 없습니다' : '개념 이름으로 찾기 — BM25, 역색인…'}
        aria-label="개념 찾기"
        onChange={(e) => setQuery(e.target.value)}
      />
      {debounced && (suggestions.data?.length ?? 0) > 0 && (
        <ul className="blog-concept-suggest" role="listbox" aria-label="개념 후보">
          {suggestions.data?.map((item) => (
            <li key={item.conceptId}>
              <button
                type="button"
                role="option"
                aria-selected={value.includes(item.conceptId)}
                disabled={value.includes(item.conceptId)}
                onClick={() => add(item.conceptId)}
              >
                <strong>{item.name}</strong>
                <span className="kh-mono">{item.conceptId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
