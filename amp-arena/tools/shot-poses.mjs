// 포즈 갤러리 스크린샷: /poses.html 을 게임 각도·옆·앞에서 찍는다. 사용: node tools/shot-poses.mjs <cdpPort> <baseUrl> <outDir>
import { Page } from './cdp-page.mjs';

const [port, base = 'http://127.0.0.1:5180', out = '.'] = process.argv.slice(2);
for (const view of ['game', 'side', 'front']) {
  const page = new Page(port);
  try {
    await page.open(`${base}/poses.html?view=${view}`, { width: 1400, height: 540 });
    await page.waitFor(`window.__posesReady === true`, { timeout: 15000 });
    await page.sleep(300);
    await page.shot(`${out}/poses-${view}.png`);
    console.log(`poses-${view}.png · errors ${page.errors.length}`);
    for (const e of page.errors.slice(0, 3)) console.log('  !', e.slice(0, 200));
  } finally {
    await page.close();
  }
}
