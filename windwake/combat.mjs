// Deterministic expanded enemy decisions. Physics, rewards and effects stay in
// the simulation behind injected hooks; this module never imports the sim/UI.
export const ENEMY_STATS = Object.freeze(Object.fromEntries(Object.entries({
  stalker: { hp:55, speed:3.3, damage:13, xp:14, name:'갈퀴 망령' },
  ranger: { hp:44, speed:2.5, damage:12, xp:16, name:'파편술사' },
  charger: { hp:95, speed:2.5, damage:22, xp:24, name:'돌갑옷' },
  slime: { hp:36, speed:2.1, damage:10, xp:12, name:'이슬 방울' },
  wolf: { hp:52, speed:4.0, damage:15, xp:18, name:'황혼 늑대' },
  boar: { hp:86, speed:2.9, damage:20, xp:22, name:'갈기 멧돼지' },
  shaman: { hp:58, speed:2.3, damage:11, xp:24, name:'숲의 주술사' },
  wisp: { hp:40, speed:3.0, damage:12, xp:20, name:'바람 도깨비불' },
  bomber: { hp:40, speed:2.8, damage:24, xp:18, name:'불씨 풍선' },
  sentinel: { hp:118, speed:1.9, damage:20, xp:28, name:'유적 파수꾼' },
  burrower: { hp:62, speed:3.1, damage:17, xp:20, name:'모래 잠복자' },
  frostling: { hp:48, speed:2.5, damage:11, xp:20, name:'서리 정령' },
  boss: { hp:740, speed:2.6, damage:23, xp:130, name:'고요의 수호자' },
}).map(([id, stats]) => [id, Object.freeze(stats)])));

export const ENEMY_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(ENEMY_STATS).map(([id, stats]) => [id, stats.name])));

const ADDED = new Set(['slime','wolf','boar','shaman','wisp','bomber','sentinel','burrower','frostling']);
const patternBoss=e=>e.type==='boss'&&!!(e.bossId||e.dungeonId);
const SEQUENCES = {
  bulwark: [['slam','charge','sweep'], ['slam','charge','ring','sweep']],
  tempest: [['bolt','ring'], ['bolt','leap','ring','bolt']],
  thorn: [['summon','sweep','slam'], ['summon','eruption','sweep']],
  tide: [['slow','ring'], ['slow','charge','eruption','ring']],
};
const DISTANCE = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const finite = (n,fallback=0) => Number.isFinite(n) ? n : fallback;
const facing = (e,p,angle) => Math.abs(Math.atan2(Math.sin(Math.atan2(p.x-e.x,p.z-e.z)-e.yaw),
  Math.cos(Math.atan2(p.x-e.x,p.z-e.z)-e.yaw))) <= angle;

function initialize(e) {
  e.homeX=finite(e.homeX,e.x); e.homeY=finite(e.homeY,e.y); e.homeZ=finite(e.homeZ,e.z);
  for(const key of ['timer','hitFlash','vx','vy','vz','yaw','attackCount','specialCooldown','hopTimer']) e[key]=finite(e[key]);
  e.phase=e.phase===2?2:1; e.state ||= 'idle';
}

function recover(e,duration) {
  // Parry/stagger may have changed state synchronously inside a damage hook.
  if(e.state==='hit'||e.hp<=0)return;
  e.state='recover';e.timer=duration;e.vx=0;e.vz=0;e.guarding=false;e.burrowed=false;
}

function physicalGround(e,dt,hooks) {
  if(e.type!=='wisp'){hooks.ground(e,dt);return;}
  // Keep a grounded support sample separate from flight height. Recovery brings
  // this enemy into sword range, even though its chase silhouette floats.
  e.hoverBaseY=finite(e.hoverBaseY,e.homeY);
  e.y=e.hoverBaseY;hooks.ground(e,dt);e.hoverBaseY=e.y;
  const target=e.state==='recover'||e.state==='attack'||e.state==='hit'?.3:e.state==='telegraph'?1.2:2.2;
  e.hoverHeight=finite(e.hoverHeight,2.2);
  e.hoverHeight+=(target-e.hoverHeight)*Math.min(1,dt*7);
  e.y=e.hoverBaseY+e.hoverHeight;e.vy=0;
}

