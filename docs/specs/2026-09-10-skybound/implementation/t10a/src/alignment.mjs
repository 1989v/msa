export const ALIGNMENT_TARGETS=Object.freeze([1,2,3]);
export function createAlignmentPuzzle(stations,completed=false){
  if(!Array.isArray(stations)||stations.length!==3||stations.some(p=>!['x','y','z'].every(k=>Number.isFinite(p?.[k]))))throw new TypeError('Three finite observation stations required');
  const positions=stations.map(p=>({...p}));let turns=completed?[...ALIGNMENT_TARGETS]:[0,0,0],complete=completed===true;
  const snapshot=()=>({turns:[...turns],aligned:turns.filter((turn,i)=>turn===ALIGNMENT_TARGETS[i]).length,complete});
  return {snapshot,reset(done=false){turns=done?[...ALIGNMENT_TARGETS]:[0,0,0];complete=done===true;return snapshot();},
    rotate(index,{position,grounded=false,unlocked=false,paused=false,blocked=false}={}){
      if(!Number.isInteger(index)||index<0||index>=3||!['x','y','z'].every(k=>Number.isFinite(position?.[k])))throw new TypeError('Valid station and player position required');
      const station=positions[index];
      const reason=complete?'complete':paused?'paused':blocked?'busy':!unlocked?'locked':!grounded?'grounded':Math.hypot(position.x-station.x,position.z-station.z)>2.2||Math.abs(position.y-station.y)>1.2?'range':null;
      if(reason)return{ok:false,reason,...snapshot()};
      turns[index]=(turns[index]+1)%4;complete=turns.every((turn,i)=>turn===ALIGNMENT_TARGETS[i]);return{ok:true,...snapshot()};
    }};
}
