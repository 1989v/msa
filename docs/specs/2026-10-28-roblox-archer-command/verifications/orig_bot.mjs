// 원작 marine-command 의 Sim 을 그대로 실행해 로블록스판 오라클의 창을 잰다.
// 실행: node docs/specs/2026-10-28-roblox-archer-command/verifications/orig_bot.mjs  (레포 루트에서, Node 22)
// 정책 'still': 리더 본진 정지 · 자동 사격 · 금화가 되면 armor<=attack ? armor : attack 을 1단씩(합 5까지) · 500G 되면 hire carpenter
// 정책 'circle': 위와 같되 치료사 주위 반경 100px 원을 돈다 (원작 tests/outpost.test.mjs opening)
// 정책 'still-noup': 정지 · 강화 없음
// 정책 'nofire': 리더 사격 금지(cooldown 1e9, garrison) → 첫 웨이브가 본진에 실제 피해를 주는 시각 (원작 outpost.test.mjs:28 의 15~30초)
import { createCampaignGame, act, step, price } from '../../../../portal-fe/public/games/marine-command/js/origin/sim.js';
import { createWorld, MAP_VERSION } from '../../../../portal-fe/public/games/marine-command/js/origin/map.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function run(seed, policy){
  const w=createWorld(), s=createCampaignGame(seed,{mode:'solo'},w);
  if(policy==='nofire'){s.wave.next=8;s.units[0].assignment='garrison';s.units[0].cooldown=1e9;}
  let carpenterAt=null, firstBaseHit=null, upgrades=0, died=null;
  for(let i=0;i<30*120 && s.phase==='playing';i++){
    let input={};
    if(policy==='circle'){const squad=s.owners[0].squad,h=w.neutralHealer,angle=s.time*Math.PI/4,target={x:h.x+100*Math.cos(angle),y:h.y+100*Math.sin(angle)},d=dist(squad,target);input={0:{x:(target.x-squad.x)/Math.max(1,d),y:(target.y-squad.y)/Math.max(1,d)}};}
    step(s,1/30,input,w);
    const o=s.owners[0];
    if(policy==='still'||policy==='circle'){const stat=o.upgrades.armor<=o.upgrades.attack?'armor':'attack';const cost=price(s,0,stat);if(carpenterAt===null && o.upgrades.attack+o.upgrades.armor<5 && o.gold>=cost){act(s,{type:'upgrade',ownerId:0,stat,count:1},w);upgrades++;}}
    if(policy!=='nofire' && carpenterAt===null && o.gold>=500){const r=act(s,{ownerId:0,type:'hire',kind:'carpenter'},w); if(r.ok) carpenterAt=s.time;}
    if(firstBaseHit===null && s.base.hp<s.base.maxHp) firstBaseHit=s.time;
    if(policy!=='nofire' && !s.units.some(u=>u.kind!=='carpenter')&&died===null) died=s.time;
    if(policy==='nofire' && firstBaseHit!==null) break;
    if(died!==null) break;
  }
  return {seed,policy,carpenterAt,firstBaseHit,died,phase:s.phase,gold:Math.round(s.owners[0].gold),upgrades};
}
console.log('MAP_VERSION',MAP_VERSION);
for(const policy of ['still','circle','still-noup','nofire']){
  const rows=[];for(let seed=1;seed<=20;seed++)rows.push(run(seed,policy));
  const died=rows.map(r=>r.died).filter(v=>v!==null), hit=rows.map(r=>r.firstBaseHit).filter(v=>v!==null), carp=rows.map(r=>r.carpenterAt).filter(v=>v!==null);
  const mm=a=>a.length?`${Math.min(...a).toFixed(2)}~${Math.max(...a).toFixed(2)} (n=${a.length})`:'none';
  console.log(policy,'| leaderDied',mm(died),'| firstBaseHit',mm(hit),'| carpenter',mm(carp));
  console.log(' ',policy,'per-seed',rows.map(r=>(policy==='nofire'?r.firstBaseHit:r.died)?.toFixed(2)).join(' '));
}