function circleHit(s,e,hooks,{x=e.x,y=e.y,z=e.z,radius=3,damage,angle=Math.PI,jumpable=false}={}) {
  const p=s.player,origin={x,y,z};
  if(DISTANCE(origin,p)>radius||Math.abs(p.y-y)>2.4||
    (jumpable&&p.y-y>1)||!facing(e,p,angle)||!hooks.lineClear(e,p)||!hooks.lineClear(origin,p))return false;
  return hooks.damagePlayer(damage??ENEMY_STATS[e.type].damage,e);
}

function moveToward(e,target,speed,dt,hooks) {
  const d=DISTANCE(e,target);if(d<.05)return;
  e.yaw=Math.atan2(target.x-e.x,target.z-e.z);
  const amount=Math.min(d,speed*dt);
  hooks.move(e,Math.sin(e.yaw)*amount,Math.cos(e.yaw)*amount,e.type==='boss'?.85:.5);
}

function chosenPattern(s,e,hooks) {
  if(patternBoss(e)){const family=SEQUENCES[e.family]||SEQUENCES.bulwark;
    const sequence=family[e.phase-1];return sequence[e.attackCount%sequence.length];}
  if(e.type==='shaman'){
    const ally=e.specialCooldown<=0&&s.enemies.find(a=>a!==e&&!a.raid&&a.hp>0&&a.hp<a.maxHp&&
      DISTANCE(a,e)<9&&Math.abs(a.y-e.y)<3&&hooks.lineClear(e,a));
    e.supportTarget=ally?ally.id:null;return ally?'summon':'bolt';
  }
  return {slime:'leap',wolf:'leap',boar:'charge',wisp:DISTANCE(e,s.player)<4?'leap':'bolt',
    bomber:'burst',sentinel:'sweep',burrower:'eruption',frostling:'slow'}[e.type];
}

function settings(e,pattern) {
  const boss=patternBoss(e);
  const radius={slam:boss?5:2.7,ring:9,charge:2.3,bolt:0,sweep:boss?5.5:3.6,
    eruption:boss?3.6:2.8,summon:0,slow:boss?3.8:2.7,leap:boss?4.5:e.type==='wolf'?2.6:2.4,burst:4.7}[pattern];
  const range={slam:5,ring:8.4,charge:11,bolt:14,sweep:boss?5:3.3,
    eruption:boss?11:6,summon:13,slow:12,leap:boss?8:e.type==='wolf'?6:3.8,burst:3.4}[pattern];
  const windup=pattern==='burst'?1.5:pattern==='eruption'?1.15:pattern==='charge'?.95:
    pattern==='slow'?1.1:pattern==='summon'?1.1:boss?(e.phase===2?.85:1.1):e.type==='wolf'?.8:.7;
  return {radius,range,windup};
}

function telegraph(s,e,pattern,hooks) {
  const {radius,windup}=settings(e,pattern),p=s.player;
  e.state='telegraph';e.pattern=pattern;e.timer=windup;e.telegraphRadius=radius;
  e.yaw=Math.atan2(p.x-e.x,p.z-e.z);e.targetX=p.x;e.targetY=p.y;e.targetZ=p.z;
  e.attackCount++;e.didHit=false;e.guarding=false;e.burrowed=e.type==='burrower';
  // These serializable target coordinates tell the renderer where a fixed
  // eruption/slow tell belongs. No tracking in the final dodge window.
  hooks.effect('telegraph',e,{life:windup,power:radius,pattern,
    targetX:e.targetX,targetY:e.targetY,targetZ:e.targetZ});
}

function summon(s,e,hooks) {
  if(e.type==='shaman'){
    const ally=s.enemies.find(a=>a.id===e.supportTarget&&a.hp>0);
    if(ally&&DISTANCE(e,ally)<9&&Math.abs(e.y-ally.y)<3&&hooks.lineClear(e,ally)){
      ally.hp=Math.min(ally.maxHp,ally.hp+Math.min(18,ally.maxHp*.2));
      hooks.effect('reward',ally,{life:.8,power:2});
    }
    e.specialCooldown=7;return;
  }
  let living=s.enemies.filter(a=>a.hp>0&&a.summonedBy===e.id).length;
  const count=Math.min(e.phase===2?2:1,3-living);
  for(let i=0;i<count;i++){
    const angle=e.attackCount*2.4+i*Math.PI,point={x:e.x+Math.sin(angle)*3,y:e.y,z:e.z+Math.cos(angle)*3};
    if(!hooks.lineClear(e,point))continue;
    const add=hooks.spawn(e.phase===2?'wolf':'slime',point.x,point.z,{summonedBy:e.id});
    if(!add)break;
    living++;hooks.effect('pulse',add,{life:.5,power:2});
  }
}

