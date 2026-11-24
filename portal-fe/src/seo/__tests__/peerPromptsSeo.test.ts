import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { extractRoutes, permitsRoute, nginxRouteMap } from '../../../scripts/spa-routes.mjs';

const source = readFileSync('src/App.tsx', 'utf8');
const routes = extractRoutes(source);
const nginx = readFileSync('nginx.conf', 'utf8');

it('keeps prompt routes on the rank host and local development hosts', () => {
  for (const host of ['rank.1989v.com', 'localhost', '127.0.0.1', '[::1]']) {
    for (const path of ['/prompts', '/prompts/new', '/prompts/7']) expect(permitsRoute(routes, host, path)).toBe(true);
  }
  for (const host of ['1989v.com', 'blog.1989v.com', 'game.1989v.com', 'place.1989v.com', 'resume.1989v.com', 'ads.1989v.com', 'preview.example.com']) {
    for (const path of ['/prompts', '/prompts/new', '/prompts/7']) expect(permitsRoute(routes, host, path)).toBe(false);
  }
  expect(permitsRoute(routes, 'rank.1989v.com', '/Prompts')).toBe(false);
  expect(nginxRouteMap(routes)).toContain('rank\\.1989v\\.com|localhost|127\\.0\\.0\\.1');
});

it('serves the generated intro at the normal URL with a host guard', () => {
  expect(nginx).toMatch(/location = \/prompts \{\s*if \(\$peer_prompt_host = 0\) \{ return 404; \}/);
  expect(nginx).toContain('try_files /prerender/_hosts/$host/prompts.html /index.html;');
  expect(nginx).toContain('return 308 /prompts$is_args$args;');
});

it('serves only new and numeric detail entries as private noindex SPA responses', () => {
  const start = nginx.indexOf('location ~ ^/prompts/(new|[1-9][0-9]*)/?$ {');
  expect(start).toBeGreaterThan(0);
  const block = nginx.slice(start, nginx.indexOf('# Invalid prompt IDs', start));
  expect(block).toContain('if ($peer_prompt_host = 0) { return 404; }');
  expect(block).toContain('Cache-Control "private, no-store"');
  expect(block).toContain('X-Robots-Tag $private_robots_tag always;');
  expect(block).toContain('try_files /index.html =404;');
  expect(nginx).toContain('location /prompts/ { return 404; }');
});
