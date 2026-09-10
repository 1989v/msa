// Scene-viewer bounds only; gameplay collision belongs to T02.
export const CAMERA = Object.freeze({target: Object.freeze([0,19,-12]), minDistance:60, maxDistance:260,
  minPolarAngle:.2, maxPolarAngle:1.42, minAzimuthAngle:-.9, maxAzimuthAngle:1.2});
export function viewport(width,height,dpr=1,mobile=false){
  const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
  return {width:w,height:h,aspect:w/h,pixelRatio:Math.min(mobile?1.5:2,Math.max(1,Number.isFinite(dpr)?dpr:1))};
}
export function framing(aspect){
  const safe=Number.isFinite(aspect)&&aspect>0?aspect:1;
  return Math.min(CAMERA.maxDistance,Math.hypot(43,14,79)*Math.max(1,1/safe));
}
export function resizedDistance(distance,previousAspect,nextAspect){
  return Math.min(CAMERA.maxDistance,Math.max(CAMERA.minDistance,distance*framing(nextAspect)/framing(previousAspect)));
}
export function resetPosition(aspect){
  const scale=framing(aspect)/Math.hypot(43,14,79);
  return CAMERA.target.map((v,i)=>v+[43,14,79][i]*scale);
}
