// 0건 칩(.is-empty) 실측 — 판정 밖(Q6). 1440 「필터」 다이얼로그에서 속성 칩 둘을 건 뒤 다이얼로그 안 글자 전부, 4조합
import { writeFileSync } from 'node:fs';
import { tab, sleep, CONTRAST_JS } from './lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
const HUB = /localhost|127\.0\.0\.1/.test(ORIG) ? '/place' : '/';
const texts = `(()=>{${CONTRAST_JS};const s=[...document.querySelectorAll('.kh-sheet')].pop();return s?__texts(s):[]})()`;
const settle = async (t) => { for (let i = 0; i < 30; i++) { if ((await t.ev(`document.querySelector('.place-list')?.getAttribute('aria-busy')`)) === 'false') break; await sleep(300); } await sleep(2000); };
const res = [];
for (const dev of ['light', 'dark']) for (const site of ['light', 'dark']) {
  const t = await tab(port, 1440, 900, false, { dev, site, origin: ORIG });
  await t.send('Page.navigate', { url: ORIG + HUB }); await sleep(8000);
  await t.ev(`document.querySelector('.place-filter-open')?.click()`); await sleep(1300);
  for (const a of ['parking', 'admissionFree']) { await t.ev(`document.querySelector('.kh-sheet .place-attr-chip[data-attr="${a}"]')?.click()`); await settle(t); }
  const all = await t.ev(texts);
  res.push({ dev, site, empty: all.filter((x) => x.isEmpty), below45: all.filter((x) => !x.isEmpty && x.ratio < 4.5), n: all.length });
  await t.close();
}
writeFileSync(`${out}/empty-chip.json`, JSON.stringify(res, null, 1)); console.log('empty done'); process.exit(0);
