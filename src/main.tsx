/// <reference types="vite/client" />
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html, useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import manifest from '../data/assets.json';
import './style.css';
import Game from './gameplay/Game';

type Asset = { id: string; type: string; file: string; version: string; status: string; anchors?: string[]; animations?: string[] };
type Inspection = { id: string; dimensions: string; clips: string[]; anchors: string[]; triangles: number };

class InspectorErrorBoundary extends React.Component<{children:React.ReactNode;assetId:string},{error:string|null}> {
 state={error:null as string|null};
 static getDerivedStateFromError(error:Error){return {error:error.message||String(error)};}
 componentDidUpdate(prev:{assetId:string}){if(prev.assetId!==this.props.assetId && this.state.error)this.setState({error:null});}
 render(){return this.state.error?<Html center><div style={{background:'#25151a',color:'#fff',padding:18,border:'1px solid #ff6b6b',borderRadius:8,maxWidth:340}}><strong>Error al abrir el GLB</strong><p style={{overflowWrap:'anywhere'}}>{this.state.error}</p><small>Probá otro modelo o recargá la página.</small></div></Html>:this.props.children;}
}
function Provisional() {
 return <group><mesh position={[0,0.375,0]}><boxGeometry args={[1.5,0.75,0.75]}/><meshStandardMaterial color="#987b5b"/></mesh><mesh position={[2,0.5,0]}><boxGeometry args={[0.5,1,0.5]}/><meshStandardMaterial color="#547a9a"/></mesh><Html position={[0,1.3,0]} center><span className="hint">PROVISIONAL · NO ES A-001</span></Html></group>;
}
function Model({asset,clip,onInspect}:{asset:Asset;clip:string;onInspect:(v:Inspection)=>void}) {
 const url=asset.file.startsWith('blob:') ? asset.file : import.meta.env.BASE_URL + asset.file.replace(/^\/+/, '').replace(/^public\//, '');
 const {scene,animations}=useGLTF(url);
 const model=useMemo(()=>cloneSkeleton(scene),[scene]);
 const {actions}=useAnimations(animations,model);
 useEffect(()=>{
  const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const anchors:string[]=[]; let triangles=0;
  model.traverse(obj=>{
   if(obj.name.startsWith('ANCHOR_')) {
    anchors.push(obj.name);
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.055),new THREE.MeshBasicMaterial({color:'#ffcc44',depthTest:false}));
    marker.name='DEBUG_ANCHOR_MARKER'; obj.add(marker);
   }
   if((obj as THREE.Mesh).isMesh) {
    const g=(obj as THREE.Mesh).geometry;
    triangles+=g.index?g.index.count/3:g.attributes.position.count/3;
   }
  });
  onInspect({id:asset.id,dimensions:[size.x,size.y,size.z].map(v=>v.toFixed(3)).join(' × ')+' m',clips:animations.map(a=>a.name),anchors,triangles:Math.round(triangles)});
 },[asset.id,model,animations,onInspect]);
 useEffect(()=>{Object.values(actions).forEach(a=>a?.stop());if(clip)actions[clip]?.reset().play();return()=>Object.values(actions).forEach(a=>a?.stop());},[actions,clip]);
 return <primitive object={model}/>;
}
function App(){
 const [mode,setMode]=useState<'game'|'inspector'>('game');
 const [assets,setAssets]=useState<Asset[]>((manifest as {assets:Asset[]}).assets);
 const [selected,setSelected]=useState(''); const [clip,setClip]=useState('');
 const [inspection,setInspection]=useState<Inspection|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{const onError=(event:ErrorEvent)=>setError('Error JS: '+event.message);const onRejection=(event:PromiseRejectionEvent)=>setError('Error de carga: '+String(event.reason));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection)}},[]);
 const asset=assets.find(a=>a.id===selected);
 const inspect=React.useCallback((value:Inspection)=>{setInspection(value);setError('')},[]);
 function upload(file:File){
  if(!file.name.toLowerCase().endsWith('.glb')){setError('Se requiere un archivo .glb');return}
  const id='prop.preview.'+String(assets.length+1).padStart(3,'0');
  const url=URL.createObjectURL(file);
  setAssets(prev=>[...prev,{id,type:'prop',file:url,version:'0.0.0',status:'provisional'}]);
  setSelected(id);setInspection(null);setClip('');
 }
 return <><nav className="topnav"><strong>SABRI — EL JUEGO</strong><button onClick={()=>setMode('game')}>Jugar</button><button onClick={()=>setMode('inspector')}>Inspeccionar GLB</button></nav>{mode==='game'?<Game/>:<div className="app"><aside><h1>SABRI <small>B-001</small></h1><p>Inspección de integración · Cuenta B</p><h3>Recurso</h3><select value={selected} onChange={e=>{setSelected(e.target.value);setInspection(null);setClip('')}}><option value="">Geometría provisional</option>{assets.map(a=><option key={a.id} value={a.id}>{a.id}</option>)}</select><label className="upload">Abrir GLB local<input type="file" accept=".glb" onChange={e=>{const file=e.target.files?.[0];if(file)upload(file)}}/></label><p className="note">El manifiesto está en data/assets.json. Los GLB declarados se sirven desde public/assets/.</p><h3>Inspección</h3>{inspection?<dl><dt>ID</dt><dd>{inspection.id}</dd><dt>Dimensiones XYZ</dt><dd>{inspection.dimensions}</dd><dt>Triángulos</dt><dd>{inspection.triangles}</dd><dt>Anclajes</dt><dd>{inspection.anchors.join(', ')||'No detectados'}</dd><dt>Animaciones</dt><dd>{inspection.clips.join(', ')||'No detectadas'}</dd></dl>:<p className="note">Seleccioná o abrí un GLB para inspeccionarlo.</p>}<h3>Reproducir clip</h3><select value={clip} onChange={e=>setClip(e.target.value)}><option value="">Detenido</option>{inspection?.clips.map(name=><option key={name}>{name}</option>)}</select>{error&&<p className="error">{error}</p>}<h3>Convenciones</h3><p className="note">1 unidad = 1 m · X derecha · Y arriba · Z profundidad · frente local +Z</p></aside><main><Canvas camera={{position:[4,3.5,5],fov:50}}><color attach="background" args={['#10131a']}/><ambientLight intensity={1.2}/><directionalLight position={[4,8,5]} intensity={2}/><Grid infiniteGrid cellSize={1} sectionSize={5} fadeDistance={30}/><axesHelper args={[2]}/><InspectorErrorBoundary assetId={selected}><Suspense fallback={<Html center>Cargando GLB...</Html>}>{asset?<Model key={asset.id} asset={asset} clip={clip} onInspect={inspect}/>:<Provisional/>}</Suspense></InspectorErrorBoundary><OrbitControls makeDefault target={[0,.6,0]}/></Canvas><div className="legend">X rojo · Y verde · Z azul · cuadrícula 1 m</div></main></div>}</>;
}
createRoot(document.getElementById('root')!).render(<App/>);
