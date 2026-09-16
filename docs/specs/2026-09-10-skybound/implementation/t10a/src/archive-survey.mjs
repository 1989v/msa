const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
function segmentDistance(a,b,p){
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,length=dx*dx+dy*dy+dz*dz;
 const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/length)):0;
 return Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y,a.z+dz*t-p.z);
}
export function createArchiveSurvey(rings,device){
 if(!Array.isArray(rings)||rings.length!==3||!rings.every(finite)||!finite(device))throw new TypeError('Three observation rings and a finite device required');
 const points=rings.map(p=>({...p})),center={...device};let count=0,complete=false;
 const snapshot=()=>({count,total:3,complete});
 return{snapshot,reset(done=false){count=done?3:0;complete=done===true;return snapshot();},
  advance(from,to,{gliding=false,unlocked=false,paused=false}={}){
   if(!finite(from)||!finite(to))throw new TypeError('Finite flight segment required');
   if(!complete&&count<3&&gliding&&unlocked&&!paused&&Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)<=3){
    if(segmentDistance({...from,y:from.y+.85},{...to,y:to.y+.85},points[count])<=.9)count++;
   }
   return snapshot();
  },
  finish({position,grounded=false,unlocked=false,paused=false,blocked=false}={}){
   if(!finite(position))throw new TypeError('Finite recording position required');
   const reason=complete?'complete':paused?'paused':blocked?'busy':!unlocked?'locked':count!==3?'rings':!grounded?'grounded':Math.hypot(position.x-center.x,position.z-center.z)>2.2||Math.abs(position.y-center.y)>1.2?'range':null;
   if(reason)return{ok:false,reason,...snapshot()};complete=true;return{ok:true,...snapshot()};
  },
 };
}
