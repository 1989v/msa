// Only named, authored ground points can enter persistence. Never save player coordinates.
export const CHECKPOINTS=Object.freeze([
  Object.freeze({id:'camp',label:'야영지',x:0,z:35}),
  Object.freeze({id:'west-harbor',label:'서부 정박지',x:-65,z:-67}),
  Object.freeze({id:'high-archive',label:'기록섬',x:-48,z:-124.4}),
]);
export function validCheckpoint(id,progress) {
  return CHECKPOINTS.some(point=>point.id===id)&&(id==='camp'||progress.journeyComplete===true);
}
export function restoreCheckpoint(progress,points) {
  return points.find(point=>point.id===progress.checkpointId&&validCheckpoint(point.id,progress))??points[0];
}
export function reachedCheckpoint(progress,position,grounded,points) {
  if(!grounded)return null;
  return points.find(point=>validCheckpoint(point.id,progress)&&Math.hypot(point.x-position.x,point.z-position.z)<=1.8&&Math.abs(point.y-position.y)<=.7)??null;
}
