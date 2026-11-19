import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const assetVersion = '1.2.0';
const assetId = 'furniture.desk.001';
const clusterId = 'env.desk_cluster.001';
const clusterVersion = '0.3.0';
const files = {
  glb: 'assets/furniture/desk_001.glb',
  cluster: 'assets/environment/desk_cluster_001.glb',
  manifest: 'data/assets.json',
  references: 'data/references.json',
  generator: 'source_3d/scripts/generate_a002.mjs',
  blender: 'source_3d/scripts/create_blends.py',
  verifier: 'source_3d/scripts/verify_a002.mjs',
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
  wood: ['MAT_CABINET_WOOD','#ab6535',0,0.49],
  alloy: ['MAT_NOTEBOOK_ALLOY','#68717a',0.45,0.4],
  lcd: ['MAT_NOTEBOOK_LCD','#435865',0.09,0.33],
  blue: ['MAT_BINDER_BLUE', '#344f8f', 0, 0.61],
  silver: ['MAT_PLATED_STEEL', '#b3b6b5', 0.78, 0.28],
  amber: ['MAT_STATIONERY', '#d3a636', 0, 0.6],
  laminate: ['MAT_WHITE_LAMINATE', '#eae8e1', 0, 0.56],
  panel: ['MAT_WHITE_PANEL', '#e6e4dc', 0, 0.65],
  foot: ['MAT_PANEL_GLIDE', '#b0ada5', 0, 0.78],
  cap: ['MAT_CABLE_CAP', '#bcbab0', 0, 0.63],
  slot: ['MAT_CABLE_SLOT', '#756f63', 0, 0.81],
  trim: ['MAT_DARK_FRAME', '#292e32', 0.1, 0.66],
  caster: ['MAT_CASTER', '#1d2124', 0, 0.86],
  seat: ['MAT_CHAIR_FABRIC', '#323b40', 0, 0.91],
  mesh: ['MAT_CHAIR_MESH', '#414b4e', 0, 0.94],
  screen: ['MAT_MONITOR_DISPLAY', '#2e3f4d', 0, 0.46],
  keyboard: ['MAT_KEYCAPS', '#434a50', 0, 0.78],
  paper: ['MAT_PAPER', '#f4f0e0', 0, 0.92],
  binder: ['MAT_BINDER_GREEN', '#43715b', 0, 0.72],
  thermos: ['MAT_THERMOS_STEEL', '#8d989e', 0.55, 0.4],
};

function pbr([name, hex, metallicFactor, roughnessFactor]) {
  const rgb = hex.slice(1).match(/../g).map((c) => Number.parseInt(c, 16) / 255);
  const linear = rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return { name, pbrMetallicRoughness: { baseColorFactor: [...linear, 1], metallicFactor, roughnessFactor } };
}

