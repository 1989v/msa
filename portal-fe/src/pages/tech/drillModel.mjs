// tech 드릴다운 데이터 — code-dictionary 의 DrillExportSpec 이 온톨로지에서 만든 `src/content/drill/<domain>.json`.
// 그리는 규칙(어떤 개념이 노드 · 간선 · 묶음이 되나)은 내보내기 쪽에만 있다. 여기는 읽고 검사하는 것뿐이다.
// 페이지(TS)와 프리렌더 · 렌더 스크립트(Node)가 같이 쓰므로 .mjs 로 둔다.

/** @typedef {'LIVE' | 'PARTIAL' | 'DISABLED' | 'NONE'} AppliedStatus */

/** @type {Record<AppliedStatus, string>} */
export const STATUS_LABEL = { LIVE: '운영 중', PARTIAL: '일부 구현', DISABLED: '비활성', NONE: '미구현' };

const REPO_BLOB = 'https://github.com/1989v/msa/blob/';

/**
 * 스니펫과 같은 코드를 가리키는 GitHub 주소 — 빌드 커밋으로 고정한다. 커밋을 모르는 개발 빌드는 main.
 * @param {{ path: string, start: number, end: number }} ref
 * @param {string} gitSha
 */
export function codeUrl(ref, gitSha) {
  const rev = gitSha && gitSha !== 'dev' ? gitSha : 'main';
  return `${REPO_BLOB}${rev}/${ref.path}#L${ref.start}-L${ref.end}`;
}

/**
 * 모양 검사 — 어기면 throw. 노드 · 묶음 · 관련 개념 · 간선이 가리키는 개념이 모두 있어야 한다.
 * @param {any} drill
 */
export function assertDrill(drill) {
  const fail = (m) => {
    throw new Error(`드릴다운 데이터가 계약과 다르다: ${m}`);
  };
  if (!drill || typeof drill !== 'object') fail('객체가 아니다');
  const { root, concepts, diagrams } = drill;
  if (typeof root !== 'string' || !concepts?.[root]) fail(`루트 ${root} 가 개념에 없다`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(drill.updated ?? '')) fail('updated 가 YYYY-MM-DD 가 아니다');
  if (!Number.isInteger(drill.maxDepth) || drill.maxDepth < 1) fail('maxDepth 가 1 이상의 정수가 아니다');
  if (!diagrams?.[root]) fail('루트 그림이 없다');
  for (const [id, c] of Object.entries(concepts)) {
    if (typeof c.name !== 'string' || typeof c.description !== 'string') fail(`${id} 의 이름 · 설명`);
    if (c.applied && !(c.applied.status in STATUS_LABEL)) fail(`${id} 의 상태 ${c.applied.status}`);
    for (const ref of c.code ?? []) {
      if (!ref.path || !(ref.start >= 1) || !(ref.end >= ref.start) || typeof ref.snippet !== 'string') fail(`${id} 의 코드 ${ref.path}`);
    }
  }
  for (const [owner, d] of Object.entries(diagrams)) {
    if (!concepts[owner]) fail(`그림 주인 ${owner} 가 개념에 없다`);
    const ids = new Set();
    for (const n of d.nodes) {
      if (!concepts[n.id]) fail(`${owner} 그림의 노드 ${n.id}`);
      ids.add(n.id);
      for (const l of n.lanes ?? []) if (!concepts[l]) fail(`${owner} 그림의 묶음 ${l}`);
    }
    for (const e of d.edges) if (!ids.has(e.from) || !ids.has(e.to)) fail(`${owner} 그림의 간선 ${e.from} → ${e.to}`);
    for (const r of d.related) if (!concepts[r]) fail(`${owner} 의 관련 개념 ${r}`);
  }
}

/**
 * 개념 id → 그 개념을 연 펼침 경로(그림 주인 · 고른 개념 쌍의 목록). 루트에서 넓게 훑어 가장 얕은 경로를 쓴다.
 * 해시(`#개념 id`)로 연 페이지가 그 단계까지 펼친 상태를 되살리는 데 쓴다.
 * @param {{ root: string, diagrams: Record<string, { nodes: { id: string, lanes?: string[] }[], related: string[] }> }} drill
 * @returns {Map<string, { owner: string, id: string }[]>}
 */
export function openPaths(drill) {
  const paths = new Map();
  let frontier = [{ owner: drill.root, path: [] }];
  while (frontier.length) {
    const next = [];
    for (const { owner, path } of frontier) {
      const d = drill.diagrams[owner];
      if (!d) continue;
      const opened = d.nodes.flatMap((n) => [n.id, ...(n.lanes ?? [])]).concat(d.related);
      for (const id of opened) {
        if (paths.has(id)) continue;
        const p = [...path, { owner, id }];
        paths.set(id, p);
        next.push({ owner: id, path: p });
      }
    }
    frontier = next;
  }
  return paths;
}
