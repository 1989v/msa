const point = p => p && ['x','y','z'].every(k => Number.isFinite(p[k]));
// Feet coordinates; the caller shares this position with rendering and both combat rules.
export function createPatrol({ home, terrain, canMove = () => true }) {
  if (!point(home) || typeof terrain?.heightAt !== 'function' || typeof canMove !== 'function') throw new TypeError('Patrol home and terrain required');
  const origin = Object.freeze({...home});
  const waypoints = [{x:home.x+1,z:home.z-1.2}, {x:home.x-1,z:home.z+1.2}];
  let position={...home}, yaw=0, mode='patrol', waypoint=0, blocked=false;
  const snapshot=()=>Object.freeze({position:Object.freeze({...position}),yaw,mode,waypoint,blocked});
  return Object.freeze({snapshot,
    reset(){position={...origin};yaw=0;mode='patrol';waypoint=0;blocked=false;return snapshot();},
    advance(dt, player, {paused=false, stopped=false, defeated=false}={}) {
      if(!Number.isFinite(dt)||dt<0||dt>.25||!point(player)||![paused,stopped,defeated].every(v=>typeof v==='boolean')) throw new TypeError('Invalid patrol frame');
      if(paused||dt===0)return snapshot();
      if(defeated){mode='defeated';return snapshot();}
      if(stopped)return snapshot();
      let remaining=dt;
      while(remaining>1e-10){
        const step=Math.min(1/120,remaining);remaining-=step;
        const distance=Math.hypot(player.x-position.x,player.z-position.z);
        const homeDistance=Math.hypot(player.x-origin.x,player.z-origin.z);
        let target;
        if(homeDistance<=6 && distance<=4 && Math.abs(player.y-position.y)<=1.2){mode='approach';target=player;}
        else if(mode==='approach'||mode==='return'){
          mode='return';target=origin;
          if(Math.hypot(position.x-origin.x,position.z-origin.z)<.02){mode='patrol';target=waypoints[waypoint];}
        } else {mode='patrol';target=waypoints[waypoint];}
        const dx=target.x-position.x,dz=target.z-position.z,length=Math.hypot(dx,dz);
        if(length>1e-9)yaw=Math.atan2(dx,dz);
        const travel=Math.min(1.2*step,Math.max(0,length-(mode==='approach'?1.8:0)));
        if(travel<=1e-9){if(mode==='patrol')waypoint=1-waypoint;continue;}
        const candidate={x:position.x+dx/length*travel,y:position.y,z:position.z+dz/length*travel};
        const heights=[[0,0],[-.45,-.45],[-.45,.45],[.45,-.45],[.45,.45]].map(([x,z])=>terrain.heightAt(candidate.x+x,candidate.z+z));
        blocked=heights.some(y=>!Number.isFinite(y)||Math.abs(y-position.y)>.5);
        if(!blocked){candidate.y=heights[0];blocked=canMove(Object.freeze({...position}),Object.freeze(candidate))!==true;}
        if(blocked){if(mode==='patrol')waypoint=1-waypoint;break;}
        position={...candidate};
      }
      return snapshot();
    },
  });
}
