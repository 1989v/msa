import { App } from './app.ts';
import { installForcedLandscape } from './ui/orient.ts';

const root = document.getElementById('app');
if (!root) throw new Error('#app 이 없습니다');
installForcedLandscape(root); // 터치 기기가 세로면 뿌리를 90° 돌려 가로로 (2026-09-12 소감: 모바일도 가로로)
new App(root);
