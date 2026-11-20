import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
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

const movementKeys = new Set<string>();
const movementKeyNames = new Set(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright']);
function Player() {
 const { scene, animations } = useGLTF(assetUrl('char.sabri.001'));
 const model = useMemo(() => cloneSkeleton(scene), [scene]);
 const { actions } = useAnimations(animations, model);
 const ref = useRef<THREE.Group>(null);
 const walking = useRef(false);
 useEffect(() => {
  const down = (event: KeyboardEvent) => {
   if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
   const key = event.key.toLowerCase();
   if (movementKeyNames.has(key)) { event.preventDefault(); movementKeys.add(key); }
  };
  const up = (event: KeyboardEvent) => { movementKeys.delete(event.key.toLowerCase()); };
  const blur = () => movementKeys.clear();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); movementKeys.clear(); };
 }, []);
 useEffect(() => { actions.Idle?.reset().fadeIn(.2).play(); return () => { actions.Idle?.stop(); actions.Walk?.stop(); }; }, [actions]);
 useFrame((_, delta) => {
  const group = ref.current;
  if (!group) return;
  const forward = Number(movementKeys.has('w') || movementKeys.has('arrowup')) - Number(movementKeys.has('s') || movementKeys.has('arrowdown'));
  const right = Number(movementKeys.has('d') || movementKeys.has('arrowright')) - Number(movementKeys.has('a') || movementKeys.has('arrowleft'));
  const active = forward !== 0 || right !== 0;
  if (active !== walking.current) {
   const from = actions[walking.current ? 'Walk' : 'Idle'];
   const to = actions[active ? 'Walk' : 'Idle'];
   from?.fadeOut(.16);
   to?.reset().fadeIn(.16).play();
   walking.current = active;
  }
  if (!active) return;
  const length = Math.hypot(forward, right);
  const dx = (right - forward) / Math.SQRT2 / length;
  const dz = (-right - forward) / Math.SQRT2 / length;
  const speed = Math.min(delta, .05) * 2.2;
  const x = THREE.MathUtils.clamp(group.position.x + dx * speed, -7.75, 7.75);
  const z = THREE.MathUtils.clamp(group.position.z + dz * speed, -6.75, 6.75);
  // Keep Sabri outside the desk cluster until mesh colliders are available.
  if (!(Math.abs(x) < 2.75 && Math.abs(z) < 1.42)) group.position.set(x, 0, z);
  const angle = Math.atan2(dx, dz);
  const diff = Math.atan2(Math.sin(angle - group.rotation.y), Math.cos(angle - group.rotation.y));
  group.rotation.y += diff * Math.min(1, delta * 12);
 });
 return <group ref={ref} position={[-3.2,0,1.8]}><primitive object={model}/></group>;
}
function ExtendedFloor() {
 const { scene } = useGLTF(assetUrl('env.floor.001'));
 const model = useMemo(() => {
  const copy = scene.clone(true);
  copy.traverse(object => {
   if (!(object instanceof THREE.Mesh)) return;
   const materials = Array.isArray(object.material) ? object.material : [object.material];
   const updated = materials.map(material => {
    const next = material.clone();
    if (next instanceof THREE.MeshStandardMaterial && next.map) {
     next.map = next.map.clone();
     next.map.wrapS = THREE.RepeatWrapping;
     next.map.wrapT = THREE.RepeatWrapping;
     next.map.repeat.multiplyScalar(12);
     next.map.needsUpdate = true;
    }
    return next;
   });
   object.material = Array.isArray(object.material) ? updated : updated[0];
  });
  return copy;
 }, [scene]);
 return <group scale={[12,1,12]}><primitive object={model}/></group>;
}

const options = [
 { text: 'Escucharlo y ofrecer una solución', reaction: 'El visitante se tranquiliza. ¡Encuentro resuelto!', points: 2 },
 { text: 'Pedirle que espere un momento', reaction: 'El visitante acepta esperar. Encuentro resuelto.', points: 1 },
 { text: 'Decirle que vuelva mañana', reaction: 'El visitante se retira molesto. Encuentro resuelto.', points: 0 }
];
// Expanded playable limits: four additional metres in every direction.
const colleagues: { id: string; name: string; position: [number, number, number]; rotation: number }[] = [
 { id: 'char.ricardo_uruguayo.001', name: 'Ricardo Uruguayo', position: [-1.75, 0, -1.75], rotation: 0 },
 { id: 'char.david.001', name: 'David', position: [-0.5, 0, 1.85], rotation: Math.PI },
 { id: 'char.nicolas.001', name: 'Nicolás', position: [0.8, 0, -1.75], rotation: 0 },
 { id: 'char.padre_conrado.001', name: 'Padre Conrado', position: [2.05, 0, 1.85], rotation: Math.PI },
 { id: 'char.kelly.001', name: 'Kelly', position: [3.25, 0, -1.55], rotation: -0.7 }
];
function Office({ phase, onInteract, onVisitor }: { phase: Phase; onInteract: (name: string) => void; onVisitor: () => void }) {
 return <group>
  <ExtendedFloor/>
  <Player/>
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
 const [message, setMessage] = useState('Mové a Sabri con WASD o las flechas. Hacé clic para interactuar.');
 const [score, setScore] = useState(0);
 const [round, setRound] = useState(1);
 function interact(name: string) { if (phase === 'explore') setMessage(name + ': interacción disponible. El guion definitivo se incorporará después.'); }
 function arrive() { setPhase('arrival'); setMessage('Llegó Gastón. Hacé clic sobre él para hablar.'); }
 function talk() { if (phase === 'arrival') { setPhase('dialogue'); setMessage('Gastón: Necesito que me ayudes con un problema de la oficina. ¿Qué hacemos?'); } }
 function choose(index: number) { const result = options[index]; setScore(s => s + result.points); setMessage(result.reaction); setPhase('resolved'); }
 function next() { setRound(r => r + 1); setPhase('explore'); setMessage('Nuevo turno. Podés explorar antes de recibir al próximo visitante.'); }
 return <div className="game"><div className="gamehud"><h2>SABRI · ESCENARIO 3D</h2><p>Turno {round} · Puntos {score}</p><p>{message}</p>{phase === 'explore' && <button onClick={arrive}>Recibir visitante</button>}{phase === 'arrival' && <button onClick={talk}>Hablar con Gastón</button>}{phase === 'dialogue' && <div className="choices">{options.map((o, i) => <button key={i} onClick={() => choose(i)}>{o.text}</button>)}</div>}{phase === 'resolved' && <button onClick={next}>Siguiente turno</button>}</div><div className="gamecanvas"><Canvas orthographic camera={{position:[8, 8, 10], zoom:65, near:0.1, far:100}}><color attach="background" args={['#10131a']}/><ambientLight intensity={1.7}/><directionalLight position={[3, 8, 4]} intensity={2.2}/><Suspense fallback={<Html center><span className="hint">Cargando oficina y personajes...</span></Html>}><Office phase={phase} onInteract={interact} onVisitor={talk}/></Suspense><OrbitControls makeDefault target={[0, .5, 0]} enableRotate={false} enablePan={false} enableZoom zoomToCursor minZoom={35} maxZoom={170} enableDamping={false}/></Canvas><div className="gamevignette" aria-hidden="true"/><div className="gamecontrols">W A S D · Mover a Sabri</div></div></div>;
}
