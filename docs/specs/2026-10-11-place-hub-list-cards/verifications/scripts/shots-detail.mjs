// TG6 상세 캡처만 — 390 첫 화면(바 숨김) · 바 표시 + 이동 줄 고정 · 문서 끝. 뷰포트 그대로 찍는다(clip 은 문서 좌표라 스크롤 뒤에 어긋난다)
import { mkdirSync } from 'node:fs';
import { tab, sleep } from '../../../2026-10-10-place-screen-polish/verifications/scripts/lib.mjs';
const [, , port, out, ORIG = 'https://place.1989v.com'] = process.argv;
mkdirSync(`${out}/screens/after`, { recursive: true });
for (const [lang, id] of [['ko', 77], ['en', 13808], ['ko', 47]]) {
  const t = await tab(port, 390, 844, true);
  await t.send('Network.setBlockedURLs', { urls: ['*/api/v1/events*'] });
  await t.send('Page.navigate', { url: `${ORIG}${lang === 'en' ? '/en' : ''}/attractions/${id}` }); await sleep(6000);
  await t.shot(`${out}/screens/after/detail-390-${lang}-${id}-top.png`);
  await t.ev(`(()=>{const f=document.querySelector('.place-detail-first');scrollTo(0,f.getBoundingClientRect().bottom+scrollY+300)})()`); await sleep(1500);
  await t.shot(`${out}/screens/after/detail-390-${lang}-${id}-bar-jump.png`);
  await t.ev(`scrollTo(0,document.documentElement.scrollHeight)`); await sleep(1500);
  await t.shot(`${out}/screens/after/detail-390-${lang}-${id}-end.png`);
  await t.close(); console.log('shot', lang, id);
}
process.exit(0);
