import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useAnimations, useGLTF } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import manifest from '../../data/assets.json';

type Phase = 'explore' | 'arrival' | 'dialogue' | 'resolved';
type Asset = { id: string; file: string };
const resources = (manifest.assets as Asset[]);
function assetUrl(id: string) {
 const asset = resources.find(a => a.id === id);
 if (!asset) throw new Error('Recurso no encontrado: ' + id);
 return import.meta.env.BASE_URL + asset.file.replace(/^\/+/, '').replace(/^public\//, '');
}
function Model({ id, position = [0, 0, 0], rotation = 0, animate = false, onClick }: {
 id: string; position?: [number, number, number]; rotation?: number; animate?: boolean; onClick?: () => void;
}) {
 const { scene, animations } = useGLTF(assetUrl(id));
 const model = useMemo(() => cloneSkeleton(scene), [scene]);
 const { actions } = useAnimations(animations, model);
 useEffect(() => {
  if (!animate) return;
  const idle = actions.Idle;
  idle?.reset().play();
  return () => { idle?.stop(); };
 }, [actions, animate]);
 return <group position={position} rotation={[0, rotation, 0]} onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined}>
  <primitive object={model}/>
 </group>;
}
const options = [
 { text: 'Escucharlo y ofrecer una solución', reaction: 'El visitante se tranquiliza. ¡Encuentro resuelto!', points: 2 },
 { text: 'Pedirle que espere un momento', reaction: 'El visitante acepta esperar. Encuentro resuelto.', points: 1 },
 { text: 'Decirle que vuelva mañana', reaction: 'El visitante se retira molesto. Encuentro resuelto.', points: 0 }
];
const colleagues: { id: string; name: string; position: [number, number, number]; rotation: number }[] = [
 { id: 'char.sabri.001', name: 'Sabri', position: [-3.15, 0, 1.5], rotation: 1.1 },
 { id: 'char.ricardo_uruguayo.001', name: 'Ricardo Uruguayo', position: [-1.75, 0, -1.75], rotation: 0 },
 { id: 'char.david.001', name: 'David', position: [-0.5, 0, 1.85], rotation: Math.PI },
 { id: 'char.nicolas.001', name: 'Nicolás', position: [0.8, 0, -1.75], rotation: 0 },
 { id: 'char.padre_conrado.001', name: 'Padre Conrado', position: [2.05, 0, 1.85], rotation: Math.PI },
 { id: 'char.kelly.001', name: 'Kelly', position: [3.25, 0, -1.55], rotation: -0.7 }
];
function Office({ phase, onInteract, onVisitor }: { phase: Phase; onInteract: (name: string) => void; onVisitor: () => void }) {
 return <group>
  <Model id="env.floor.001"/>
  <Model id="env.desk_cluster.001" onClick={() => onInteract('Puestos de trabajo')}/>
  {colleagues.map(person => <group key={person.id}>
   <Model id={person.id} position={person.position} rotation={person.rotation} animate onClick={() => onInteract(person.name)}/>
  </group>)}
  {phase !== 'explore' && <group>
   <Model id="char.gaston.001" position={[3.1, 0, 2.15]} rotation={-1.4} animate onClick={onVisitor}/>
   <Html position={[3.1, 2.2, 2.15]} center><span className="hint">Gastón · hablar</span></Html>
  </group>}
 </group>;
}
export default function Game() {
 const [phase, setPhase] = useState<Phase>('explore');
 const [message, setMessage] = useState('Explorá la oficina. Hacé clic sobre los personajes o el escritorio.');
 const [score, setScore] = useState(0);
 const [round, setRound] = useState(1);
 function interact(name: string) { if (phase === 'explore') setMessage(name + ': interacción disponible. El guion definitivo se incorporará después.'); }
 function arrive() { setPhase('arrival'); setMessage('Llegó Gastón. Hacé clic sobre él para hablar.'); }
 function talk() { if (phase === 'arrival') { setPhase('dialogue'); setMessage('Gastón: Necesito que me ayudes con un problema de la oficina. ¿Qué hacemos?'); } }
 function choose(index: number) { const result = options[index]; setScore(s => s + result.points); setMessage(result.reaction); setPhase('resolved'); }
 function next() { setRound(r => r + 1); setPhase('explore'); setMessage('Nuevo turno. Podés explorar antes de recibir al próximo visitante.'); }
 return <div className="game"><div className="gamehud"><h2>SABRI · ESCENARIO 3D</h2><p>Turno {round} · Puntos {score}</p><p>{message}</p>{phase === 'explore' && <button onClick={arrive}>Recibir visitante</button>}{phase === 'arrival' && <button onClick={talk}>Hablar con Gastón</button>}{phase === 'dialogue' && <div className="choices">{options.map((o, i) => <button key={i} onClick={() => choose(i)}>{o.text}</button>)}</div>}{phase === 'resolved' && <button onClick={next}>Siguiente turno</button>}</div><div className="gamecanvas"><Canvas orthographic camera={{position:[8, 8, 10], zoom:65, near:0.1, far:100}}><color attach="background" args={['#10131a']}/><ambientLight intensity={1.7}/><directionalLight position={[3, 8, 4]} intensity={2.2}/><Suspense fallback={<Html center><span className="hint">Cargando oficina y personajes...</span></Html>}><Office phase={phase} onInteract={interact} onVisitor={talk}/></Suspense><OrbitControls makeDefault target={[0, .5, 0]} enableRotate={false} enablePan={false} enableZoom zoomToCursor minZoom={35} maxZoom={170} enableDamping={false}/></Canvas></div></div>;
}
