const finitePosition = p => p && ['x','y','z'].every(k => Number.isFinite(p[k]));
export function hitEligibility(attacker, target, lineOfSight = () => true) {
  if (!finitePosition(attacker?.position) || !finitePosition(target) || !Number.isFinite(attacker.yaw)) throw new TypeError('Finite attacker pose and target required');
  const dx=target.x-attacker.position.x, dz=target.z-attacker.position.z, distance=Math.hypot(dx,dz);
  if(distance>2+1e-9) return 'range';
  if(Math.abs(target.y-(attacker.position.y+.8))>1.2+1e-9) return 'height';
  if(distance>1e-9 && (dx*Math.sin(attacker.yaw)+dz*Math.cos(attacker.yaw))/distance<.5-1e-9) return 'direction';
  const from=Object.freeze({...attacker.position,y:attacker.position.y+1.2});
  if(lineOfSight(from,Object.freeze({...target}))!==true) return 'occluded';
  return null;
}

export function createTarget({ position, lineOfSight = () => true }) {
  if(!finitePosition(position) || typeof lineOfSight!=='function') throw new TypeError('Finite target and LOS callback required');
  let target=Object.freeze({...position});
  let hp=3, swing=null, sequence=0, lastReason=null, hitAge=1;
  const snapshot=()=>Object.freeze({hp,maxHp:3,defeated:hp===0,target,sequence,swing:swing?Object.freeze({...swing}):null,lastReason,hitAge});
  return Object.freeze({
    snapshot,
    setPosition(value){if(!finitePosition(value))throw new TypeError('Finite target required');target=Object.freeze({...value});},
    beginSwing() {
      if(swing && swing.time<.86) return false;
      swing={id:++sequence,time:0,consumed:false};lastReason=null;return true;
    },
    advance(dt,attacker,{paused=false}={}) {
      if(!Number.isFinite(dt)||dt<0||typeof paused!=='boolean') throw new TypeError('Finite nonnegative dt and pause flag required');
      if(paused || dt===0) return snapshot();
      // Validate before modifying clocks, including during a non-hitting frame.
      if(!finitePosition(attacker?.position)||!Number.isFinite(attacker.yaw)) throw new TypeError('Finite attacker required');
      const next=swing?{...swing,time:Math.min(.86,swing.time+dt)}:null;
      let reason=null;
      const crossing=next && !next.consumed && next.time>=.29 && swing.time<.29;
      if(crossing && hp>0) reason=hitEligibility(attacker,target,lineOfSight);
      hitAge=Math.min(1,hitAge+dt);
      if(crossing) {
        next.consumed=true;lastReason=hp===0?'defeated':reason;
        if(hp>0&&!reason) { hp--;hitAge=0; }
      }
      swing=next;return snapshot();
    },
    cancelSwing() { swing=null;return snapshot(); },
    reset() { hp=3;swing=null;sequence=0;lastReason=null;hitAge=1;return snapshot(); },
  });
}
