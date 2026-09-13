export const DODGE=Object.freeze({duration:.28,speed:7,cost:20,cooldown:.6,invulnerability:.18});
export function isDodgeInvulnerableAt(state,time) {
  return state.startedAt!==null && time>=state.startedAt && time<state.startedAt+DODGE.invulnerability-1e-9;
}
export function createDodge() {
  let startedAt=null,direction=Object.freeze({x:0,z:1}),lastReason=null;
  function snapshot(time) {
    if(!Number.isFinite(time)||time<0)throw new RangeError('Finite nonnegative dodge clock required');
    const elapsed=startedAt===null?0:Math.max(0,time-startedAt);
    return Object.freeze({startedAt,direction,elapsed,active:startedAt!==null&&elapsed<DODGE.duration-1e-9,
      invulnerable:isDodgeInvulnerableAt({startedAt},time),cooldown:startedAt===null?0:Math.max(0,DODGE.cooldown-elapsed),lastReason});
  }
  return Object.freeze({snapshot,
    request(time,{grounded,blocked=false,stamina,x,z}) {
      const before=snapshot(time);
      if(![grounded,blocked].every(v=>typeof v==='boolean')||![stamina,x,z].every(Number.isFinite)||stamina<0)throw new TypeError('Dodge input invalid');
      const length=Math.hypot(x,z);if(length<1e-9)throw new RangeError('Dodge direction required');
      lastReason=blocked?'blocked':!grounded?'grounded':before.cooldown>1e-9?'cooldown':stamina<DODGE.cost?'stamina':null;
      if(lastReason)return false;
      startedAt=time;direction=Object.freeze({x:x/length,z:z/length});return true;
    },
    reset(){startedAt=null;direction=Object.freeze({x:0,z:1});lastReason=null;},
  });
}