class Glb {
  constructor(id, version) {
    this.doc = {
      asset: { version: '2.0', generator: 'Sabri Game A-002 procedural source' },
      scene: 0,
      scenes: [{ name: 'SCENE', nodes: [0] }],
      nodes: [{ name: 'ROOT', extras: { asset_id: id, asset_version: version } }],
      meshes: [], materials: [], accessors: [], bufferViews: [],
    };
    this.materials = new Map();
    this.chunks = [];
    this.bytes = 0;
    this.meshStats = [];
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

  mesh(pieces) {
    const groups = Map.groupBy(pieces, (piece) => piece.material);
    const primitives = [];
    let triangles = 0;
    for (const [material, members] of groups) {
      const positions = [], normals = [], indices = [], uvs = [];
      const textured = ['seat','mesh','screen','wood','lcd'].includes(material);
      for (const { rings } of members) {
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
            if (textured) {
              const [x,y,z] = point;
              uvs.push(...(material === 'wood' ? [Math.abs(normal[0])>0.6 ? z : x, Math.abs(normal[1])>0.6 ? z : y] :
                material === 'lcd' ? [0.5+x/0.305,1-(y-0.026)/0.175] : material === 'screen' ? [0.5 + x/0.480, 0.5 - (y-0.267)/0.267] :
                [x*13, (Math.abs(normal[1]) > 0.6 ? z : -y)*13]));
            }
            normals.push(...normal.map((v) => v / length));
          }
          for (let i = 1; i < face.length - 1; i++) indices.push(first, first + i, first + i + 1);
        }
      }
      triangles += indices.length / 3;
      const attributes = {
        POSITION: this.accessor(positions, 'VEC3', 5126, 34962, true),
        NORMAL: this.accessor(normals, 'VEC3', 5126, 34962),
      };
      if (textured) attributes.TEXCOORD_0 = this.accessor(uvs,'VEC2',5126,34962);
      primitives.push({ attributes, indices: this.accessor(indices, 'SCALAR', 5123, 34963), material: this.material(material) });
    }
    this.meshStats.push({ triangles, points: pieces.flatMap(({ rings }) => rings.flat()) });
    return this.doc.meshes.push({ primitives }) - 1;
  }

  measure() {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let triangles = 0;
    const visit = (index, origin, yaw) => {
      const { translation = [0, 0, 0], rotation, mesh, children = [] } = this.doc.nodes[index];
      const position = plus(origin, rotateY(translation, yaw));
      const angle = yaw + (rotation ? 2 * Math.atan2(rotation[1], rotation[3]) : 0);
      if (mesh !== undefined) {
        triangles += this.meshStats[mesh].triangles;
        for (const point of this.meshStats[mesh].points) {
          plus(position, rotateY(point, angle)).forEach((value, axis) => {
            min[axis] = Math.min(min[axis], value);
            max[axis] = Math.max(max[axis], value);
          });
        }
      }
      for (const child of children) visit(child, position, angle);
    };
    visit(0, [0, 0, 0], 0);
    return { min, max, triangles };
  }

  encode() {
    const images = new Map();
    for (const [key, filename] of [['mesh','weave.png'], ['seat','weave.png'], ['screen','desktop.png'],['lcd','desktop.png'],['wood','wood.png']]) {
      if (!this.materials.has(key)) continue;
      if (!images.has(filename)) {
        const data = readFileSync(new URL('./textures/' + filename, import.meta.url));
        const view = this.doc.bufferViews.push({buffer:0, byteOffset:this.bytes, byteLength:data.length})-1;
        const padding = (4-data.length%4)%4;
        this.chunks.push(data, Buffer.alloc(padding));
        this.bytes += data.length+padding;
        const source = (this.doc.images ??= []).push({name:filename, mimeType:'image/png', bufferView:view})-1;
        images.set(filename, (this.doc.textures ??= []).push({source})-1);
      }
      const params = this.doc.materials[this.materials.get(key)].pbrMetallicRoughness;
      params.baseColorFactor=[1,1,1,1];
      params.baseColorTexture={index:images.get(filename)};
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

function profile(rings, material, sides = 8) {
  return {
    material,
    rings: rings.map(([y, x, z, width, depth]) => Array.from({ length: sides }, (_, i) => {
      const phase = 2 * Math.PI * i / sides;
      return [x + width * Math.cos(phase), y, z + depth * Math.sin(phase)];
    })),
  };
}

const geometry = {
  length: 4.7,
  depth: 1.2,
  height: 0.75,
  boardThickness: 0.03,
  bays: 4,
  jointWidth: 0.0012,
};
const { length, depth, height, boardThickness, bays, jointWidth } = geometry;
const halfDepth = depth / 2;
const centerDepth = halfDepth / 2;
const boardY = height - boardThickness / 2;
const underTop = height - boardThickness;
const bayWidth = length / bays;
const bayCenters = Array.from({ length: bays }, (_, i) => -length / 2 + bayWidth * (i + 0.5));

function addDesk(glb, visual, anchorParent) {
  const top = [];
  const supports = [];
  const covers = [];
  const glides = [];

  for (const side of [-1, 1]) {
    const innerEdge = jointWidth / 2;
    const z = side * (centerDepth + innerEdge / 2);
    for (const [i, x] of bayCenters.entries()) {
      const leftGap = i === 0 ? 0 : jointWidth / 2;
      const rightGap = i === bays - 1 ? 0 : jointWidth / 2;
      const shiftedX = x + (leftGap - rightGap) / 2;
      top.push(box([shiftedX, boardY, z], [bayWidth - leftGap - rightGap, boardThickness, halfDepth - innerEdge],
        'laminate', 0.00065));

      const coverX = x + bayWidth * 0.30;
      const coverZ = side * 0.096;
      covers.push(profile([[height - 0.001, coverX, coverZ, 0.029, 0.029],
        [height + 0.0006, coverX, coverZ, 0.028, 0.028]], 'cap', 16));
      covers.push(box([coverX, height + 0.00075, coverZ + side * 0.011],
        [0.028, 0.0005, 0.007], 'slot'));
    }

    const endInset = 0.135;
    const supportsX = [-length / 2 + endInset,
      ...bayCenters.slice(0, -1).map((x) => x + bayWidth / 2),
      length / 2 - endInset];
    for (const x of supportsX) {
      const glideHeight = 0.006;
      const panelCenter = side * (centerDepth + 0.002);
      supports.push(box([x, (underTop + glideHeight) / 2, panelCenter],
        [0.028, underTop - glideHeight, halfDepth - 0.069], 'panel', 0.00085));
      for (const offset of [-0.21, 0.21]) {
        glides.push(box([x, glideHeight / 2, panelCenter + offset],
          [0.024, glideHeight, 0.055], 'foot'));
      }
    }

    for (const x of bayCenters) {
      supports.push(box([x, 0.647, side * 0.052], [bayWidth - 0.04, 0.146, 0.027],
        'panel'));
    }
  }

  glb.node('DESK_TOP', visual, { mesh: glb.mesh(top) });
  glb.node('DESK_FRAME', visual, { mesh: glb.mesh([...supports, ...glides]) });
  glb.node('DESK_CABLE_COVERS', visual, { mesh: glb.mesh(covers) });
  glb.node('ANCHOR_DESK_TOP', anchorParent, { translation: [0, height, 0] });
}

function buildDesk() {
  const glb = new Glb(assetId, assetVersion);
  addDesk(glb, glb.node('VISUAL', 0), 0);
  return glb;
}

function rotateY([x, y, z], angle) {
  return [Math.cos(angle) * x + Math.sin(angle) * z, y, -Math.sin(angle) * x + Math.cos(angle) * z];
}

function mapShape(shape, transform) {
  return { ...shape, rings: shape.rings.map((ring) => ring.map(transform)) };
}

function round(x, z, bottom, top, radius, material, sides = 12) {
  return profile([[bottom, x, z, radius, radius], [top, x, z, radius, radius]], material, sides);
}

function chairPieces() {
  const pieces = [
    box([0, 0.414, 0.015], [0.39, 0.038, 0.36], 'trim', 0.006),
    profile([[0.415,0,0.022,0.198,0.181],[0.430,0,0.022,0.234,0.214],
      [0.461,0,0.022,0.24,0.218],[0.479,0,0.022,0.226,0.208],
      [0.485,0,0.022,0.198,0.183]],'seat',32),
    round(0, -0.02, 0.100, 0.404, 0.033, 'trim'),
    box([0, 0.508, -0.166], [0.069, 0.19, 0.039], 'trim', 0.005),
  ];
  const backAngle = -0.16;
  const joinBack = (shape) => mapShape(shape, ([x, y, z]) => [
    x, 0.554 + Math.cos(backAngle) * y - Math.sin(backAngle) * z,
    -0.173 + Math.sin(backAngle) * y + Math.cos(backAngle) * z,
  ]);
  // Tapered, swept backrest shell and inset upholstered pad.
  pieces.push(joinBack(profile([[0,0,0,0.145,0.019],[0.055,0,0,0.188,0.029],
    [0.195,0,0.012,0.205,0.036],[0.335,0,-0.006,0.212,0.030],
    [0.43,0,-0.014,0.206,0.026],[0.466,0,-0.014,0.171,0.022]],'trim',32)));
  pieces.push(joinBack(profile([[0.018,0,0.016,0.14,0.016],[0.08,0,0.02,0.181,0.025],
    [0.20,0,0.033,0.197,0.029],[0.34,0,0.011,0.204,0.026],
    [0.448,0,0.005,0.177,0.018]],'mesh',32)));
  pieces.push(round(0,-0.02,0.215,0.394,0.034,'silver',24),
    box([0.120,0.387,0.03],[0.160,0.012,0.016],'trim',0.003),
    box([0.194,0.384,0.03],[0.058,0.020,0.038],'trim',0.007));
  for (const x of [-0.239, 0.239]) {
    pieces.push(
      box([x, 0.525, -0.032], [0.025, 0.162, 0.033], 'trim', 0.004),
      box([x, 0.611, 0.042], [0.058, 0.025, 0.216], 'seat', 0.009),
    );
  }
  pieces.push(round(0, -0.02, 0.054, 0.128, 0.060, 'trim'));
  for (let leg = 0; leg < 5; leg++) {
    const angle = 2 * Math.PI * leg / 5;
    const rotateLeg = (shape) => mapShape(shape, (point) => plus(rotateY(point, angle), [0, 0, -0.02]));
    pieces.push(
      rotateLeg(box([0, 0.080, 0.155], [0.050, 0.034, 0.269], 'trim', 0.006)),
      rotateLeg(round(0, 0.281, 0.029, 0.070, 0.024, 'trim', 10)),
      rotateLeg(mapShape(round(0, 0, -0.021, 0.021, 0.032, 'caster', 12),
        ([x, y, z]) => [y, 0.032 + x, 0.282 + z])),
    );
  }
  return pieces;
}

function cable(points, material, radius) {
  return points.slice(1).map((b,i) => {
    const a=points[i], delta=minus(b,a), len=Math.hypot(...delta);
    const axis=delta.map(v=>v/len);
    const u=cross(axis, Math.abs(axis[1])<0.9 ? [0,1,0] : [1,0,0]);
    const radial=u.map(v=>v/Math.hypot(...u)), tangent=cross(axis,radial);
    return {material, rings:[a,b].map(p=>Array.from({length:8},(_,k)=>
      p.map((v,j)=>v+radius*(radial[j]*Math.cos(k*Math.PI/4)+tangent[j]*Math.sin(k*Math.PI/4)))))};
  });
}

function monitorPieces() {
  return [
    ...cable([[0,0.198,-0.026],[0.035,0.147,-0.047],[0.068,0.05,-0.060],[0.105,0.005,-0.066],[0.22,0.002,-0.051]],'caster',0.0025),
    ...Array.from({length:22},(_,i)=>box([-0.16+i*0.015,0.296,-0.010],[0.009,0.028,0.003],'caster')),
    box([0,0.208,-0.016],[0.19,0.10,0.020],'trim',0.004),
    box([0, 0.008, 0], [0.237, 0.016, 0.159], 'trim', 0.006),
    box([0, 0.092, -0.032], [0.038, 0.168, 0.041], 'trim', 0.006),
    box([0, 0.260, 0.007], [0.505, 0.298, 0.032], 'trim', 0.007),
    box([0, 0.267, 0.022], [0.480, 0.267, 0.006], 'screen', 0.002),
  ];
}

function inputPieces() {
  const keys = Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 13 }, (_, col) =>
      box([-0.211 + col * 0.027, 0.015, -0.041 + row * 0.025], [0.021, 0.006, 0.020], 'keyboard'))).flat();
  return [
    box([-0.05, 0.007, 0], [0.387, 0.014, 0.119], 'trim', 0.004),
    ...keys,
    box([0.216, 0.002, 0.001], [0.158, 0.004, 0.167], 'seat', 0.0015),
    box([0.219, 0.019, 0.005], [0.062, 0.031, 0.106], 'trim', 0.012),
  ];
}

