import {createAlignmentPuzzle,ALIGNMENT_TARGETS} from '../../../t10a/src/alignment.mjs';
export function createHarborView(T,col,terrain){
  const root=new T.Group();root.name='harbor observation dials';
  const stations=[-75,-72,-69].map(x=>({x,y:terrain.heightAt(x,-73),z:-73}));
  const puzzle=createAlignmentPuzzle(stations),needles=[],plates=[],solidBounds=[];
  const chalk=new T.MeshStandardMaterial({color:col('chalk'),roughness:.9});
  const slate=new T.MeshStandardMaterial({color:col('slate'),roughness:1});
  const brass=new T.MeshStandardMaterial({color:col('brass'),metalness:.5,roughness:.5});
  function arrow(material){
    const group=new T.Group(),shaft=new T.Mesh(new T.BoxGeometry(.065,.05,.48),material),tip=new T.Mesh(new T.ConeGeometry(.12,.27,4),material);
    shaft.position.z=.08;tip.rotation.x=Math.PI/2;tip.position.z=.45;group.add(shaft,tip);return group;
  }
  stations.forEach((position,index)=>{
    const group=new T.Group();group.position.copy(position);root.add(group);
    const plate=new T.Mesh(new T.CylinderGeometry(.65,.8,.35,12),chalk);plate.position.y=.175;plate.castShadow=true;plate.receiveShadow=true;group.add(plate);plates.push(plate);
    const ring=new T.Mesh(new T.TorusGeometry(.55,.03,6,32),brass);ring.rotation.x=-Math.PI/2;ring.position.y=.36;group.add(ring);
    const needle=arrow(brass);needle.position.y=.42;group.add(needle);needles.push(needle);
    const marker=arrow(slate);marker.rotation.y=ALIGNMENT_TARGETS[index]*Math.PI/2;marker.scale.setScalar(.5);marker.position.set(Math.sin(marker.rotation.y)*.98,.06,Math.cos(marker.rotation.y)*.98);group.add(marker);
    for(let i=0;i<=index;i++){const notch=new T.Mesh(new T.BoxGeometry(.04,.025,.14),slate);notch.position.set((i-index/2)*.13,.365,-.4);group.add(notch);}
    solidBounds.push({min:{x:position.x-.8,y:position.y,z:position.z-.8},max:{x:position.x+.8,y:position.y+.35,z:position.z+.8}});
  });
  function nearest(position){let selected=null,best=2.2;stations.forEach((station,index)=>{const d=Math.hypot(position.x-station.x,position.z-station.z);if(d<=best&&Math.abs(position.y-station.y)<=1.2){selected=index;best=d;}});return selected;}
  return {root,stations,solidBounds,meshes:plates,nearest,snapshot:puzzle.snapshot,reset:puzzle.reset,
    update(){const state=puzzle.snapshot();needles.forEach((needle,i)=>{needle.rotation.y=state.turns[i]*Math.PI/2;needle.position.y=state.turns[i]===ALIGNMENT_TARGETS[i] ? .48 : .42;});return state;},
    rotate(context){const index=nearest(context.position);return index===null?{ok:false,reason:'range',...puzzle.snapshot()}:puzzle.rotate(index,context);},
  };
}
