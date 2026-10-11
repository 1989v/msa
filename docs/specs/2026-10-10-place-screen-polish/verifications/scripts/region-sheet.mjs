// 지역 시트 글자 — 시군구 목록(열린 첫 화면)과 「‹ 시·도」로 돌아간 시도 목록, 390 · 4조합
import { writeFileSync } from 'node:fs';
import { tab, sleep, CONTRAST_JS } from './lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com', tag = 'pre'] = process.argv;
const HUB = /localhost|127\.0\.0\.1/.test(ORIG) ? '/place' : '/';
const texts = `(()=>{${CONTRAST_JS};const s=[...document.querySelectorAll('.kh-sheet')].pop();return s?__texts(s):[]})()`;
const res = [];
for (const dev of ['light', 'dark']) for (const site of ['light', 'dark']) {
  const t = await tab(port, 390, 844, true, { dev, site, origin: ORIG });
  await t.send('Page.navigate', { url: ORIG + HUB }); await sleep(8000);
  await t.ev(`document.querySelector('.place-region-trigger')?.click()`); await sleep(2000);
  const sigungu = await t.ev(texts);
  const back = await t.ev(`(()=>{const b=[...document.querySelectorAll('.kh-sheet .place-region-row')].find(x=>/시·도|Provinces/.test(x.textContent));if(b)b.click();return !!b})()`); await sleep(1500);
  const sido = await t.ev(texts);
  res.push({ dev, site, sigungu, back, sido }); await t.close();
}
writeFileSync(`${out}/region-sheet-${tag}.json`, JSON.stringify(res, null, 1)); console.log('region done'); process.exit(0);
