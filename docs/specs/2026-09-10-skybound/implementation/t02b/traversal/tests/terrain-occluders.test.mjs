import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../../../../../portal-fe/node_modules/three/build/three.module.js';
import { createWorld, topHeight } from '../../../t01b/src/world.mjs';
import { createTerrainOccluders } from '../src/terrain-occluders.mjs';

test('nearby patches preserve terrain ray hits across seams and reduce candidate triangles',()=>{
  const world=createWorld(T),surfaces=[world.root.getObjectByName('continuous meadow'),world.root.children.find(o=>o.name.startsWith('walkable-looking'))];
  const patches=createTerrainOccluders(T,surfaces),ray=new T.Raycaster();
  for(const x of [-12,-8,0,8,12])for(const z of [-30,0,30]){
    const origin=new T.Vector3(x,topHeight(x,z)+4,z),direction=new T.Vector3(.15,-1,.1).normalize();
    ray.set(origin,direction);ray.far=10;
    const original=ray.intersectObjects(surfaces,false)[0],actual=ray.intersectObjects(patches.nearbyMeshes(x,z,10),false)[0];
    assert.equal(Boolean(actual),Boolean(original));
    if(original)assert.ok(Math.abs(actual.distance-original.distance)<1e-5,`${x},${z}`);
  }
  const total=surfaces.reduce((sum,mesh)=>sum+mesh.geometry.index.count,0);
  const nearby=patches.nearbyMeshes(0,35,10).reduce((sum,mesh)=>sum+mesh.geometry.attributes.position.count,0);
  assert.ok(nearby<total*.35,`${nearby}/${total}`);
});