function createSlowZone(e,hooks) {
  e.zone={x:e.targetX,y:e.targetY,z:e.targetZ,radius:e.telegraphRadius,remaining:3.2};
  hooks.effect('shockwave',e.zone,{life:3.2,power:e.zone.radius,pattern:'slow'});
}

function updateZone(s,e,dt,hooks) {
  if(!e.zone)return;
  e.zone.remaining-=dt;
  if(e.zone.remaining<=0){delete e.zone;return;}
  if(DISTANCE(e.zone,s.player)<e.zone.radius&&Math.abs(e.zone.y-s.player.y)<1.4&&
    hooks.lineClear(e.zone,s.player))s.player.slowTimer=Math.max(finite(s.player.slowTimer),.45);
}

function launch(s,e,hooks) {
  const boss=patternBoss(e),pattern=e.pattern;
  hooks.emit('enemy-attack',e);
  if(pattern==='charge'||pattern==='leap'){
    e.state='attack';e.attackDuration=pattern==='charge'?.65:boss?.72:.58;e.timer=e.attackDuration;
    const speed=pattern==='charge'?boss?13:14:boss?10:e.type==='wolf'?11:6;
    e.vx=Math.sin(e.yaw)*speed;e.vz=Math.cos(e.yaw)*speed;
    if(pattern==='leap'&&e.type!=='wisp')e.vy=boss?8:6.5;
    e.didHit=false;return;
  }
  if(pattern==='bolt'){
    if(hooks.lineClear(e,s.player))hooks.shoot(e,boss?(e.phase===2?5:3):e.type==='wisp'?2:1,
      {speed:boss?11:8,damage:ENEMY_STATS[e.type].damage,spread:boss?.22:.14});
  }else if(pattern==='summon')summon(s,e,hooks);
  else if(pattern==='slow'){
    const target={x:e.targetX,y:e.targetY,z:e.targetZ};
    if(hooks.lineClear(e,target)){
      createSlowZone(e,hooks);
      if(boss)circleHit(s,e,hooks,{...target,radius:e.telegraphRadius,damage:15});
    }
    if(!boss&&hooks.lineClear(e,s.player))hooks.shoot(e,1,{kind:'frost',speed:7,damage:11,slow:2.5});
  }else{
    const targeted=pattern==='eruption';
    const origin=targeted?{x:e.targetX,y:e.targetY,z:e.targetZ}:e;
    hooks.effect('shockwave',origin,{life:.65,power:e.telegraphRadius,pattern});
    // Eruptions cannot move a burrower through a wall or reach a different floor.
    if(!targeted||Math.abs(e.targetY-e.y)<3&&hooks.lineClear(e,origin))circleHit(s,e,hooks,{
      x:origin.x,y:origin.y,z:origin.z,radius:e.telegraphRadius,
      jumpable:pattern==='ring',angle:pattern==='sweep'?1.85:pattern==='slam'?1.45:Math.PI});
    if(pattern==='burst'&&e.hp>0)hooks.hitEnemy(e,e.hp,'explosion',0);
  }
  recover(e,boss?1.45:e.type==='sentinel'?1.65:e.type==='burrower'?1.3:1.05);
}

function activeAttack(s,e,dt,hooks) {
  const before={x:e.x,z:e.z};
  hooks.move(e,e.vx*dt,e.vz*dt,patternBoss(e)?.85:.5);
  const blocked=Math.hypot(e.x-before.x,e.z-before.z)<Math.hypot(e.vx,e.vz)*dt*.15;
  const radius=e.pattern==='charge'?2:e.telegraphRadius;
  if(!e.didHit&&circleHit(s,e,hooks,{radius,angle:1.45})){e.didHit=true;}
  // A miss or a dodged contact still consumes this strike. In particular, a
  // multi-frame charge may not keep rolling damage after invulnerability ends.
  else if(!e.didHit&&DISTANCE(e,s.player)<radius&&Math.abs(e.y-s.player.y)<2.4&&
    facing(e,s.player,1.45)&&hooks.lineClear(e,s.player))e.didHit=true;
  if((e.timer<=0||blocked)&&e.state!=='hit'){
    hooks.effect('shockwave',e,{life:.45,power:radius,pattern:e.pattern});
    recover(e,patternBoss(e)?1.55:1.25);
  }
}

