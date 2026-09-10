import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';

/**
 * 코드 하이라이팅. **쓰는 언어만 등록한다.**
 *
 * `highlight.js` 전체를 부르면 190여 개 언어가 통째로 딸려 온다. 여기 목록은 발행된
 * 글에서 실제로 쓰인 것(bash 16 · json 7 · python 3 · ts 2 · js 2 · yaml · tsx ·
 * markdown · java · css)에 이 레포에서 나올 만한 것(kotlin · sql)을 더한 것이다.
 * 없는 언어는 하이라이트 없이 그대로 나가므로 글이 깨지지 않는다 — 자주 쓰게 되면
 * 그때 한 줄 추가한다.
 *
 * `mermaid` 는 여기 오지 않는다. `inlineDiagrams` 가 marked 앞에서 SVG 로 바꾼다.
 */
const LANGUAGES: Record<string, LanguageFn> = {
  bash,
  css,
  java,
  javascript,
  json,
  kotlin,
  markdown,
  python,
  sql,
  typescript,
  yaml,
};

type LanguageFn = Parameters<typeof hljs.registerLanguage>[1];

for (const [name, fn] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, fn);
}

/** 글에서 쓰는 약칭 → 등록된 이름. 없는 것은 그대로 넘겨 조회에 실패시킨다. */
const ALIAS: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  kt: 'kotlin',
  yml: 'yaml',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
};

/** 정규화한 언어 이름. 등록돼 있지 않으면 `null`. */
export function resolveLanguage(lang: string | undefined): string | null {
  if (!lang) return null;
  const key = lang.trim().toLowerCase().split(/\s+/)[0];
  if (!key) return null;
  const name = ALIAS[key] ?? key;
  return hljs.getLanguage(name) ? name : null;
}

/**
 * 하이라이트한 HTML. 등록되지 않은 언어면 `null` 을 돌려주고, 부르는 쪽이 평문으로 낸다.
 *
 * `ignoreIllegals` 를 켜는 이유 — 글의 코드 조각은 대개 **일부만 잘라 온 것**이라
 * 문법적으로 완결되지 않는다. 끄면 그런 조각에서 예외가 나 코드 블록이 통째로 사라진다.
 */
export function highlightCode(code: string, lang: string | undefined): string | null {
  const name = resolveLanguage(lang);
  if (!name) return null;
  try {
    return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}