const deskAnchor = {
  name: 'ANCHOR_DESK_TOP', translation_m: [0, height, 0], forward: '+Z',
  purpose: 'Centro del tablero a su altura nominal, sobre la unión longitudinal.',
};
const photoRefs = ['reference.office_photo.001', 'reference.office_photo.002', 'reference.office_photo.003'];
const surveyRef = 'reference.desk_measurement.001';

function laptopPieces() {
  const lid = shape => mapShape(shape, ([x,y,z]) => [x,0.018+0.966*y+0.259*z,-0.108-0.259*y+0.966*z]);
  const pieces=[
    box([0,0.008,0],[0.335,0.016,0.224],'alloy',0.006),
    box([0,0.016,0.067],[0.110,0.002,0.053],'trim',0.001),
    box([0,0.0174,0.067],[0.106,0.001,0.049],'alloy'),
    lid(box([0,0.095,0],[0.334,0.19,0.008],'trim',0.003)),
    lid(box([0,0.098,0.0045],[0.305,0.171,0.001],'lcd'))];
  for(let row=0;row<4;row++){
    for(let col=0;col<14;col++){
      pieces.push(box([(col-6.5)*0.021,0.018,-0.072+row*0.019],[0.018,0.003,0.016],'keyboard'));
    }
  }
  pieces.push(box([0,0.018,0.005],[0.122,0.003,0.014],'keyboard'));
  return pieces;
}

