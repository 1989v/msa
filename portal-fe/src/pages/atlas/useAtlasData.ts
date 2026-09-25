import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fetchConceptPostCounts, fetchPosts } from '../../api/blogApi';
import { fetchConceptRelations } from '../../api/searchApi';
import { indexGraph, type Graph, type RawGraph } from './atlasGraph';

const LONG = 10 * 60 * 1000;

/**
 * 개념 그래프는 빌드에 실린 정적 청크다 — 파일명에 해시가 붙어 Cloudflare 가장자리에서 받고
 * API 를 부르지 않는다. 구조는 한 번에, 설명은 도메인마다 따로(크기의 대부분이 설명이다).
 */
const graphChunk = import.meta.glob<{ default: RawGraph }>('./generated/graph.json');
const descChunks = import.meta.glob<{ default: Record<string, string> }>('./generated/desc/*.json');

export function useGraph() {
  return useQuery({
    queryKey: ['atlas', 'graph'],
    queryFn: async (): Promise<Graph> => indexGraph((await graphChunk['./generated/graph.json']()).default),
    staleTime: Infinity,
  });
}

/** 도메인 하나의 개념 설명 — 모르는 도메인이면 빈 표 */
export function useDescriptions(domain: string | undefined) {
  return useQuery({
    queryKey: ['atlas', 'desc', domain],
    queryFn: async () => {
      const load = descChunks[`./generated/desc/${domain}.json`];
      return load ? (await load()).default : {};
    },
    enabled: Boolean(domain),
    staleTime: Infinity,
  });
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
