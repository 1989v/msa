import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPose,foliageVisibility} from '../presentation.mjs';
import {COMBO_STAGES} from '../melee.mjs';
import {Renderer} from '../render.mjs';
import {heightAt} from '../world.mjs';

function fixture(){
  let next=0;const live=new Set(),sources=[];
  const gl=new Proxy({createBuffer(){const b=++next;live.add(b);return b;},deleteBuffer(b){assert.ok(live.delete(b));},
    createShader(){return{};},createProgram(){return{};},getShaderParameter(){return true;},getProgramParameter(){return true;},
    getAttribLocation(){return 0;},getUniformLocation(){return{};},shaderSource(shader,source){sources.push(source);}},
    {get:(o,k)=>o[k]??(/^[A-Z_0-9]+$/.test(k)?1:()=>{})});
  return {sources,live,canvas:{clientWidth:1280,clientHeight:800,width:1280,height:800,getContext:()=>gl,
    getBoundingClientRect:()=>({width:1280,height:800}),addEventListener(){},removeEventListener(){}}};
}

test('three basic strikes move the weapon through distinct planes on the hit timeline',()=>{
  const paths=COMBO_STAGES.map((stage,i)=>Array.from({length:21},(_,n)=>attackPose(i+1,stage.duration*n/20)));
  for(const path of paths)for(const p of path)assert.ok([...p.hand,...p.tip,p.twist].every(Number.isFinite));
  const range=(path,axis)=>Math.max(...path.map(p=>p.tip[axis]))-Math.min(...path.map(p=>p.tip[axis]));
  assert.ok(range(paths[0].slice(0,14),0)>3&&range(paths[0].slice(0,14),1)<.1);
  assert.ok(range(paths[1].slice(0,14),1)>2);
  assert.ok(range(paths[2].slice(0,14),1)>2&&range(paths[2].slice(0,14),0)<.05);
  for(let i=0;i<3;i++)assert.ok(attackPose(i+1,COMBO_STAGES[i].impact).active);
});

test('foliage cutout affects only the intervening 1.5m camera corridor',()=>{
  const eye=[0,3,-8],target=[0,1,0],middle=[0,2,-4];
  assert.ok(foliageVisibility(middle,eye,target)<.03);
  assert.equal(foliageVisibility([2,2,-4],eye,target),1);
  assert.equal(foliageVisibility([0,.5,2],eye,target),1);
  assert.equal(foliageVisibility([0,4,-10],eye,target),1);
  assert.equal(foliageVisibility([0,0,0],[0,0,0],[0,0,0]),1);
});

test('canopies carry vegetation material while rocks and actors keep opaque material',()=>{
  const f=fixture(),r=new Renderer(f.canvas);r.buildingMesh=r.dynamic;
  r.dynamic.clear();r.staticProp({type:'pine',x:0,y:0,z:0});
  const tree=[...r.dynamic.data.subarray(0,r.dynamic.length)].filter((v,i)=>i%11===10);
  assert.ok(tree.includes(3),'canopy is explicitly eligible for visibility treatment');
  r.dynamic.clear();r.staticProp({type:'rock',x:0,y:0,z:0});
  assert.ok([...r.dynamic.data.subarray(0,r.dynamic.length)].filter((v,i)=>i%11===10).every(v=>v!==3));
  assert.ok(f.sources.some(s=>s.includes('foliageVisibility')&&s.includes('discard')));
  r.dispose();assert.equal(f.live.size,0);
});

test('solid occlusion pulls in immediately but returns smoothly within one second',()=>{
  const f=fixture(),r=new Renderer(f.canvas),y=heightAt(0,-72);
  const s={frame:1,player:{x:0,y,z:-72},blocks:[{x:0,y:y-2,z:-77,w:6,d:1,h:10}]};
  r.updateCamera(s,{yaw:0,pitch:.25,distance:9},1/60);
  const reach=()=>Math.hypot(...r.eye.map((v,i)=>v-r.target[i])),blocked=reach();
  assert.ok(blocked<5);
  s.blocks=[];s.frame++;r.updateCamera(s,{yaw:0,pitch:.25,distance:9},1/60);
  assert.ok(reach()>blocked&&reach()<blocked+1,'no outward camera snap');
  for(let i=0;i<60;i++){s.frame++;r.updateCamera(s,{yaw:0,pitch:.25,distance:9},1/60);}
  assert.ok(reach()>=9*.95);
  s.blocks=[{x:0,y:y-2,z:-75,w:6,d:1,h:10}];s.frame++;r.updateCamera(s,{yaw:0,pitch:.25,distance:9},1/60);
  assert.ok(reach()<3,'inward correction is immediate even after outward damping');
  r.dispose();assert.equal(f.live.size,0);
});