function addSideboard(glb, visual) {
  // Cabinet fronts face the outer, short end of the workstation.
  const cabinet=glb.node('SIDEBOARD_LEFT',visual,{translation:[-2.606,0,0]});
  const carcass=[
    box([0,0.032,0],[0.454,0.064,1.15],'wood'),
    box([0,0.080,0],[0.48,0.032,1.18],'wood'),
    box([0.224,0.427,0],[0.018,0.671,1.16],'wood'),
    box([0,0.395,0],[0.459,0.019,1.15],'wood'),
    box([0,0.77,0],[0.498,0.028,1.21],'trim',0.002),
    box([0,0.785,0],[0.495,0.010,1.205],'wood',0.002)];
  for(const z of [-0.58,0.58]) carcass.push(box([0,0.425,z],[0.482,0.669,0.020],'wood'));
  glb.node('SIDEBOARD_BODY',cabinet,{mesh:glb.mesh(carcass)});
  for(const [index,z] of [-0.286,0.218].entries()){
    const x=-0.222+index*0.022;
    const gripZ=z+(index===0?-0.237:0.237);
    glb.node('SIDEBOARD_DOOR_0'+(index+1),cabinet,{mesh:glb.mesh([
      box([x,0.423,z],[0.017,0.65,0.561],'wood',0.002),
      ...cable([[x-0.01,0.51,gripZ],[x-0.032,0.497,gripZ],[x-0.032,0.41,gripZ],[x-0.01,0.397,gripZ]],'silver',0.004)])});
  }
  glb.node('SIDEBOARD_COFFEE',cabinet,{mesh:glb.mesh([
    box([0.045,0.805,-0.29],[0.19,0.03,0.20],'trim',0.009),
    box([0.095,0.915,-0.29],[0.072,0.21,0.15],'caster',0.014),
    box([0.032,1.035,-0.29],[0.19,0.054,0.19],'trim',0.014),
    profile([[0.823,-0.003,-0.29,0.053,0.053],[0.850,-0.003,-0.29,0.066,0.066],
      [0.922,-0.003,-0.29,0.053,0.053],[0.934,-0.003,-0.29,0.05,0.05]],'thermos',24),
    round(-0.003,-0.29,0.934,0.944,0.055,'caster',24),
    profile([[0.79,0,0.17,0.068,0.069],[0.81,0,0.17,0.086,0.085],[0.982,0,0.17,0.072,0.074]],'paper',32),
    box([-0.079,0.793,0.43],[0.191,0.006,0.24],'paper')])});
}

