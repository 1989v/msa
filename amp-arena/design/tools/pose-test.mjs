// 포즈·악세서리 확인용 임시 렌더 — 산출물은 스크래치패드로.
import { writeFileSync } from 'node:fs';
import { figure, figureFront, POSES, svgWrap } from '../canvas/gen/figure.mjs';
import { T, doc } from '../canvas/gen/tokens.mjs';

const out = process.argv[2];
const poses = Object.keys(POSES);
const cells = poses.map((pz, i) => {
  const acc = ['greatsword', 'spear', 'pistol', 'shield', 'rocket'][i % 5];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
    ${svgWrap(figure({ x: 70, y: 130, s: 1, pose: pz, shirt: T.slot[i % 8], acc: i % 2 ? acc : null }), { w: 140, h: 140, vb: '0 0 140 140' })}
    <div style="font-size:12px;color:${T.muted}">${pz}${i % 2 ? ' · ' + acc : ''}</div></div>`;
});
cells.push(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${svgWrap(figureFront({ x: 70, y: 130 }), { w: 140, h: 140, vb: '0 0 140 140' })}<div style="font-size:12px;color:${T.muted}">front</div></div>`);
cells.push(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${svgWrap(figure({ x: 70, y: 130, facing: -1, pose: 'attack2', acc: 'greatsword', shirt: T.slot[1] }), { w: 140, h: 140, vb: '0 0 140 140' })}<div style="font-size:12px;color:${T.muted}">left · greatsword</div></div>`);
cells.push(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${svgWrap(figure({ x: 70, y: 130, s: 2.2, pose: 'idle' }), { w: 140, h: 140, vb: '-70 -150 280 280' })}<div style="font-size:12px;color:${T.muted}">idle ×2.2</div></div>`);

const body = `<div style="width:1280px;padding:20px;background:${T.bg};display:grid;grid-template-columns:repeat(8, minmax(0, 1fr));gap:10px">${cells.join('')}</div>`;
writeFileSync(out, doc({ body }));
console.log('wrote', out, poses.length, 'poses');
