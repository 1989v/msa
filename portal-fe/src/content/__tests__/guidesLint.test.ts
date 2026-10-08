// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/*
 * 편집 페이지 원본의 문체 게이트 — 블로그와 같은 lint(docs/conventions/blog-writing.md)를 `--body-only` 로 돌린다.
 * 머리말은 블로그 4필드와 달라 F1 만 건너뛰고, F2~F8(요약 표 포함)은 그대로 본다.
 * python3 가 없으면 skip 이다 — 통과로 세지 않는다.
 */

const LINT = fileURLToPath(new URL('../../../../scripts/lint-blog-post.py', import.meta.url));
const GUIDES = fileURLToPath(new URL('../guides/', import.meta.url));
const hasPython = spawnSync('python3', ['--version']).status === 0;
const lint = (path: string) => spawnSync('python3', [LINT, path, '--body-only'], { encoding: 'utf8' });

const files = readdirSync(GUIDES).filter((f) => f.endsWith('.md'));

describe.skipIf(!hasPython)('편집 페이지 lint --body-only', () => {
  it('원본이 한 장 이상 있다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s → 종료 코드 0', (name) => {
    const r = lint(join(GUIDES, name));
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  describe('옵션 자체', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guides-lint-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));
    const head = ['---', 'title: 가이드', 'status: draft', 'attractionIds: [1]', '---', ''];
    const write = (name: string, lines: string[]) => {
      const path = join(dir, name);
      writeFileSync(path, [...head, ...lines, ''].join('\n'));
      return path;
    };

    it('블로그 4필드가 없는 머리말이어도 F1 을 내지 않는다', () => {
      const r = lint(write('ok.md', ['| 후보 | 조건 |', '|---|---|', '| 가 | 무료 |', '', '## 후보', '', '무료로 들어간다.']));
      expect(r.status, r.stdout).toBe(0);
      expect(r.stdout).not.toContain('F1');
    });

    it('첫 h2 앞 요약 표가 없으면 F8 로 실패한다', () => {
      const r = lint(write('no-summary.md', ['## 후보', '', '무료로 들어간다.']));
      expect(r.status).not.toBe(0);
      expect(r.stdout).toContain('F8');
    });

    it('옵션 없이 부르면 지금처럼 F1 을 낸다', () => {
      const r = spawnSync('python3', [LINT, join(dir, 'ok.md')], { encoding: 'utf8' });
      expect(r.status).not.toBe(0);
      expect(r.stdout).toContain('F1');
    });
  });
});