function buildCluster() {
  const glb = new Glb(clusterId, clusterVersion);
  const visual = glb.node('VISUAL', 0);
  const desk = glb.node('DESK', visual);
  addDesk(glb, desk, desk);
  addSideboard(glb,visual);
  const laptop = glb.mesh(laptopPieces());
  const chair = glb.mesh(chairPieces());
  const monitor = glb.mesh(monitorPieces());
  const inputs = glb.mesh(inputPieces());
  const folder = glb.mesh([
    box([0, 0.008, 0], [0.241, 0.016, 0.326], 'binder', 0.0025),
    box([0.008, 0.018, 0.012], [0.207, 0.005, 0.283], 'paper'),
  ]);
  const thermos = glb.mesh([
    round(0, 0, 0, 0.019, 0.038, 'trim'),
    round(0, 0, 0.019, 0.218, 0.037, 'thermos'),
    profile([[0.218, 0, 0, 0.035, 0.035], [0.243, 0, 0, 0.027, 0.027]], 'trim', 12),
  ]);
  const stationery = glb.mesh([
    box([0,0.018,0],[0.225,0.036,0.292],'blue',0.006),
    box([0.007,0.038,0],[0.201,0.006,0.27],'paper'),
    ...[-0.054,0.056].map(z=>box([-0.096,0.044,z],[0.017,0.007,0.012],'silver',0.002)),
    ...cable([[-0.076,0.045,0.094],[0.04,0.045,0.021]],'amber',0.004)]);
  const anchors = [deskAnchor];

  for (const side of [1, -1]) {
    const faceSeat = side === 1 ? [0, 0, 0, 1] : [0, 1, 0, 0];
    const faceDesk = side === 1 ? [0, 1, 0, 0] : [0, 0, 0, 1];
    for (const [bay, x] of bayCenters.entries()) {
      const suffix = String((side === 1 ? [1,7,2,3] : [4,8,5,6])[bay]).padStart(2,'0');
      const group = glb.node('WORKSTATION_' + suffix, visual, { translation: [x, 0, 0] });
      const chairYaw = (side === 1 ? Math.PI : 0) + side * [0.06,-0.16,0.09,-0.05][bay];
      const chairName = 'CHAIR_' + suffix;
      const chairNode = glb.node(chairName, group, {
        mesh: chair, translation: [0, 0, side * (0.955 + [0.015,-0.045,0.03,0][bay])], rotation: [0, Math.sin(chairYaw/2),0, Math.cos(chairYaw/2)],
      });
      const anchor = { name: 'ANCHOR_SIT_' + suffix, parent: chairName,
        translation_m: [0, 0.485, 0.022], forward: '+Z', purpose: 'Centro del asiento de este puesto.' };
      glb.node(anchor.name, chairNode, { translation: anchor.translation_m });
      anchors.push(anchor);
      if (bay === 1) {
        glb.node('STATIONERY_'+suffix,group,{mesh:stationery,translation:[side*0.32,height,side*0.24], rotation:faceSeat});
        continue;
      }
      const offset = side === 1 ? -0.100 : 0.100;
      if (side === -1) {
        glb.node('NOTEBOOK_'+suffix,group,{mesh:laptop,translation:[offset,height,-0.324],rotation:faceSeat});
      } else {
      glb.node('MONITOR_' + suffix, group, {
        mesh: monitor, translation: [offset, height, side * 0.156], rotation: faceSeat,
      });
      glb.node('KEYBOARD_MOUSE_' + suffix, group, {
        mesh: inputs, translation: [offset, height, side * 0.388], rotation: faceSeat,
      });
      }
      if (bay !== 2) {
        glb.node('FOLDER_' + suffix, group, {
          mesh: folder, translation: [-side * 0.419, height, side * 0.365], rotation: faceSeat,
        });
      }
      if (bay === 2) {
        glb.node('THERMOS_' + suffix, group, { mesh: thermos, translation: [side * 0.362, height, side * 0.235] });
      }
    }
  }
  return { glb, anchors };
}

