import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const container=document.getElementById('view');
const status=document.getElementById('status'),cover=document.getElementById('cover');
const loadingText=document.getElementById('loadingText'),progress=document.getElementById('progressInner');
const panel=document.getElementById('panel'),cut=document.getElementById('cut'),axis=document.getElementById('axis');
const invert=document.getElementById('invert'), selected=document.getElementById('selected');
const scene=new THREE.Scene();scene.background=new THREE.Color(0xe9ecee);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.01,1e9);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight);
renderer.localClippingEnabled=true;container.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x555555,2.5));
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(15,35,24);scene.add(light);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.screenSpacePanning=true;
let model=null,box=null,center=new THREE.Vector3(),radius=10,cutting=false,measuring=false,first=null;
let meshes=[],materialClones=[],measureObjects=[];
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
const plane=new THREE.Plane(new THREE.Vector3(1,0,0),0);
function fit(){if(!box)return;const size=box.getSize(new THREE.Vector3());center=box.getCenter(new THREE.Vector3());radius=Math.max(size.length()/2,1);camera.position.copy(center).add(new THREE.Vector3(radius*1.7,radius*1.2,radius*1.7));camera.near=Math.max(radius/10000,.01);camera.far=radius*100;camera.updateProjectionMatrix();controls.target.copy(center);controls.update();}
function pick(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(meshes,false)[0];}
function updatePlane(){if(!box)return;const ax=axis.value;const min=box.min[ax],max=box.max[ax],at=min+(max-min)*(Number(cut.value)/100);const n=new THREE.Vector3(ax==='x'?1:0,ax==='y'?1:0,ax==='z'?1:0).multiplyScalar(invert.checked?-1:1);plane.normal.copy(n);plane.constant=-at*(invert.checked?-1:1);for(const m of meshes)for(const mat of Array.isArray(m.material)?m.material:[m.material])mat.clippingPlanes=cutting?[plane]:[];redraw();}
function clearMeasures(){for(const v of measureObjects){scene.remove(v);if(v.geometry)v.geometry.dispose();if(v.material)v.material.dispose();}measureObjects=[];first=null;redraw();}
function addMarker(pt){const s=new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius*.003,.01),8,8),new THREE.MeshBasicMaterial({color:0xff6a00}));s.position.copy(pt);scene.add(s);measureObjects.push(s);redraw();}
renderer.domElement.addEventListener('click',e=>{const hit=pick(e);if(!hit)return;
if(measuring){addMarker(hit.point);if(first){const len=first.distanceTo(hit.point);const geom=new THREE.BufferGeometry().setFromPoints([first,hit.point]);const line=new THREE.Line(geom,new THREE.LineBasicMaterial({color:0xff6a00,depthTest:false}));line.renderOrder=999;scene.add(line);measureObjects.push(line);redraw();selected.textContent=`Distância: ${len.toFixed(3)} m (se o GLB estiver em metros)`;selected.style.display='block';first=null;}else first=hit.point.clone();return;}
let obj=hit.object;let name='';while(obj&&obj!==model){if(obj.name&&!name)name=obj.name;const info=obj.userData||{};if(info.Name||info.name||info.Tag||info.tag){name=[info.Name||info.name,info.Tag||info.tag].filter(Boolean).join(' | ');break;}obj=obj.parent;}selected.textContent=`Elemento: ${name||hit.object.name||'Sem identificação'}`;selected.style.display='block';});
function toggled(id,state){document.getElementById(id).classList.toggle('active',state)}
document.getElementById('fit').onclick=fit;
document.getElementById('topview').onclick=()=>{camera.position.copy(center).add(new THREE.Vector3(0,radius*3,.001));controls.target.copy(center);controls.update()};
document.getElementById('frontview').onclick=()=>{camera.position.copy(center).add(new THREE.Vector3(0,radius*.2,radius*3));controls.target.copy(center);controls.update()};
document.getElementById('cutBtn').onclick=()=>{cutting=!cutting;panel.style.display=cutting?'block':'none';toggled('cutBtn',cutting);updatePlane()};
document.getElementById('disableCut').onclick=()=>{cutting=false;panel.style.display='none';toggled('cutBtn',false);updatePlane()};
document.getElementById('measure').onclick=()=>{measuring=!measuring;toggled('measure',measuring);selected.textContent=measuring?'Toque em dois pontos para medir.':'Modo medição desativado.';selected.style.display='block';first=null;};
document.getElementById('clear').onclick=()=>{clearMeasures();selected.style.display='none'};
[cut,axis,invert].forEach(el=>el.addEventListener('input',updatePlane));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);redraw()});
// Renderiza apenas quando a camera ou cena mudam, evitando trabalho constante da GPU.
let framePending=false;
function redraw(){
  if(framePending)return;
  framePending=true;
  requestAnimationFrame(()=>{
    framePending=false;
    controls.update();
    renderer.render(scene,camera);
  });
}
controls.addEventListener('change',redraw);
redraw();
async function loadModel(){
try{
// Alterar versao.json (número da revisão) a cada publicação impede cache antigo.
const manifest=await fetch('./versao.json?check='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('versao.json não encontrado');return r.json()});
const n=manifest.parts||9;const buffers=[];let total=0;
for(let i=1;i<=n;i++){
const part=`modelo.part${String(i).padStart(2,'0')}`;
loadingText.textContent=`Baixando parte ${i} de ${n}...`;
const response=await fetch('./'+part+'?v='+encodeURIComponent(manifest.version),{cache:'default'});
if(!response.ok)throw Error(`Arquivo ${part} não encontrado (HTTP ${response.status}).`);
const bytes=new Uint8Array(await response.arrayBuffer());buffers.push(bytes);total+=bytes.byteLength;progress.style.width=`${Math.round(i/n*75)}%`;
}
loadingText.textContent='Preparando geometria 3D...';
const combined=new Uint8Array(total);let offset=0;for(const b of buffers){combined.set(b,offset);offset+=b.length;}buffers.length=0;
const parsed=await new GLTFLoader().parseAsync(combined.buffer,'');
model=parsed.scene;scene.add(model);
// Materiais compartilhados: reduz memoria e compilacoes de shaders.
const optimizedMaterials=new Map();
function optimizedMaterial(mat){
  if(!optimizedMaterials.has(mat)){
    const shared=mat.clone();
    shared.side=THREE.DoubleSide;
    optimizedMaterials.set(mat,shared);
    materialClones.push(shared);
  }
  return optimizedMaterials.get(mat);
}
model.traverse(obj=>{
  if(!obj.isMesh)return;
  meshes.push(obj);
  obj.material=Array.isArray(obj.material)?obj.material.map(optimizedMaterial):optimizedMaterial(obj.material);
});
box=new THREE.Box3().setFromObject(model);fit();redraw();
status.textContent=`${manifest.version||'Modelo atual'} · ${meshes.length.toLocaleString('pt-BR')} malhas`;
document.getElementById('rev').textContent='Estrutura · '+(manifest.version||'Revisão não informada');
progress.style.width='100%';cover.style.display='none';
}catch(err){document.getElementById('error').textContent='Falha ao carregar modelo: '+err.message;loadingText.textContent='Verifique os arquivos publicados no GitHub.';status.textContent='Erro';console.error(err);}}
loadModel();
