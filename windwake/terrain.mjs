// Pure metre-space heightfield primitives. No chunks, actors or renderer imports.
export const TERRAIN=Object.freeze({version:2,step:3,maxCachedVertices:32768,frequency:1/145,octaves:4,lacunarity:2,gain:.46});
const mix=(a,b,t)=>a+(b-a)*t;
const fade=t=>t*t*t*(t*(t*6-15)+10);
function lattice(x,z,seed){let h=(seed^Math.imul(x,374761393)^Math.imul(z,668265263))>>>0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295*2-1;}
export function valueNoise(x,z,seed=0){const ix=Math.floor(x),iz=Math.floor(z),u=fade(x-ix),v=fade(z-iz);return mix(mix(lattice(ix,iz,seed),lattice(ix+1,iz,seed),u),mix(lattice(ix,iz+1,seed),lattice(ix+1,iz+1,seed),u),v);}
export function fbm(x,z,seed=0,octaves=TERRAIN.octaves){let sum=0,weight=1,total=0;for(let i=0;i<octaves;i++){sum+=valueNoise(x,z,seed+i*1013)*weight;total+=weight;weight*=TERRAIN.gain;x*=TERRAIN.lacunarity;z*=TERRAIN.lacunarity;}return sum/total;}
export function landformHeight(x,z,seed,relief=1){
  const f=TERRAIN.frequency,large=fbm(x*f,z*f,seed),ridge=1-Math.abs(valueNoise(x/105,z/105,seed+771));
  // Smooth broad ridges with shallow high-frequency detail; no per-cell jitter.
  return relief*(large*39+(ridge*ridge-.5)*26+fbm(x/42,z/42,seed+913,2)*2.2);
}
// Mesh emits a,d,c and a,c,b; the diagonal is a=(0,0) to c=(1,1).
export function triangleHeight(x,z,vertex,step=TERRAIN.step){
  const gx=Math.floor(x/step)*step,gz=Math.floor(z/step)*step,u=(x-gx)/step,v=(z-gz)/step,a=vertex(gx,gz);
  if(u===0&&v===0)return a;
  const c=vertex(gx+step,gz+step);
  return u>=v?a+(vertex(gx+step,gz)-a)*(u-v)+(c-a)*v:a+(vertex(gx,gz+step)-a)*(v-u)+(c-a)*u;
}
let cachedVertices=0;
export function createHeightfield(sample,{maxVertices=TERRAIN.maxCachedVertices}={}){
  const vertices=new Map();
  const vertex=(x,z)=>{const key=`${x},${z}`;if(vertices.has(key))return vertices.get(key);const h=sample(x,z);vertices.set(key,h);if(vertices.size>maxVertices)vertices.delete(vertices.keys().next().value);cachedVertices=vertices.size;return h;};
  return{heightAt:(x,z)=>triangleHeight(x,z,vertex),vertex,stats:()=>({cachedVertices:vertices.size,maxVertices})};
}
export function terrainStats(){return{cachedVertices,maxCachedVertices:TERRAIN.maxCachedVertices};}
