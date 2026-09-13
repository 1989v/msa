import { createReceiver } from '../../../t04b/src/receiver.mjs';
import { sampleGroundSupport } from './ground-support.mjs';

export function createReceiverView(THREE, col, terrain, prism) {
  const center = { x: 1.6, y: prism.position.y, z: 33 };
  const support = sampleGroundSupport(terrain, prism, { position: center, yaw: 90 });
  if (support.reason) throw new Error('Receiver target footprint needs sampled support');
  const rule = createReceiver({ prismId: prism.id, x: center.x, z: center.z, width: 1.15, depth: 1.65, baseY: support.pose.position.y-prism.size.y/2 });
  const root = new THREE.Group(); root.name = 'first prism receiver';
  const points = [], b = rule.receiver.bounds;
  const corners = [[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ],[b.minX,b.minZ]];
  for (let i=0;i<4;i++) for(let step=0;step<8;step++) for(const t of [step/8,(step+1)/8]) {
    const x=corners[i][0]+(corners[i+1][0]-corners[i][0])*t, z=corners[i][1]+(corners[i+1][1]-corners[i][1])*t;
    const floor=terrain.heightAt(x,z); if(!Number.isFinite(floor)) throw new Error('Receiver outline leaves terrain');
    points.push(x,floor+.025,z);
  }
  // Long-axis line and arrow identify the required quarter-turn direction.
  for(const [x,z] of [[1.6,32.5],[1.6,33.5],[1.6,32.5],[1.45,32.7],[1.6,32.5],[1.75,32.7]]) points.push(x,terrain.heightAt(x,z)+.03,z);
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  const material=new THREE.LineBasicMaterial({color:col('brass')}); root.add(new THREE.LineSegments(geometry,material));
  let state=rule.evaluate(null,null,{reset:true});
  function update(manipulation, paused) { state=rule.evaluate(state,manipulation,{paused}); material.color.copy(col(state.complete?'meadow':'brass')); return state; }
  function reset() { state=rule.evaluate(state,null,{reset:true}); material.color.copy(col('brass')); return state; }
  return {root,update,reset,snapshot:()=>state};
}
