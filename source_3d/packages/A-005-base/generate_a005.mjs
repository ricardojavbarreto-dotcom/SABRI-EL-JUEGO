import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('./', import.meta.url));
const version = '0.1.1';
const files = {
  generator: 'generate_a005.mjs',
  blender: 'create_blends.py',
  manifest: 'data/assets.json',
  references: 'references.json',
  report: 'docs/REPORTE_INTEGRACION_CUENTA_A.md',
};

function write(path, contents) {
  const target = resolve(project, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

const tidy = (n) => Number(n.toFixed(6));
const plus = (a, b) => a.map((v, i) => v + b[i]);
const minus = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = ([a, b, c], [x, y, z]) => [b * z - c * y, c * x - a * z, a * y - b * x];
const mean = (points) => points.reduce(plus, [0, 0, 0]).map((v) => v / points.length);

const palette = {
  jacketPanel:['MAT_JACKET_YOKE','#35363a',0,.92],
  jacketPanel:['MAT_JACKET_YOKE','#35363a',0,.92],
  face: ['MAT_FACE','#ffffff',0,0.8],
  silver: ['MAT_EARRINGS','#c3b5ab',0.68,0.25],
  button: ['MAT_BUTTON','#e5dbcb',0.12,0.45],
  lens: ['MAT_SMOKED_LENS','#342b35',0.22,0.17],
  frame: ['MAT_DARK_FRAME','#211e22',0.13,0.24],
  lips: ['MAT_LIPS','#995f63',0,0.68],
  strand: ['MAT_CHESTNUT','#543b34',0,0.67],
  oak: ['MAT_OAK', '#b9825c', 0, 0.63],
  graphite: ['MAT_GRAPHITE', '#41494f', 0.55, 0.51],
  upholstery: ['MAT_UPHOLSTERY', '#436666', 0, 0.89],
  rubber: ['MAT_RUBBER', '#252930', 0, 0.83],
  skin: ['MAT_SKIN', '#cc9885', 0, 0.78],
  hair: ['MAT_HAIR', '#352722', 0, 0.84],
  shirt: ['MAT_SHIRT', '#ffffff', 0, 0.91],
  cotton: ['MAT_COTTON', '#e1d9cf', 0, 0.95],
  trousers: ['MAT_TROUSERS', '#363942', 0, 0.89],
  shoe: ['MAT_SHOE', '#332b2a', 0, 0.75],
  eye: ['MAT_EYE', '#241c1a', 0, 0.54],
};

function pbr([name, hex, metallicFactor, roughnessFactor]) {
  const rgb = hex.slice(1).match(/../g).map((c) => Number.parseInt(c, 16) / 255);
  const linear = rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return { name, pbrMetallicRoughness: { baseColorFactor: [...linear, 1], metallicFactor, roughnessFactor } };
}

class Glb {
  constructor(id) {
    this.doc = {
      asset: { version: '2.0', generator: 'Sabri Game A-005 procedural source' },
      scene: 0,
      scenes: [{ name: 'SCENE', nodes: [0] }],
      nodes: [{ name: 'ROOT', extras: { asset_id: id, asset_version: id==='char.gaston.001'?'0.1.0':version } }],
      meshes: [], materials: [], accessors: [], bufferViews: [],
    };
    this.materials = new Map();
    this.chunks = [];
    this.bytes = 0;
    this.triangles = 0;
    this.min = [Infinity, Infinity, Infinity];
    this.max = [-Infinity, -Infinity, -Infinity];
  }

  node(name, parent, attributes = {}) {
    const index = this.doc.nodes.push({ name, ...attributes }) - 1;
    (this.doc.nodes[parent].children ??= []).push(index);
    return index;
  }

  accessor(values, type, componentType = 5126, target, bounds = false) {
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const byteWidth = componentType === 5121 ? 1 : componentType === 5123 ? 2 : 4;
    const data = Buffer.alloc(values.length * byteWidth);
    const put = { 5121: 'writeUInt8', 5123: 'writeUInt16LE', 5126: 'writeFloatLE' }[componentType];
    values.forEach((value, i) => data[put](value, i * byteWidth));
    const view = { buffer: 0, byteOffset: this.bytes, byteLength: data.length };
    if (target) view.target = target;
    const index = this.doc.bufferViews.push(view) - 1;
    const padding = (4 - data.length % 4) % 4;
    this.chunks.push(data, Buffer.alloc(padding));
    this.bytes += data.length + padding;

    const accessor = { bufferView: index, componentType, count: values.length / width, type };
    if (bounds) {
      accessor.min = Array(width).fill(Infinity);
      accessor.max = Array(width).fill(-Infinity);
      for (let i = 0; i < values.length; i++) {
        const axis = i % width;
        const value = componentType === 5126 ? Math.fround(values[i]) : values[i];
        accessor.min[axis] = Math.min(accessor.min[axis], value);
        accessor.max[axis] = Math.max(accessor.max[axis], value);
      }
    }
    return this.doc.accessors.push(accessor) - 1;
  }

  material(key) {
    if (!this.materials.has(key)) this.materials.set(key, this.doc.materials.push(pbr(palette[key])) - 1);
    return this.materials.get(key);
  }

  mesh(pieces, skinned = false) {
    const groups = Map.groupBy(pieces, (piece) => piece.material);
    const primitives = [];
    for (const [material, members] of groups) {
      const positions = [], normals = [], indices = [], joints = [], weights = [];
      for (const { rings, joint } of members) {
        const points = rings.flat();
        const center = mean(points);
        const ringSize = rings[0].length;
        const polygons = [rings[0].map((_, i) => i)];
        for (let level = 0; level < rings.length - 1; level++) {
          for (let i = 0; i < ringSize; i++) {
            const next = (i + 1) % ringSize;
            polygons.push([level * ringSize + i, level * ringSize + next,
              (level + 1) * ringSize + next, (level + 1) * ringSize + i]);
          }
        }
        polygons.push(rings.at(-1).map((_, i) => (rings.length - 1) * ringSize + i));

        for (const polygon of polygons) {
          const face = polygon.map((i) => points[i]);
          let normal = cross(minus(face[1], face[0]), minus(face[2], face[0]));
          if (dot(normal, minus(mean(face), center)) < 0) {
            face.reverse();
            normal = normal.map((v) => -v);
          }
          const length = Math.hypot(...normal);
          if (length < 1e-10) throw new Error('Degenerate polygon');
          const first = positions.length / 3;
          for (const point of face) {
            positions.push(...point);
            normals.push(...normal.map((v) => v / length));
            if (skinned) {
              joints.push(joint, 0, 0, 0);
              weights.push(1, 0, 0, 0);
            }
            point.forEach((v, axis) => {
              this.min[axis] = Math.min(this.min[axis], v);
              this.max[axis] = Math.max(this.max[axis], v);
            });
          }
          for (let i = 1; i < face.length - 1; i++) indices.push(first, first + i, first + i + 1);
        }
      }
      this.triangles += indices.length / 3;
      const attributes = {
        POSITION: this.accessor(positions, 'VEC3', 5126, 34962, true),
        NORMAL: this.accessor(normals, 'VEC3', 5126, 34962),
      };
      if(['shirt','face','hair','strand'].includes(material)){
        const uv=[];
        for(let i=0;i<positions.length;i+=3){
          const [x,y,z]=positions.slice(i,i+3);
          if(material==='face' && z<.013) uv.push(.015,.54);
          else if(material==='face') uv.push((238+1580*x-60)/355,(542-(y-1.416)*2020-60)/495);
          else if(material==='shirt') uv.push(x*4.4+z*1.3,-y*4.5);
          else uv.push(Math.atan2(z+.010,x)/Math.PI*1.7+y*1.5,-y*5+x*1.4);
        }
        attributes.TEXCOORD_0=this.accessor(uv,'VEC2',5126,34962);
      }
      if (skinned) {
        attributes.JOINTS_0 = this.accessor(joints, 'VEC4', 5121, 34962);
        attributes.WEIGHTS_0 = this.accessor(weights, 'VEC4', 5126, 34962);
      }
      primitives.push({ attributes, indices: this.accessor(indices, 'SCALAR', 5123, 34963), material: this.material(material) });
    }
    return this.doc.meshes.push({ primitives }) - 1;
  }

  encode() {
    this.doc.images=[]; this.doc.textures=[];
    for(const [file,keys] of [[this.slug+'_hair.jpg',['hair']],[this.slug+'_cloth.jpg',['shirt']],[this.slug+'_face.jpg',['face']]]){
      const tex=readFileSync(new URL('./'+file,import.meta.url));
      const view=this.doc.bufferViews.push({buffer:0,byteOffset:this.bytes,byteLength:tex.length})-1;
      const padding=(4-tex.length%4)%4;
      this.chunks.push(tex,Buffer.alloc(padding)); this.bytes+=tex.length+padding;
      const index=this.doc.images.push({name:file,mimeType:'image/jpeg',bufferView:view})-1;
      this.doc.textures.push({source:index});
      for(const key of keys){
        const pbr=this.doc.materials[this.materials.get(key)].pbrMetallicRoughness;
        pbr.baseColorFactor=[1,1,1,1]; pbr.baseColorTexture={index};
      }
    }
    this.doc.buffers = [{ byteLength: this.bytes }];
    const json = Buffer.from(JSON.stringify(this.doc));
    const jsonContents = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
    const header = Buffer.alloc(12);
    header.write('glTF');
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + jsonContents.length + 8 + this.bytes, 8);
    function chunkHeader(length, name) {
      const chunk = Buffer.alloc(8);
      chunk.writeUInt32LE(length);
      chunk.write(name, 4);
      return chunk;
    }
    return Buffer.concat([header, chunkHeader(jsonContents.length, 'JSON'), jsonContents,
      chunkHeader(this.bytes, 'BIN\0'), ...this.chunks]);
  }
}

function box(center, size, material, bevel = 0) {
  const [w, h, d] = size.map((n) => n / 2);
  const cut = Math.min(bevel, w * 0.45, h * 0.45, d * 0.45);
  function ring(y, inset) {
    const x = w - inset, z = d - inset;
    const corner = cut ? Math.max(cut * 0.25, cut - inset * 0.66) : 0;
    const corners = corner
      ? [[-x + corner, -z], [x - corner, -z], [x, -z + corner], [x, z - corner],
        [x - corner, z], [-x + corner, z], [-x, z - corner], [-x, -z + corner]]
      : [[-x, -z], [x, -z], [x, z], [-x, z]];
    return corners.map(([a, b]) => plus([a, y, b], center));
  }
  const rings = cut
    ? [ring(-h, cut), ring(-h + cut, 0), ring(h - cut, 0), ring(h, cut)]
    : [ring(-h, 0), ring(h, 0)];
  return { rings, material };
}

function profile(rings, material, sides = 20) {
  return {
    material,
    rings: rings.map(([y, x, z, width, depth]) => Array.from({ length: sides }, (_, i) => {
      const phase = 2 * Math.PI * i / sides;
      return [x + width * Math.cos(phase), y, z + depth * Math.sin(phase)];
    })),
  };
}

const hipHeight = 0.852;
const thighLength = 0.400;
const shinLength = 0.387;
const ankleHeight = hipHeight - thighLength - shinLength;
const qx = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];

