// TG6 캡처 — 허브 390·1440 × ko·en × 사이트 light·dark, 상세 390 바·이동 줄 light·dark (SR-8.8). 계측 전송은 막는다
import { mkdirSync } from 'node:fs';
import { tab, sleep } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
mkdirSync(`${out}/screens/after`, { recursive: true });
for (const site of ['light', 'dark']) {
  for (const [w, h, mobile] of [[390, 844, true], [1440, 900, false]]) for (const lang of ['ko', 'en']) {
    const t = await tab(port, w, h, mobile, { dev: site, site, origin: ORIG });
    await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
    await t.send('Page.navigate', { url: ORIG + (lang === 'en' ? '/en' : '/') }); await sleep(8000);
    await t.shot(`${out}/screens/after/hub-${w}-${lang}-${site}.png`); await t.close(); console.log('hub', w, lang, site);
  }
  const t = await tab(port, 390, 844, true, { dev: site, site, origin: ORIG });
  await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
  await t.send('Page.navigate', { url: `${ORIG}/attractions/77` }); await sleep(7000);
  await t.ev(`(()=>{const f=document.querySelector('.place-detail-first');scrollTo(0,f.getBoundingClientRect().bottom+scrollY+300)})()`); await sleep(1500);
  await t.shot(`${out}/screens/after/detail-390-ko-77-bar-jump-${site}.png`); await t.close(); console.log('detail', site);
}
process.exit(0);
