import { App } from './app.ts';

const root = document.getElementById('app');
if (!root) throw new Error('#app 이 없습니다');
new App(root);