function exportAsset(glb, file, type, anchors, attributes) {
  const binary = glb.encode();
  const { min, max, triangles } = glb.measure();
  const { asset_id: id, asset_version: version } = glb.doc.nodes[0].extras;
  write('public/' + file, binary);
  return {
    id, type, file, version, status: 'ready_for_review', fidelity: 'provisional',
    file_size_bytes: binary.length, sha256: createHash('sha256').update(binary).digest('hex'),
    source: { generator: files.generator, blender_script: files.blender, blend_file: null },
    dimensions_m: minus(max, min).map(tidy), bounds_m: { min: min.map(tidy), max: max.map(tidy) },
    nominal_worktop_height_m: height, triangles,
    root: 'ROOT', pivot_m: [0, 0, 0], initial_rotation_xyzw: [0, 0, 0, 1], scale: [1, 1, 1],
    hierarchy: glb.doc.nodes.map((n) => ({ name: n.name,
      children: (n.children ?? []).map((index) => glb.doc.nodes[index].name) })),
    materials: glb.doc.materials.map((m) => m.name), textures: (glb.doc.images ?? []).map(i=>i.name),
    anchors: anchors.map((anchor) => anchor.name), anchor_details: anchors,
    animations: [], animation_details: [], pending_animations: [], references: [...photoRefs, surveyRef, 'reference.layout_markup.001'],
    ...attributes,
  };
}

const desk = exportAsset(buildDesk(), files.glb, 'furniture', [deskAnchor], {
  replaces: { package_id: 'A-001', asset_version: '0.1.0' },
  measurement_status: 'confirmed',
  limitations: ['Modulación de cuatro tramos por lado interpretada de las fotos', 'Cubiertas de cables representadas cerradas'],
});
const cluster = buildCluster();
const arrangement = exportAsset(cluster.glb, files.cluster, 'env', cluster.anchors, {
  measurement_status: 'confirmed_desk_only',
  references: [...photoRefs,surveyRef,'reference.layout_markup.001','reference.sideboard.001'],
  limitations: ['Ubicaciones y modelos de los accesorios interpretados de las fotos',
    'Composición visual de ocho sillas y tres monitores delanteros y tres notebooks enfrente', 'La Cuenta B define la colisión y la circulación'],
});
const manifest = {
  schema_version: '1.0.0', contract_version: '1.0',
  package_id: 'A-002', package_version: '0.4.0', delivery_mode: 'delta',
  coordinates: { dimension_order: ['X', 'Y', 'Z'], unit: 'm', up: '+Y', handedness: 'right' },
  files,
  assets: [desk, arrangement],
};
write(files.manifest, JSON.stringify(manifest, null, 2) + '\n');
