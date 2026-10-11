// 상세 — 표본 10곳 × 390·1280 + 보조 표본(390): 요금·쉬는 날·길찾기 bottom, actions top·높이
import { writeFileSync, readFileSync } from 'node:fs';
import { tab, sleep, BUNDLE_JS } from './lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
const IDS = { ko: [77, 4811, 16151, 12933, 2961], en: [13863, 13808, 18083, 14580, 14367] };
const supp = JSON.parse(readFileSync(new URL('./supp-ids.json', import.meta.url), 'utf8'));
const PROBE = `(()=>{
 const s=document.querySelector('[data-place-section="visit-summary"]'); const dds=s?[...s.querySelectorAll('dd')]:[]; const dts=s?[...s.querySelectorAll('dt')]:[];
 const act=document.querySelector('[data-place-section="actions"]');const acts=act?[...act.querySelectorAll('a')]:[];
 const dir=acts.find(a=>/길찾기|Directions|길 찾기/i.test(a.textContent));
 const R=(e)=>e?Math.round(e.getBoundingClientRect().bottom):null;
 const ar=act?act.getBoundingClientRect():null;
 const order=[...document.querySelectorAll('[data-place-section]')].map(e=>e.dataset.placeSection).slice(0,8);
 return {title:(document.querySelector('h1')||{}).textContent?.trim().slice(0,30), vh:innerHeight, hasSummary:!!s,
  fee:{label:dts[0]?.textContent.trim(),bottom:R(dds[0])}, closed:{label:dts[2]?.textContent.trim(),bottom:R(dds[2])},
  dir:{bottom:R(dir)}, actions:ar?{top:Math.round(ar.top),h:Math.round(ar.height)}:null, summaryTop:s?Math.round(s.getBoundingClientRect().top):null,
  phone:!!(act&&act.querySelector('.place-detail-phone')), order, js:${BUNDLE_JS}}})()`;
const res = { at: new Date().toISOString(), main: [], supp: [] };
const one = async (w, h, mobile, lang, id) => {
  const t = await tab(port, w, h, mobile);
  await t.send('Page.navigate', { url: `${ORIG}${lang === 'en' ? '/en' : ''}/attractions/${id}` }); await sleep(6000);
  const p = await t.ev(PROBE); await t.close(); return { vp: `${w}x${h}`, lang, id, ...p };
};
for (const [w, h, mobile] of [[390, 844, true], [1280, 800, false]])
  for (const lang of ['ko', 'en']) for (const id of IDS[lang]) res.main.push(await one(w, h, mobile, lang, id));
for (const [group, list] of Object.entries(supp)) for (const id of list) res.supp.push({ group, ...(await one(390, 844, true, group.endsWith('en') ? 'en' : 'ko', id)) });
writeFileSync(`${out}/detail.json`, JSON.stringify(res, null, 1)); console.log('detail done'); process.exit(0);
