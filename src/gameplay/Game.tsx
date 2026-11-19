import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';

type Phase = 'explore' | 'arrival' | 'dialogue' | 'resolved';
const options = [
 { text:'Escucharlo y ofrecer una solución', reaction:'El visitante se tranquiliza. ¡Encuentro resuelto!', points:2 },
 { text:'Pedirle que espere un momento', reaction:'El visitante acepta esperar. Encuentro resuelto.', points:1 },
 { text:'Decirle que vuelva mañana', reaction:'El visitante se retira molesto. Encuentro resuelto.', points:0 }
];
function Office({phase,onInteract,onVisitor}:{phase:Phase;onInteract:(name:string)=>void;onVisitor:()=>void}){
 return <group>
  <mesh position={[0,.38,0]} onClick={e=>{e.stopPropagation();onInteract('Escritorio')}}><boxGeometry args={[1.6,.12,.85]}/><meshStandardMaterial color="#9a6d48"/></mesh>
  {[-.67,.67].map(x=><mesh key={x} position={[x,.18,0]}><boxGeometry args={[.1,.36,.65]}/><meshStandardMaterial color="#626c77"/></mesh>)}
  <mesh position={[-.35,.51,-.1]} onClick={e=>{e.stopPropagation();onInteract('Teléfono')}}><boxGeometry args={[.27,.13,.16]}/><meshStandardMaterial color="#293b52"/></mesh>
  <mesh position={[.3,.56,-.08]} onClick={e=>{e.stopPropagation();onInteract('Computadora')}}><boxGeometry args={[.5,.32,.04]}/><meshStandardMaterial color="#263c53"/></mesh>
  <mesh position={[.1,.49,.25]} onClick={e=>{e.stopPropagation();onInteract('Mate')}}><cylinderGeometry args={[.07,.045,.15,12]}/><meshStandardMaterial color="#438a69"/></mesh>
  <mesh position={[0,.32,1.25]}><boxGeometry args={[.5,.08,.5]}/><meshStandardMaterial color="#647487"/></mesh>
  <mesh position={[0,.78,1.25]}><boxGeometry args={[.45,.85,.08]}/><meshStandardMaterial color="#647487"/></mesh>
  {phase!=='explore'&&<group position={[1.7,0,.7]} onClick={e=>{e.stopPropagation();onVisitor()}}>
    <mesh position={[0,.87,0]}><capsuleGeometry args={[.22,.75,4,8]}/><meshStandardMaterial color="#bb7759"/></mesh>
    <mesh position={[0,1.62,0]}><sphereGeometry args={[.22,12,12]}/><meshStandardMaterial color="#e0b29b"/></mesh>
    <Html position={[0,2.05,0]} center><span className="hint">Visitante · provisional</span></Html>
  </group>}
  <Html position={[0,1.4,0]} center><span className="hint">Escenario provisional</span></Html>
 </group>;
}
export default function Game(){
 const [phase,setPhase]=useState<Phase>('explore');
 const [message,setMessage]=useState('Explorá el escritorio. Hacé clic sobre los objetos.');
 const [score,setScore]=useState(0);
 const [round,setRound]=useState(1);
 function interact(name:string){if(phase==='explore')setMessage(name+': objeto inspeccionado. La interacción definitiva se definirá con la historia.')}
 function arrive(){setPhase('arrival');setMessage('Llegó un visitante. Hacé clic sobre él para hablar.')}
 function talk(){if(phase==='arrival'){setPhase('dialogue');setMessage('Visitante: Necesito que me ayudes con un problema de la oficina. ¿Qué hacemos?')}}
 function choose(index:number){const result=options[index];setScore(s=>s+result.points);setMessage(result.reaction);setPhase('resolved')}
 function next(){setRound(r=>r+1);setPhase('explore');setMessage('Nuevo turno. Podés explorar antes de recibir al próximo visitante.')}
 return <div className="game"><div className="gamehud"><h2>SABRI · PROTOTIPO B-003</h2><p>Turno {round} · Puntos {score}</p><p>{message}</p>{phase==='explore'&&<button onClick={arrive}>Recibir visitante</button>}{phase==='arrival'&&<button onClick={talk}>Hablar con visitante</button>}{phase==='dialogue'&&<div className="choices">{options.map((o,i)=><button key={i} onClick={()=>choose(i)}>{o.text}</button>)}</div>}{phase==='resolved'&&<button onClick={next}>Siguiente turno</button>}</div><div className="gamecanvas"><Canvas orthographic camera={{position:[5,5,5],zoom:95,near:0.1,far:100}}><color attach="background" args={['#10131a']}/><ambientLight intensity={1.5}/><directionalLight position={[3,7,4]} intensity={2}/><Grid infiniteGrid cellSize={1} sectionSize={5}/><Office phase={phase} onInteract={interact} onVisitor={talk}/><OrbitControls makeDefault target={[0,.6,.3]} enableRotate={false} enablePan={false} enableZoom zoomToCursor minZoom={45} maxZoom={240} enableDamping={false}/></Canvas></div></div>;
}