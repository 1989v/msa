import {COMBO_STAGES} from './melee.mjs';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

// One timeline drives the weapon, arm, body turn and visible trail.
export function attackPose(combo,elapsed) {
  const index=clamp((combo||1)-1,0,2),stage=COMBO_STAGES[index];
  const t=clamp((elapsed||0)/stage.duration),contact=stage.impact/stage.duration;
  const swing=smooth((t-(contact-.18))/.34),recovery=smooth((t-.72)/.28);
  let hand,tip,twist;
  if(index===0){
    const angle=mix(-1.7,1.55,swing);
    hand=[Math.sin(angle)*.58,1.10,.18+Math.cos(angle)*.48];
    tip=[Math.sin(angle)*1.9,1.14,.18+Math.cos(angle)*1.9];twist=mix(-.25,.30,swing);
  }else if(index===1){
    const angle=mix(1.55,-1.35,swing),height=mix(.48,1.85,swing);
    hand=[Math.sin(angle)*.57,height,.30+Math.cos(angle)*.42];
    tip=[Math.sin(angle)*1.75,height+mix(-.45,.70,swing),.35+Math.cos(angle)*1.7];twist=mix(.28,-.28,swing);
  }else{
    const angle=mix(-1.9,1.20,swing);
    hand=[.20,1.35-Math.sin(angle)*.62,.15+Math.cos(angle)*.62];
    tip=[.13,1.45-Math.sin(angle)*1.95,.15+Math.cos(angle)*1.95];twist=0;
  }
  hand=hand.map((v,i)=>mix(v,[.45,.95,.18][i],recovery));
  tip=tip.map((v,i)=>mix(v,[.91,.38,.66][i],recovery));
  return {hand,tip,twist:twist*(1-recovery),phase:t,active:t>contact-.12&&t<contact+.23,stage:stage.id};
}

// Depth-limited vegetation cutout. No wall/actor material uses this mask.
export function foliageVisibility(point,eye,target) {
  const d=target.map((v,i)=>v-eye[i]),length=Math.hypot(...d);
  if(length<.05)return 1;
  const v=point.map((n,i)=>n-eye[i]),along=v.reduce((sum,n,i)=>sum+n*d[i]/length,0);
  if(along<0||along>=length-.12)return 1;
  const radial=Math.hypot(...v.map((n,i)=>n-d[i]/length*along));
  return mix(.025,1,smooth((radial-.72)/.78));
}

export const FOLIAGE_FRAGMENT=`
float foliageVisibility(vec3 point) {
  vec3 segment = uFocus-uEye;
  float len = length(segment);
  if (len < 0.05) return 1.0;
  vec3 axis = segment/len;
  vec3 offset = point-uEye;
  float along = dot(offset,axis);
  if (along < 0.0 || along >= len-0.12) return 1.0;
  float radial = length(offset-axis*along);
  return mix(0.025,1.0,smoothstep(0.72,1.5,radial));
}
`;
