const validPoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
function delta(dt) { if(!Number.isFinite(dt)||dt<0||dt>2) throw new RangeError('Guardian dt must be within 0..2 seconds'); }
export function createPlayerHealth() {
  let hp=3,invulnerable=0;
  const snapshot=()=>Object.freeze({hp,maxHp:3,invulnerable});
  return Object.freeze({snapshot,
    advance(dt){delta(dt);invulnerable=Math.max(0,invulnerable-dt);return snapshot();},
    hit(){if(hp===0||invulnerable>1e-9)return false;hp--;invulnerable=1;return true;},
    restore(){hp=3;invulnerable=0;return snapshot();},
  });
}

export function createGuardian({position,lineOfSight=()=>true}) {
  if(!validPoint(position)||typeof lineOfSight!=='function')throw new TypeError('Guardian position/LOS required');
  const center=Object.freeze({...position}),health=createPlayerHealth();
  let phase='idle',remaining=0,locked=null,strikes=0,respawnRequested=false;
  const snapshot=()=>Object.freeze({phase,remaining,locked,position:center,strikes,player:health.snapshot(),respawnRequested});
  function reachable(player) {
    return Math.hypot(player.x-center.x,player.z-center.z)<=2.5+1e-9
      &&Math.abs(player.y+.8-center.y)<=1.2+1e-9
      &&lineOfSight(center,Object.freeze({...player,y:player.y+1.2}))===true;
  }
  function restorePlayer(){health.restore();phase='recovery';remaining=1.2;locked=null;respawnRequested=false;return snapshot();}
  return Object.freeze({snapshot,restorePlayer,
    reset(){health.restore();phase='idle';remaining=0;locked=null;strikes=0;respawnRequested=false;return snapshot();},
    advance(dt,player,{paused=false,defeated=false,respawned=false}={}) {
      delta(dt);if(!validPoint(player)||![paused,defeated,respawned].every(v=>typeof v==='boolean'))throw new TypeError('Guardian frame invalid');
      if(respawned)return restorePlayer();
      if(paused||dt===0)return snapshot();
      if(defeated){phase='defeated';remaining=0;locked=null;health.advance(dt);return snapshot();}
      if(respawnRequested)return snapshot();
      let budget=dt;
      while(budget>1e-10) {
        if(phase==='idle') {
          if(!reachable(player)){health.advance(budget);break;}
          phase='windup';remaining=.8;locked=Object.freeze({...player});
        }
        const step=Math.min(budget,remaining);health.advance(step);remaining=Math.max(0,remaining-step);budget-=step;
        if(remaining>1e-10)break;
        if(phase==='windup') {
          strikes++;
          if(Math.hypot(player.x-locked.x,player.z-locked.z)<=.8+1e-9&&Math.abs(player.y-locked.y)<=1.2+1e-9&&reachable(player)) {
            health.hit();if(health.snapshot().hp===0)respawnRequested=true;
          }
          phase='recovery';remaining=1.2;locked=null;
          if(respawnRequested)break;
        } else {phase='idle';remaining=0;}
      }
      return snapshot();
    },
  });
}
