import { createPlatform } from './platform.mjs';
import { createUpdraft } from './updraft.mjs';
import { createRouteGuide } from '../../../t10a/src/route-guide.mjs';

export function createExpeditionView(T,col,base) {
  const root=new T.Group();root.name='western survey passage';
  const platforms=[],winds=[],locations=[],volumes=[],solidBounds=[];
  let terrain=base;
  const definitions=[
    ['north-launch','북단 출항대',-3,-42,null],
    ['relay-one','첫 바람쉼터',-20,-46,25],
    ['relay-two','두 번째 바람쉼터',-40,-54,20],
    ['relay-three','정박지 앞 쉼터',-58,-62,15],
    ['west-harbor','서부 정박지',-65,-67,null],
    ['relay-four','북서 바람쉼터',-64,-85,18],
    ['relay-five','기록섬 앞 쉼터',-59,-105,24],
    ['high-archive','높은 기록섬',-48,-126,null],
  ];
  for(const [id,label,x,z,top] of definitions){
    let y=top,markTerrain=base;
    if(top!==null){
      const pad=createPlatform(T,col,terrain,{x,z,topY:top,size:5});platforms.push(pad);root.add(pad.root);terrain=pad.terrain;
      markTerrain={heightAt:(px,pz)=>Math.abs(px-x)<=2.5&&Math.abs(pz-z)<=2.5?top:base.heightAt(px,pz)};
    }else y=base.heightAt(x,z);
    if(!Number.isFinite(y))throw new Error(`Expedition needs actual ground: ${id}`);
    locations.push({id,label,position:{x,y,z}});
    const wind=createUpdraft(T,col,{x,z,radius:1.4,minY:y-.15,maxY:y+28,speed:6},markTerrain);
    winds.push(wind);root.add(wind.root);volumes.push({...wind.volume,requiredProgress:['journeyComplete']});
    if(top===null){
      const material=new T.MeshStandardMaterial({color:col('chalk'),roughness:.9});
      for(const side of [-1,1]){
        const pillar=new T.Mesh(new T.CylinderGeometry(.2,.35,2.4,6),material);pillar.position.set(x+side*1.9,base.heightAt(x+side*1.9,z)+1.2,z);pillar.castShadow=true;root.add(pillar);pillar.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(pillar);solidBounds.push({min:{x:bounds.min.x,y:bounds.min.y,z:bounds.min.z},max:{x:bounds.max.x,y:bounds.max.y,z:bounds.max.z}});
      }
    }
  }
  const guide=createRouteGuide(locations);
  return {root,terrain,platforms,locations,volumes,solidBounds,guide,update(open,time){
    winds.forEach(wind=>{wind.root.visible=open;if(open)wind.update(time);});
  }};
}
