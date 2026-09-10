import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {createWorld} from './world.mjs';
import {CAMERA,viewport,resizedDistance,resetPosition} from './camera.mjs';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const retry=document.querySelector('#retry'),resetButton=document.querySelector('#reset');
const qa=window.__SKYBOUND_VIEWER__={ready:false,sceneReady:false,error:null,running:false,frames:0};
retry.onclick=()=>location.reload();
function fail(message,error){Object.assign(qa,{ready:false,sceneReady:false,error:String(error),running:false});status.textContent=message;retry.hidden=false;resetButton.disabled=true;}

try{
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new T.Scene(),{root,stats,col}=createWorld(T);scene.add(root);scene.background=col('sky');scene.fog=new T.FogExp2(col('horizon'),.003);
 scene.add(new T.HemisphereLight(col('cloud'),col('chalkShade'),1.5));
 const sun=new T.DirectionalLight(col('cloud'),3.3);sun.position.set(-50,100,50);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:220});sun.shadow.normalBias=.08;scene.add(sun);
 // Sky gradient is scene geometry, not the reference image or a background plate.
 const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{zenith:{value:col('sky')},horizon:{value:col('horizon')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 zenith;uniform vec3 horizon;varying vec3 v;void main(){float t=smoothstep(-.08,.42,normalize(v).y);gl_FragColor=vec4(mix(horizon,zenith,t),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
 // Includes must begin on their own line for the shader preprocessor.
 skyMat.fragmentShader=skyMat.fragmentShader.replace(';#include',';\n#include');
 scene.add(new T.Mesh(new T.SphereGeometry(800,32,20),skyMat));
 const water=new T.Mesh(new T.PlaneGeometry(1800,1800),new T.ShaderMaterial({uniforms:{water:{value:col('sea')},foam:{value:col('cloud')},haze:{value:col('horizon')},time:{value:0}},vertexShader:'varying vec3 w;void main(){vec4 p=modelMatrix*vec4(position,1.);w=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:`uniform vec3 water;uniform vec3 foam;uniform vec3 haze;uniform float time;varying vec3 w;void main(){float a=sin(w.x*.13+w.z*.21)+sin(w.x*.37-w.z*.17);float ripple=pow(max(0.,sin(w.x*.9+w.z*1.8+sin(w.z*.7)+sin(w.x*.4)+time*.35)),38.)*smoothstep(.2,.9,sin(w.x*2.1-w.z*1.3));float glow=pow(max(0.,1.-abs(w.x+45.)/85.),4.)*.1;vec3 c=water*(.78+a*.045)+foam*(ripple*.025+glow);float distanceHaze=1.-exp(-length(w.xz-cameraPosition.xz)*.0028);c=mix(c,haze,distanceHaze);gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}));water.rotation.x=-Math.PI/2;water.position.y=-18;scene.add(water);
 // A few high cumulus banks leave the route and cliff faces clear.
 const cloudMat=new T.MeshStandardMaterial({color:col('cloud'),emissive:col('cloud'),emissiveIntensity:.65,roughness:1,fog:false});
 const cloudGeo=new T.SphereGeometry(1,14,10);let s=71;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
 const clouds=new T.InstancedMesh(cloudGeo,cloudMat,200),o=new T.Object3D();
 for(let i=0;i<200;i++){const bank=Math.floor(i/20),x=-240+bank*54,z=-240-(bank%3)*70;const r=4+rnd()*8;o.position.set(x+(rnd()-.5)*45,43+(bank%4)*9+rnd()*13,z+rnd()*15);o.scale.set(r*1.15,r*.9,r);o.updateMatrix();clouds.setMatrixAt(i,o.matrix);}scene.add(clouds);
 const camera=new T.PerspectiveCamera(48,1,.1,1800);
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)');
 let controls,contextLost=false,running=false,elapsed=0,lastTime=null,firstSize=true;
 // Assign the scalar bounds separately: OrbitControls.target remains a Vector3.
 const makeControls=()=>{controls?.dispose();controls=new OrbitControls(camera,canvas);for(const key of ['minDistance','maxDistance','minPolarAngle','maxPolarAngle','minAzimuthAngle','maxAzimuthAngle'])controls[key]=CAMERA[key];controls.target.set(...CAMERA.target);controls.enablePan=false;controls.enableDamping=!motion.matches;controls.rotateSpeed=.65;controls.zoomSpeed=.8;};
 makeControls();
 const bounds=new T.Box3().setFromObject(root);
 Object.assign(qa,{...stats,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
 const snapshot=()=>{Object.assign(qa,{camera:{position:camera.position.toArray(),target:controls.target.toArray(),distance:camera.position.distanceTo(controls.target),polar:controls.getPolarAngle(),azimuth:controls.getAzimuthalAngle(),aspect:camera.aspect,minDistance:controls.minDistance,maxDistance:controls.maxDistance},reducedMotion:motion.matches,pixelRatio:renderer.getPixelRatio(),viewport:{width:canvas.clientWidth,height:canvas.clientHeight,bufferWidth:canvas.width,bufferHeight:canvas.height},waterTime:water.material.uniforms.time.value,contextLost,hidden:document.hidden});};
 const reset=()=>{makeControls();camera.position.set(...resetPosition(camera.aspect));controls.update();snapshot();};
 resetButton.onclick=reset;
 const resize=()=>{const rect=canvas.getBoundingClientRect();const size=viewport(rect.width,rect.height,devicePixelRatio,coarse.matches||navigator.userAgentData?.mobile===true);const oldAspect=camera.aspect;camera.aspect=size.aspect;camera.updateProjectionMatrix();renderer.setPixelRatio(size.pixelRatio);renderer.setSize(size.width,size.height,false);if(firstSize){firstSize=false;reset();}else{const distance=camera.position.distanceTo(controls.target);camera.position.sub(controls.target).setLength(resizedDistance(distance,oldAspect,size.aspect)).add(controls.target);controls.update();}snapshot();};
 // Preserve orbit direction and relative zoom when orientation changes.
 const stop=()=>{renderer.setAnimationLoop(null);running=false;qa.running=false;lastTime=null;};
 const frame=time=>{try{if(document.hidden||contextLost){stop();return;}controls.update();if(lastTime!==null&&!motion.matches)elapsed+=Math.min(.05,(time-lastTime)*.001);lastTime=time;water.material.uniforms.time.value=elapsed;renderer.render(scene,camera);qa.frames++;Object.assign(qa,{ready:true,sceneReady:true,error:null,drawCalls:renderer.info.render.calls,renderTriangles:renderer.info.render.triangles});retry.hidden=true;resetButton.disabled=false;snapshot();}catch(error){stop();fail('화면을 그리지 못했습니다. 다시 시도하거나 브라우저의 그래픽 가속 설정을 확인해 주세요.',error);}};
 const start=()=>{if(running||contextLost||document.hidden)return;running=true;qa.running=true;renderer.setAnimationLoop(frame);};
 const help=()=>{status.textContent='드래그하여 둘러보기 · 스크롤 또는 두 손가락으로 확대';};
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;stop();controls.enabled=false;fail('그래픽 연결이 끊겼습니다. 자동 복구를 기다리거나 다시 시도해 주세요.','WebGL context lost');snapshot();});
 canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;qa.error=null;makeControls();resize();status.textContent='그래픽 연결이 복구되었습니다. 풍경을 다시 그리는 중…';start();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();controls.enabled=false;status.textContent='풍경 표시를 잠시 멈췄습니다.';}else if(!contextLost&&!qa.error){makeControls();help();start();}snapshot();});
 motion.addEventListener('change',()=>{makeControls();snapshot();});
 coarse.addEventListener('change',resize);
 addEventListener('resize',resize);
 new ResizeObserver(resize).observe(canvas);
 addEventListener('pagehide',stop);
 addEventListener('pageshow',()=>{if(!qa.error)start();});
 resize();help();start();
}catch(error){fail('3D 화면을 열 수 없습니다. 다시 시도하거나 WebGL2 지원 브라우저에서 그래픽 가속을 켜 주세요.',error);console.error(error);}
