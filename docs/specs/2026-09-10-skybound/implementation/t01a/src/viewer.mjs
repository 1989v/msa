import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const state={ready:false,error:null,renderedFrames:0,loadedFromGLB:false};window.__skyboundQA=state;window.__SKYBOUND_VIEWER__=state;
let renderer,loop;
function fail(error){state.error=String(error.message||error);status.textContent='3D 미리보기를 열 수 없습니다 · '+state.error;document.body.dataset.state='error';}
try{
 renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new T.Scene();scene.background=new T.Color('hsl(43, 20%, 85%)');scene.fog=new T.Fog('hsl(43, 20%, 85%)',23,50);
 const camera=new T.PerspectiveCamera(37,1,.1,70);camera.position.set(8.2,6.3,12.8);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,2.95,0);controls.enableDamping=true;controls.minDistance=5.5;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.49;
 scene.add(new T.HemisphereLight('hsl(210, 45%, 91%)','hsl(43, 22%, 46%)',2.25));
 const sun=new T.DirectionalLight('hsl(40, 72%, 89%)',3.1);sun.position.set(-5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:9,bottom:-5,near:.5,far:30});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
 const fill=new T.DirectionalLight('hsl(205, 48%, 80%)',.6);fill.position.set(5,4,-5);scene.add(fill);
 const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'hsl(43, 17%, 70%)',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.014;floor.receiveShadow=true;scene.add(floor);
 const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(canvas);resize();
 document.querySelector('#reset').onclick=()=>{camera.position.set(8.2,6.3,12.8);controls.target.set(0,2.95,0);};
 document.querySelector('#front').onclick=()=>{camera.position.set(0,4,15);controls.target.set(0,3,0);};
 let auto=false;document.querySelector('#rotate').onclick=e=>{auto=!auto;e.currentTarget.setAttribute('aria-pressed',String(auto));controls.autoRotate=auto;controls.autoRotateSpeed=.6;};
 const gltf=await new GLTFLoader().loadAsync(new URL('assets/wind-shrine.glb',document.baseURI).href);
 // Bundled entry lives at viewer.js beside index.html, so resolve asset from page URL.
 scene.add(gltf.scene);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 state.loadedFromGLB=true;state.bounds=new T.Box3().setFromObject(gltf.scene).getSize(new T.Vector3()).toArray();
 state.meshes=0;gltf.scene.traverse(o=>{if(o.isMesh)state.meshes++;});
 status.textContent='GLB 로드 완료 · 원본 기하 / PBR 재질';document.body.dataset.state='ready';
 loop=()=>{if(!document.hidden){controls.update();renderer.render(scene,camera);state.renderedFrames++;if(state.renderedFrames>=2)state.ready=true;}requestAnimationFrame(loop);};loop();
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('그래픽 연결이 끊겼습니다. 페이지를 새로고침하세요.'));});
}catch(error){fail(error);}
