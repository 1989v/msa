// Run from any directory: node docs/research/2026-10-07-tourism-growth/build-report.mjs
// Requires the existing portal-fe development dependency `marked`; output is standalone.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const require = createRequire(import.meta.url);
const { marked } = await import(require.resolve('marked', { paths: [path.join(root, 'portal-fe')] }));
const markdown = await readFile(path.join(here, 'README.md'), 'utf8');
const heritage = await readFile(path.join(root, 'portal-fe/src/styles/k-heritage.css'), 'utf8');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Copy approved light-theme token values, expressing source hex constants as RGB.
// Report consumers only use these variables; no palette is introduced here.
const tokenNames = ['kh-hanji', 'kh-giwa', 'kh-pine', 'kh-ocher-text', 'ko-surface-1', 'ko-surface-2', 'ko-text-secondary'];
const tokens = tokenNames.map(name => {
  const match = heritage.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})\\s*;`, 'i'));
  if (!match) throw new Error(`Missing design token: ${name}`);
  const channels = match[1].match(/../g).map(value => parseInt(value, 16));
  return `--${name}: rgb(${channels.join(' ')});`;
}).join('\n  ');

const rendered = marked.parse(markdown, { gfm: true, breaks: false });
const parts = rendered.split(/(<h2>.*?<\/h2>)/g);
const sections = [];
for (let i = 1; i < parts.length; i += 2) {
  const heading = parts[i].slice(4, -5);
  const number = heading.match(/^(\d+)\./)?.[1];
  if (!number) throw new Error(`Section lacks a number: ${heading}`);
  let tableCount = 0;
  const content = (parts[i + 1] ?? '').replace(/<table>/g, () => {
    tableCount += 1;
    return `<div class="table-wrap" role="region" aria-label="${number}장 표 ${tableCount}" tabindex="0"><table>`;
  }).replace(/<\/table>/g, '</table></div>');
  sections.push({ number, heading, html: `<section id="section-${number}" aria-labelledby="heading-${number}"><h2 id="heading-${number}">${heading}</h2>${content}</section>` });
}
if (sections.length !== 12) throw new Error(`Expected 12 sections, got ${sections.length}`);
const intro = parts[0].replace('<h1>', '<h1 id="report-title">');
const toc = sections.map(({ number, heading }) => `<li><a href="#section-${number}">${heading}</a></li>`).join('\n');

const document = `<!doctype html>
<html lang="ko" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="K-관광 운영 관찰과 공식 자료를 바탕으로 한 제품, 콘텐츠, 검색 노출, 유통 전략의 의사결정용 성장 분석. 조사일 2026-10-07.">
<title>K-관광 성장 분석 — place.1989v.com</title>
<style>
/* Source: DESIGN.md §12 and portal-fe/src/styles/k-heritage.css light tokens. */
:root {
  ${tokens}
  --paper: var(--kh-hanji); --ink: var(--kh-giwa); --secondary: var(--ko-text-secondary);
  --line: color-mix(in srgb, var(--kh-giwa) 16%, transparent);
  --line-strong: color-mix(in srgb, var(--kh-giwa) 28%, transparent);
  --font: Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --mono: "SF Mono", "JetBrains Mono", Monaco, Consolas, monospace;
  color-scheme: only light;
}
* { box-sizing: border-box; }
html { scroll-padding-top: 24px; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.8 var(--font); -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }
a { color: var(--kh-pine); text-underline-offset: 4px; overflow-wrap: anywhere; }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 2px solid var(--kh-pine); outline-offset: 4px; }
.skip { position: absolute; top: 8px; left: 16px; transform: translateY(-160%); padding: 8px 16px; background: var(--paper); z-index: 3; }
.skip:focus { transform: none; }
.masthead { border-top: 4px solid var(--ink); border-bottom: 1px solid var(--line-strong); }
.masthead-inner { max-width: 1280px; margin: auto; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.wordmark { font-size: 14px; font-weight: 700; letter-spacing: .04em; }
.tools { display: flex; align-items: center; gap: 16px; font-size: 14px; }
.tools a { display: inline-flex; align-items: center; min-height: 44px; }
button { min-height: 44px; padding: 8px 16px; border: 1px solid var(--line-strong); border-radius: 4px; background: transparent; color: var(--ink); font: inherit; cursor: pointer; }
button:hover { background: var(--ko-surface-2); }
.layout { max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 232px minmax(0, 1fr); gap: 64px; padding: 48px 32px 96px; }
.toc { position: sticky; top: 24px; align-self: start; max-height: calc(100vh - 48px); overflow: auto; }
.toc h2 { font-size: 14px; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line-strong); }
.toc ol { list-style: none; margin: 0; padding: 0; }
.toc li { border-bottom: 1px solid var(--line); }
.toc a { display: block; min-height: 44px; padding: 8px 0; color: var(--secondary); font-size: 14px; line-height: 1.5; text-decoration: none; }
.toc a:hover, .toc a:focus { color: var(--kh-pine); text-decoration: underline; }
main { min-width: 0; }
.hero { padding-bottom: 32px; }
.eyebrow { margin: 0 0 20px; font: 12px/1.5 var(--mono); letter-spacing: .08em; color: var(--kh-ocher-text); }
h1 { font-size: clamp(30px, 4vw, 48px); line-height: 1.3; letter-spacing: -.04em; margin: 0 0 24px; max-width: 24ch; word-break: keep-all; }
.hero blockquote { margin: 0; padding: 16px 0; border: 0; background: transparent; color: var(--secondary); font-size: 14px; }
.hero blockquote p { margin: 0; max-width: none; }
section { padding: 40px 0 16px; border-top: 1px solid var(--line-strong); scroll-margin-top: 24px; }
section h2 { margin: 0 0 24px; font-size: 24px; line-height: 1.5; letter-spacing: -.025em; word-break: keep-all; }
h3 { font-size: 18px; line-height: 1.6; margin: 32px 0 12px; word-break: keep-all; }
p { margin: 16px 0; max-width: 76ch; overflow-wrap: anywhere; }
strong { font-weight: 700; }
ul, ol { padding-left: 24px; margin: 16px 0 24px; }
li { margin: 8px 0; overflow-wrap: anywhere; }
blockquote { padding: 12px 20px; margin: 24px 0; border-left: 3px solid var(--kh-pine); background: var(--ko-surface-1); }
blockquote p { margin: 8px 0; }
.table-wrap { max-width: 100%; overflow-x: auto; margin: 24px 0; border: 1px solid var(--line-strong); border-radius: 4px; }
table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14px; line-height: 1.7; }
th, td { text-align: left; vertical-align: top; padding: 12px 16px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
th { background: var(--ko-surface-2); font-weight: 600; }
tbody tr:last-child td { border-bottom: 0; }
td:first-child { min-width: 112px; }
code { font-family: var(--mono); font-size: .875em; padding: 2px 4px; background: var(--ko-surface-2); border-radius: 4px; overflow-wrap: anywhere; }
pre { overflow-x: auto; background: var(--ko-surface-1); border: 1px solid var(--line); padding: 20px; border-radius: 4px; font-size: 14px; line-height: 1.7; }
pre code { background: transparent; padding: 0; border-radius: 0; font-size: inherit; white-space: pre; }
.footer { max-width: 1280px; margin: auto; padding: 24px 32px 48px; border-top: 1px solid var(--line-strong); color: var(--secondary); font-size: 14px; }
@media (max-width: 1023px) {
  .layout { grid-template-columns: minmax(0, 1fr); gap: 32px; max-width: 880px; padding-top: 32px; }
  .toc { position: static; max-height: none; }
  .toc ol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; }
  .hero { padding-bottom: 24px; }
}
@media (max-width: 639px) {
  .masthead-inner { padding: 12px 20px; gap: 4px; }
  .tools { gap: 12px; }
  .layout { padding: 24px 20px 64px; gap: 24px; }
  .toc ol { grid-template-columns: minmax(0, 1fr); }
  .toc a { font-size: 14px; }
  h1 { font-size: 30px; }
  section { padding-top: 32px; }
  section h2 { font-size: 24px; }
  th, td { padding: 12px; }
  .footer { padding-inline: 20px; }
}
@media print {
  @page { size: A4; margin: 18mm 16mm; }
  body { font-size: 10pt; line-height: 1.6; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .skip, .tools, .toc { display: none; }
  .masthead-inner { padding: 8px 0; }
  .layout { display: block; max-width: none; padding: 24px 0 0; }
  h1 { font-size: 24pt; max-width: none; }
  section { padding: 20px 0 8px; }
  section h2 { font-size: 16pt; }
  h3 { font-size: 12pt; }
  h1, h2, h3 { break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  .table-wrap { overflow: visible; border: 0; }
  table { min-width: 0; font-size: 8pt; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { padding: 6px 8px; border: 1px solid var(--line); }
  td:first-child { min-width: 0; }
  pre { white-space: pre-wrap; overflow: visible; padding: 12px; font-size: 8pt; }
  pre code { white-space: pre-wrap; }
  a { text-decoration: underline; }
  .footer { padding: 16px 0 0; font-size: 9pt; }
}
</style>
</head>
<body>
<a class="skip" href="#report-title">본문으로 건너뛰기</a>
<header class="masthead"><div class="masthead-inner"><span class="wordmark">K-관광 / RESEARCH</span><div class="tools"><a href="README.md">Markdown 원문</a><a href="https://place.1989v.com/">대상 서비스</a><button id="print" type="button" hidden>인쇄 / PDF 저장</button></div></div></header>
<div class="layout">
<nav class="toc" aria-label="보고서 목차"><h2>목차 · 12개 장</h2><ol>${toc}</ol></nav>
<main aria-labelledby="report-title"><div class="hero"><p class="eyebrow">PRODUCT · CONTENT · SEO · DISTRIBUTION</p>${intro}</div>${sections.map(s => s.html).join('\n')}</main>
</div>
<footer class="footer">2026-10-07 조사 · 의사결정용 제안 · <a href="README.md">전체 원문</a> · 근거 자료와 외부 출처는 해당 주장 가까이에 연결했습니다.</footer>
<script>
const printButton = document.getElementById('print');
printButton.hidden = false;
printButton.addEventListener('click', () => window.print());
</script>
</body>
</html>
`;
await writeFile(path.join(here, 'report.html'), document);
console.log(`Generated report.html: ${sections.length} sections, ${document.length.toLocaleString()} characters.`);