function employee(c) {
  palette.skin[1]=c.skin; palette.hair[1]=c.hair; palette.trousers[1]=c.pants; palette.shoe[1]=c.slug==='gaston'?'#212122':'#393531';
  const long=['nicolas','padre_conrado','ricardo_uruguayo'].includes(c.slug);
  const glb = new Glb('char.'+c.slug+'.001');
  glb.slug=c.slug;
  const armature = glb.node('ARMATURE', 0);
  const joints = [];
  const byName = new Map();
  const pieces = [];

  function joint(name, parent, position) {
    const parentJoint = byName.get(parent);
    const bind = parentJoint ? plus(parentJoint.bind, position) : position;
    const node = glb.node(name, parentJoint?.node ?? armature, { translation: position });
    byName.set(name, { node, bind, index: joints.length });
    joints.push(node);
  }

  function part(name, shape) {
    const { bind, index } = byName.get(name);
    pieces.push({ ...shape, joint: index, rings: shape.rings.map((ring) => ring.map((p) => plus(p, bind))) });
  }

  joint('hips', null, [0, hipHeight, 0]);
  joint('spine', 'hips', [0, 0.15, 0]);
  joint('head', 'spine', [0, 0.405, 0]);
  part('hips', profile([[-0.08, 0, 0, 0.148, 0.10], [0.027, 0, 0, 0.148, 0.093],
    [0.13, 0, 0, 0.135, 0.087]], 'trousers'));
  const blouse=profile([[-.105,0,0,.185,.123],[.025,0,0,.169,.115],[.125,0,0,.146,.104],
    [.215,0,.004,.181,.125],[.27,0,0,.196,.103],[.308,0,0,.158,.085],[.341,0,-.012,.079,.061]],'shirt',40);
  for(const ring of blouse.rings) for(const p of ring){
    const phase=Math.atan2(p[2],p[0]);
    const fold=.035*Math.cos(phase*13+.9*p[1])*Math.max(0,.28-p[1])/.38;
    p[0]*=c.build*(1+fold); p[2]*=1+fold;
    if(p[1]<-.1)p[1]+=.007*Math.sin(4*phase);
  }
  if(c.slug==='ricardo_uruguayo'){
    part('spine',{material:'shirt',rings:blouse.rings.slice(0,4)});
    part('spine',{material:'jacketPanel',rings:blouse.rings.slice(3)});
  } else part('spine',blouse);
  part('spine',profile([[.312,0,0,.066,.060],[.429,0,0,.052,.053]],'skin',32));
  if(c.slug==='padre_conrado'){
    part('spine',profile([[.332,0,0,.072,.066],[.366,0,0,.062,.058]],'shirt'));
    part('spine',box([0,.351,.059],[.034,.021,.006],'button',.002));
  }
  if(c.slug==='ricardo_uruguayo'){
    part('spine',profile([[.264,0,-.045,.110,.077],[.308,0,-.040,.124,.087],[.347,0,-.04,.092,.071]],'jacketPanel'));
    part('spine',box([0,.064,.116],[.005,.31,.004],'graphite',.001));
  }
  if(['nicolas','kelly'].includes(c.slug)){
    for(const s of [-1,1]) part('spine',profile([[.242,s*.054,.116,.005,.005],[.289,s*.060,.095,.020,.009],[.328,s*.053,.064,.014,.007]],'shirt'));
    for(const y of [-.06,.015,.09,.165,.232]) part('spine',box([0,y,y>.15?.127:.112],[.007,.007,.004],'button',.001));
  }
  const faceSections=[[.009,.025,.031,.048],[.023,.023,.055,.061],[.052,.016,.077,.077],
    [.086,.01,.089,.082],[.118,.003,.096,.085],[.153,.001,.098,.088],
    [.197,-.004,.096,.087],[.226,-.009,.086,.080],[.253,-.012,.056,.060]];
  const faceRings=[];
  for(let row=0;row<49;row++){
    const y=.009+row*(.253-.009)/48;
    let k=1;while(k<faceSections.length-1 && faceSections[k][0]<y)k++;
    const a=faceSections[k-1], b=faceSections[k], f=(y-a[0])/(b[0]-a[0]);
    const [,cz,rx,rz]=a.map((n,i)=>n+(b[i]-n)*f);
    const ring=[];
    for(let i=0;i<64;i++){
      const theta=2*Math.PI*i/64, x=rx*Math.cos(theta), front=Math.sin(theta);
      const bump=(cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
      const relief=.031*bump(0,.102,.019,.019)+.018*bump(0,.132,.012,.041)+
        .008*bump(0,.069,.039,.013)+.009*bump(0,.030,.028,.016)+
        .012*bump(.054,.104,.033,.021)+.012*bump(-.054,.104,.033,.021);
      ring.push([x,y,cz+rz*front+Math.max(0,front)**3*relief]);
    }
    faceRings.push(ring);
  }
  part('head',{rings:faceRings,material:'face'});
  const crown={nicolas:.257,padre_conrado:.275,ricardo_uruguayo:.281,kelly:.263,gaston:.272,david:.265}[c.slug];
  const hair=profile([[.14,0,-.004,.099,.091],[.2,0,-.005,.104,.096],[.236,-.004,-.008,.096,.09],[crown-.009,-.006,-.009,.074,.069],[crown,-.012,-.009,.026,.030]],'hair',48);
  for(const [i,p] of hair.rings[0].entries()){
    const f=Math.sin(i*Math.PI/24);
    const a=i*Math.PI/24;
    const side=Math.cos(a);
    p[1]=.132+.081*f+.006*Math.sin(7*a)+.005*Math.sin(13*a)+.015*side*(c.slug==='kelly'||c.slug==='gaston'?1:.45);
    p[0]*=.98;
    hair.rings[1][i][1]=Math.max(.201,p[1]+.009);
  }
  for(let row=1;row<hair.rings.length;row++) for(const [i,p] of hair.rings[row].entries()){
    const angle=i*Math.PI/24;
    p[1]+=.003*Math.sin(5*angle+row)+.002*Math.sin(9*angle-row);
    if(row>=2){p[0]*=1.01;p[1]+=.006;}
  }
  part('head',hair);
  for(const sign of [-1,1])part('head',profile([[.078,sign*.095,0,.007,.009],[.101,sign*.098,0,.014,.017],[.125,sign*.095,0,.008,.012]],'skin',16));
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const upperArm = 'upper_arm_' + side, forearm = 'forearm_' + side, hand = 'hand_' + side;
    const thigh = 'thigh_' + side, shin = 'shin_' + side, foot = 'foot_' + side;
    joint(upperArm, 'spine', [sign * 0.169*c.build, 0.273, 0]);
    joint(forearm, upperArm, [sign * 0.045, -0.250, 0]);
    joint(hand, forearm, [sign * 0.018, -0.207, 0.007]);
    joint(thigh, 'hips', [sign * 0.092, 0, 0]);
    joint(shin, thigh, [0, -thighLength, 0]);
    joint(foot, shin, [0, -shinLength, 0]);

    part(upperArm, profile([[-0.126, sign * 0.025, 0, 0.062, 0.064],
      [-0.053, sign * 0.008, 0, 0.068, 0.069], [0.039, -sign * 0.013, 0, 0.047, 0.052],[0.054,-sign*.024,0,.025,.035]], c.slug==='kelly'?'skin':c.slug==='ricardo_uruguayo'?'jacketPanel':'shirt'));
    part(upperArm,profile([[-.261,sign*.046,0,.041,.046],[-.100,sign*.025,0,.051,.054]],long?'shirt':'skin',20));
    part(forearm, profile([[-0.165, sign * 0.016, 0.006, 0.036, 0.041],
      [-0.017, sign * 0.002, 0, 0.048, 0.049], [0.031, 0, 0, 0.044, 0.044]], long?'shirt':'skin'));
    part(forearm, profile([[-0.222, sign * 0.019, 0.006, 0.031, 0.032],
      [-0.143, sign * 0.014, 0.006, 0.036, 0.039]], 'skin'));
    part(hand,profile([[-.054,0,.009,.019,.032],[-.027,0,.007,.022,.035],[.01,0,.005,.022,.025]],'skin',20));
    for(let finger=0;finger<4;finger++){
      const z=.034-finger*.016,len=[.058,.062,.057,.044][finger];
      part(hand,profile([[-.044-len,-sign*.008,z+.003,.005,.005],[-.038-len,-sign*.006,z+.003,.007,.007],
        [-.065,0,z,.008,.008],[-.045,0,z,.009,.009]],'skin',12));
    }
    part(hand,profile([[-.063,-sign*.018,.046,.006,.006],[-.049,-sign*.015,.046,.009,.010],
      [-.024,-sign*.008,.036,.012,.014]],'skin',16));
    part(thigh, profile([[-0.431, 0, 0, 0.059, 0.070], [-0.27, 0, 0, 0.071, 0.081],
      [0.021, 0, 0, 0.087, 0.104]], 'trousers'));
    part(shin, profile([[-0.365, 0, 0, 0.052, 0.056], [-0.153, 0, -0.006, 0.067, 0.069],
      [0.033, 0, 0, 0.059, 0.064]], 'trousers'));
    if(c.slug==='gaston'||c.slug==='david'){
      part(foot,profile([[-.039,0,.016,.060,.08],[.029,0,-.004,.058,.063],[.092,0,-.006,.060,.061]],'shoe'));
      for(let k=0;k<5;k++) part(foot,box([0,.010+k*.013,.060-k*.0014],[.054,.0035,.003],'graphite',.001));
    }
    if(c.slug==='david') part(thigh,box([sign*.061,-.190,.03],[.043,.105,.083],'trousers',.008));
    part(foot, box([0, -ankleHeight + 0.016, 0.048], [0.126, 0.032, 0.242], 'rubber', 0.006));
    part(foot,profile([[-ankleHeight+.024,0,.049,.061,.115],[-ankleHeight+.043,0,.050,.062,.117],
      [-ankleHeight+.058,0,.039,.059,.105],[-ankleHeight+.078,0,.004,.052,.07],
      [-ankleHeight+.09,0,-.010,.044,.049]],'shoe',32));
  }

  glb.node('VISUAL', 0, { mesh: glb.mesh(pieces, true), skin: 0 });
  const inverseBinds = [...byName.values()].flatMap(({ bind: [x, y, z] }) =>
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
  glb.doc.skins = [{ name: 'RIG_EMPLOYEE_001', inverseBindMatrices: glb.accessor(inverseBinds, 'MAT4'),
    skeleton: armature, joints }];

  function clip(name, duration, samples, pose) {
    const samplers = [], channels = [];
    const input = glb.accessor(Array.from({ length: samples }, (_, i) => i * duration / (samples - 1)),
      'SCALAR', 5126, undefined, true);
    const poses = Array.from({ length: samples }, (_, i) => pose(i === samples - 1 ? 0 : i / (samples - 1)));
    for (const [key, tracks] of Object.entries(poses[0])) {
      for (const path of Object.keys(tracks)) {
        const output = glb.accessor(poses.flatMap((p) => p[key][path]), path === 'rotation' ? 'VEC4' : 'VEC3');
        const sampler = samplers.push({ input, output, interpolation: 'LINEAR' }) - 1;
        channels.push({ sampler, target: { node: byName.get(key).node, path } });
      }
    }
    return { name, samplers, channels };
  }

  const rotate = (a) => ({ rotation: qx(a) });
  const idle = clip('Idle', 3.2, 25, (phase) => {
    const breath = Math.sin(phase * Math.PI * 2);
    return {
      spine: rotate(0.026 * breath), head: rotate(-0.018 * breath),
      upper_arm_l: rotate(0.023 * breath), upper_arm_r: rotate(0.023 * breath),
      forearm_l: rotate(-0.07 - 0.015 * breath), forearm_r: rotate(-0.07 - 0.015 * breath),
    };
  });

  const walk = clip('Walk', 1.12, 57, (phase) => {
    const y = 0.830 - 0.008 * Math.cos(4 * Math.PI * phase);
    const pose = { hips: { translation: [0, y, 0] }, spine: rotate(0.048),
      head: rotate(-0.023 + 0.012 * Math.sin(4 * Math.PI * phase)) };
    for (const [side, offset] of [['l', 0], ['r', 0.5]]) {
      const step = (phase + offset) % 1;
      const swing = Math.max(0, (step - 0.60) / 0.40);
      const reach = 0.185;
      const z = step < 0.60 ? reach * (1 - 2 * step / 0.60) : reach * (2 * (3 - 2 * swing) * swing ** 2 - 1);
      const lift = 0.135 * Math.sin(Math.PI * swing) ** 2;
      const down = y - ankleHeight - lift;
      const d = Math.hypot(down, z);
      const bend = Math.acos(Math.max(-1, Math.min(1,
        (d ** 2 - thighLength ** 2 - shinLength ** 2) / (2 * thighLength * shinLength))));
      const lean = Math.atan2(-z, down);
      const upper = lean - Math.atan2(shinLength * Math.sin(bend), thighLength + shinLength * Math.cos(bend));
      pose['thigh_' + side] = rotate(upper);
      pose['shin_' + side] = rotate(bend);
      pose['foot_' + side] = rotate(-upper - bend);
      const armSwing = Math.cos(2 * Math.PI * step);
      pose['upper_arm_' + side] = rotate(0.36 * armSwing);
      pose['forearm_' + side] = rotate(-0.19 + 0.07 * armSwing);
    }
    return pose;
  });
  glb.doc.animations = [idle, walk];
  return glb;
}

const roster=JSON.parse(readFileSync(resolve(project,files.references),'utf8'));
const definitions=roster.map(c=>({glb:employee(c),name:c.slug+'_001',type:'char',reference:c.slug,anchors:[]}));

const assets = definitions.map(({ glb, name, type, reference, anchors }) => {
  const id = glb.doc.nodes[0].extras.asset_id;
  const file = 'assets/' + (type === 'char' ? 'characters' : 'furniture') + '/' + name + '.glb';
  const binary = glb.encode();
  write('public/' + file, binary);
  const isCharacter = type === 'char';
  const animation_details = (glb.doc.animations ?? []).map(({ name, channels }) => {
    const sampler = glb.doc.animations.find((clip) => clip.name === name).samplers[0];
    return { name, duration_s: tidy(glb.doc.accessors[sampler.input].max[0]), loop: true,
      in_place: true, channels: channels.length };
  });
  return {
    id, type, version: glb.doc.nodes[0].extras.asset_version, status: 'ready_for_review', fidelity: 'provisional', file,
    file_size_bytes: binary.length, sha256: createHash('sha256').update(binary).digest('hex'),
    source: { generator: files.generator, blender_script: files.blender, blend_file: null },
    dimensions_m: minus(glb.max, glb.min).map(tidy),
    bounds_m: { min: glb.min.map(tidy), max: glb.max.map(tidy) },
    triangles: glb.triangles,
    materials: glb.doc.materials.map((m) => m.name), textures: glb.doc.images.map(image=>image.name),
    root: 'ROOT', pivot_m: [0, 0, 0], initial_rotation_xyzw: [0, 0, 0, 1], scale: [1, 1, 1],
    ...(isCharacter && { front: '+Z', rig: 'RIG_EMPLOYEE_001', joints: glb.doc.skins[0].joints.map((i) => glb.doc.nodes[i].name) }),
    hierarchy: glb.doc.nodes.map((n) => ({ name: n.name, children: (n.children ?? []).map((i) => glb.doc.nodes[i].name) })),
    anchors: anchors.map(({ name }) => name), anchor_details: anchors,
    animations: animation_details.map(({ name }) => name), animation_details,
    pending_animations: isCharacter ? ['Sit', 'Talk', 'Interact', 'React'] : [],
    references: [reference],
    limitations: isCharacter
      ? ['Rig segmentado de peso rígido, sin retargeting probado', 'Posición de reposo usada para las dimensiones']
      : ['Mobiliario genérico de prueba', 'Colisiones a cargo de Cuenta B'],
  };
});

write(files.manifest, JSON.stringify({
  schema_version: '1.0.0', schema_status: 'character_delivery', contract_version: '1.0',
  package_id: 'A-005', package_version: version,
  coordinates: { dimension_order: ['X', 'Y', 'Z'], unit: 'm', up: '+Y', character_front: '+Z', handedness: 'right' },
  files, assets,
}, null, 2) + '\n');
