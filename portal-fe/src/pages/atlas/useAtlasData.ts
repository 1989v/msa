import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchConceptPostCounts, fetchPosts } from '../../api/blogApi';
import { fetchAtlas, fetchConceptHierarchy, fetchConceptRelations } from '../../api/searchApi';
import { buildTree } from './atlasModel';

const LONG = 10 * 60 * 1000;

export function useAtlas() {
  return useQuery({ queryKey: ['atlas'], queryFn: fetchAtlas, staleTime: LONG });
}

/** 개념 id → 그 개념을 관리하는 도메인. 도메인 간 관계에 「다른 도메인」 표식을 붙일 때 쓴다 */
export function useOwnerIndex() {
  const atlas = useAtlas();
  return useMemo(() => {
    const owner = new Map<string, string>();
    for (const d of atlas.data?.domains ?? []) for (const id of d.conceptIds) owner.set(id, d.domain);
    return owner;
  }, [atlas.data]);
}

/** 개념별 발행글 수. 블로그가 죽어도 아틀라스는 그대로 그린다 — 실패는 빈 표로 */
export function usePostCounts() {
  const q = useQuery({
    queryKey: ['blog', 'concept-counts'],
    queryFn: fetchConceptPostCounts,
    staleTime: LONG,
    retry: false,
  });
  return useMemo(() => new Map((q.data ?? []).map((c) => [c.conceptId, c.postCount])), [q.data]);
}

export function useDomainTree(rootId: string | undefined) {
  const q = useQuery({
    queryKey: ['hierarchy', rootId],
    queryFn: () => fetchConceptHierarchy(rootId),
    enabled: Boolean(rootId),
    staleTime: LONG,
  });
  const tree = useMemo(() => (q.data && rootId ? buildTree(q.data, rootId) : null), [q.data, rootId]);
  return { tree, isLoading: q.isLoading, isError: q.isError };
}

export function useRelations(conceptId: string | undefined) {
  return useQuery({
    queryKey: ['relations', conceptId],
    queryFn: () => fetchConceptRelations(conceptId as string),
    enabled: Boolean(conceptId),
    staleTime: LONG,
  });
}

export function useConceptPosts(conceptId: string | undefined) {
  return useQuery({
    queryKey: ['blog', 'posts', 'concept', conceptId],
    queryFn: () => fetchPosts({ concept: conceptId, size: 10 }),
    enabled: Boolean(conceptId),
    staleTime: LONG,
    retry: false,
  });
}

const RAW_BASE = 'https://raw.githubusercontent.com/1989v/msa/main/';
export const GITHUB_BLOB = 'https://github.com/1989v/msa/blob/main/';
const SNIPPET_LINES = 12;

export interface CodeSnippet {
  /** 1부터 센 줄 번호 */
  startLine: number;
  lines: string[];
}

/**
 * 코드 원본은 레포다 — 사본을 저장하지 않고 GitHub 원본을 받아 심볼이 처음 나오는 줄부터 보인다.
 * 줄 번호를 파일에 적지 않으므로 코드가 움직여도 여기서 다시 찾는다.
 */
export async function fetchSnippet(path: string, symbol: string): Promise<CodeSnippet | null> {
  const res = await fetch(RAW_BASE + path);
  if (!res.ok) return null;
  const all = (await res.text()).split('\n');
  const at = all.findIndex((line) => line.includes(symbol));
  if (at < 0) return null;
  const lines = all.slice(at, at + SNIPPET_LINES);
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  return { startLine: at + 1, lines: lines.map((l) => l.slice(indent)) };
}

export function useSnippet(path: string, symbol: string) {
  return useQuery({
    queryKey: ['snippet', path, symbol],
    queryFn: () => fetchSnippet(path, symbol),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}