function leash(e,dt,hooks) {
  e.state='idle';e.guarding=e.type==='sentinel';e.burrowed=false;e.vx=0;e.vz=0;
  delete e.zone;moveToward(e,{x:e.homeX,z:e.homeZ},ENEMY_STATS[e.type].speed,dt,hooks);
}

export function updateExpandedEnemy(s,e,dt,hooks) {
  if(e.raid||(!ADDED.has(e.type)&&!patternBoss(e)))return false;
  if(!Number.isFinite(dt)||dt<=0||dt>1)return true;
  initialize(e);e.timer-=dt;e.hitFlash=Math.max(0,e.hitFlash-dt);
  e.specialCooldown=Math.max(0,e.specialCooldown-dt);e.hopTimer=Math.max(0,e.hopTimer-dt);
  if(e.hp<=0){e.state='dead';e.guarding=false;e.burrowed=false;delete e.zone;return true;}
  const boss=patternBoss(e),home={x:e.homeX,z:e.homeZ},p=s.player;
  if(boss&&e.hp<=e.maxHp*.5&&e.phase!==2){
    e.phase=2;e.attackCount=0;
    hooks.toast(`${e.name||ENEMY_NAMES.boss} · 두 번째 파동`);
    hooks.effect('pulse',e,{life:1,power:8});
  }
  updateZone(s,e,dt,hooks);
  const homeDistance=DISTANCE(e,home),playerHome=DISTANCE(p,home);
  if(homeDistance>(boss?22:28)||playerHome>(boss?36:40))leash(e,dt,hooks);
  else if(e.state==='hit'){
    e.guarding=false;e.burrowed=false;
    hooks.move(e,e.vx*dt,e.vz*dt);e.vx*=Math.pow(.84,dt*60);e.vz*=Math.pow(.84,dt*60);
    if(e.timer<=0){e.state='recover';e.timer=.35;}
  }else if(e.state==='telegraph'){
    if(e.timer<=0)launch(s,e,hooks);
  }else if(e.state==='attack')activeAttack(s,e,dt,hooks);
  else if(e.state==='recover'){
    if(e.type==='wisp'&&e.timer>.65&&DISTANCE(e,p)<5){
      const a=Math.atan2(e.x-p.x,e.z-p.z);hooks.move(e,Math.sin(a)*1.8*dt,Math.cos(a)*1.8*dt);
    }
    if(e.timer<=0)e.state='chase';
  }else{
    const d=DISTANCE(e,p),height=Math.abs(e.y-p.y),aggro=boss?30:18;
    if(d>aggro||height>6)leash(e,dt,hooks);
    else{
      e.state='chase';e.guarding=e.type==='sentinel';
      const pattern=chosenPattern(s,e,hooks),{range}=settings(e,pattern);
      if(d<=range&&(height<2.8||e.type==='wisp'||pattern==='bolt')&&hooks.lineClear(e,p))telegraph(s,e,pattern,hooks);
      else{
        let speed=ENEMY_STATS[e.type].speed*(boss&&e.phase===2?1.12:1);
        // Slimes travel in bursts with real vertical hops; wolves gain a small
        // pack pursuit bonus but retain their full individual leap tell.
        if(e.type==='slime'){
          if(e.hopTimer<=0){e.vy=4.6;e.hopTimer=.95;}
          speed*=e.hopTimer>.55?1.4:.25;
        }
        if(e.type==='wolf'&&s.enemies.some(a=>a!==e&&a.type==='wolf'&&a.hp>0&&DISTANCE(e,a)<8))speed*=1.16;
        moveToward(e,p,speed,dt,hooks);
      }
    }
  }
  // All movement, including stagger/charge, respects the regional arena limit.
  // Project the overrun back using physical movement rather than old y=28 clamps.
  if(boss){const d=DISTANCE(e,home);if(d>22){const x=home.x+(e.x-home.x)*22/d,z=home.z+(e.z-home.z)*22/d;
    hooks.move(e,x-e.x,z-e.z,.85);e.vx=0;e.vz=0;
    if(e.state==='attack')recover(e,1.5);
  }}
  physicalGround(e,dt,hooks);
  return true;
}
