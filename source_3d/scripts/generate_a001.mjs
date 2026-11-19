import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const version = '0.1.0';
const files = {
  generator: 'source_3d/scripts/generate_a001.mjs',
  blender: 'source_3d/scripts/create_blends.py',
  verifier: 'source_3d/scripts/verify_a001.mjs',
  manifest: 'data/assets.json',
  references: 'data/references.json',
  schema: 'data/schemas/assets-a001.proposal.schema.json',
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
  oak: ['MAT_OAK', '#b9825c', 0, 0.63],
  graphite: ['MAT_GRAPHITE', '#41494f', 0.55, 0.51],
  upholstery: ['MAT_UPHOLSTERY', '#436666', 0, 0.89],
  rubber: ['MAT_RUBBER', '#252930', 0, 0.83],
  skin: ['MAT_SKIN', '#b97858', 0, 0.78],
  hair: ['MAT_HAIR', '#352722', 0, 0.84],
  shirt: ['MAT_SHIRT', '#ac5541', 0, 0.91],
  cotton: ['MAT_COTTON', '#e5cbb0', 0, 0.95],
  trousers: ['MAT_TROUSERS', '#344759', 0, 0.89],
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
      asset: { version: '2.0', generator: 'Sabri Game A-001 procedural source' },
      scene: 0,
      scenes: [{ name: 'SCENE', nodes: [0] }],
      nodes: [{ name: 'ROOT', extras: { asset_id: id, asset_version: version } }],
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
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
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
      if (skinned) {
        attributes.JOINTS_0 = this.accessor(joints, 'VEC4', 5121, 34962);
        attributes.WEIGHTS_0 = this.accessor(weights, 'VEC4', 5126, 34962);
      }
      primitives.push({ attributes, indices: this.accessor(indices, 'SCALAR', 5123, 34963), material: this.material(material) });
    }
    return this.doc.meshes.push({ primitives }) - 1;
  }

  encode() {
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

function desk() {
  const glb = new Glb('furniture.desk.001');
  const visual = glb.node('VISUAL', 0);
  glb.node('DESK_TOP', visual, { mesh: glb.mesh([box([0, 0.73, 0], [1.40, 0.04, 0.70], 'oak', 0.009)]) });
  const frame = [
    ...[-0.64, 0.64].flatMap((x) => [-0.29, 0.29].map((z) => box([x, 0.373, z], [0.045, 0.674, 0.045], 'graphite', 0.003))),
    ...[-0.29, 0.29].map((z) => box([0, 0.6875, z], [1.30, 0.045, 0.03], 'graphite', 0.003)),
    ...[-0.64, 0.64].map((x) => box([x, 0.6875, 0], [0.035, 0.045, 0.55], 'graphite', 0.003)),
    ...[-0.64, 0.64].flatMap((x) => [-0.29, 0.29].map((z) => box([x, 0.018, z], [0.048, 0.036, 0.048], 'rubber', 0.003))),
  ];
  glb.node('DESK_FRAME', visual, { mesh: glb.mesh(frame) });
  glb.node('ANCHOR_DESK_TOP', 0, { translation: [0, 0.75, 0] });
  return glb;
}

function chair() {
  const glb = new Glb('furniture.chair.001');
  const visual = glb.node('VISUAL', 0);
  glb.node('CHAIR_SEAT', visual, { mesh: glb.mesh([
    box([0, 0.395, 0.033], [0.455, 0.036, 0.425], 'graphite', 0.008),
    box([0, 0.429, 0.035], [0.48, 0.062, 0.45], 'upholstery', 0.018),
  ]) });
  glb.node('CHAIR_BACK', visual, { mesh: glb.mesh([
    box([0, 0.677, -0.22], [0.46, 0.386, 0.068], 'upholstery', 0.021),
  ]) });
  const legs = [-0.185, 0.185].flatMap((x) => [
    box([x, 0.38, -0.22], [0.034, 0.704, 0.034], 'graphite', 0.003),
    box([x, 0.207, 0.185], [0.034, 0.366, 0.034], 'graphite', 0.003),
    ...[-0.22, 0.185].map((z) => box([x, 0.014, z], [0.041, 0.028, 0.041], 'rubber', 0.003)),
  ]);
  glb.node('CHAIR_FRAME', visual, { mesh: glb.mesh(legs) });
  glb.node('ANCHOR_SIT', 0, { translation: [0, 0.46, 0.035] });
  return glb;
}

const hipHeight = 0.852;
const thighLength = 0.400;
const shinLength = 0.387;
const ankleHeight = hipHeight - thighLength - shinLength;
const qx = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];

function employee() {
  const glb = new Glb('char.employee.001');
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
  part('hips', profile([[-0.08, 0, 0, 0.148, 0.10], [0.027, 0, 0, 0.179, 0.108],
    [0.13, 0, 0, 0.165, 0.105]], 'trousers'));
  part('spine', profile([[-0.067, 0, 0, 0.161, 0.104], [0.09, 0, 0, 0.166, 0.112],
    [0.24, 0, 0, 0.211, 0.119], [0.325, 0, 0, 0.173, 0.092]], 'shirt'));
  part('spine', box([0, 0.12, 0.107], [0.061, 0.32, 0.037], 'cotton', 0.006));
  part('spine', box([-0.114, 0.194, 0.112], [0.062, 0.04, 0.023], 'cotton', 0.003));
  part('spine', profile([[0.31, 0, 0, 0.062, 0.059], [0.419, 0, 0, 0.054, 0.054]], 'skin'));
  part('head', profile([[0.009, 0, 0.024, 0.068, 0.063], [0.048, 0, 0.014, 0.089, 0.078],
    [0.148, 0, 0, 0.104, 0.092], [0.23, 0, -0.006, 0.085, 0.077]], 'skin', 10));
  part('head', profile([[0.163, 0, -0.013, 0.105, 0.093], [0.239, 0, -0.017, 0.096, 0.088],
    [0.293, 0, -0.018, 0.061, 0.064]], 'hair', 10));
  for (const x of [-1, 1]) {
    part('head', box([x * 0.101, 0.096, -0.002], [0.036, 0.061, 0.046], 'skin', 0.009));
    part('head', box([x * 0.037, 0.129, 0.089], [0.019, 0.015, 0.017], 'eye', 0.002));
  }
  part('head', box([0, 0.101, 0.092], [0.034, 0.045, 0.038], 'skin', 0.008));

  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const upperArm = 'upper_arm_' + side, forearm = 'forearm_' + side, hand = 'hand_' + side;
    const thigh = 'thigh_' + side, shin = 'shin_' + side, foot = 'foot_' + side;
    joint(upperArm, 'spine', [sign * 0.219, 0.256, 0]);
    joint(forearm, upperArm, [sign * 0.045, -0.250, 0]);
    joint(hand, forearm, [sign * 0.018, -0.207, 0.007]);
    joint(thigh, 'hips', [sign * 0.092, 0, 0]);
    joint(shin, thigh, [0, -thighLength, 0]);
    joint(foot, shin, [0, -shinLength, 0]);

    part(upperArm, profile([[-0.27, sign * 0.046, 0, 0.046, 0.053],
      [-0.053, sign * 0.008, 0, 0.068, 0.069], [0.057, -sign * 0.005, 0, 0.054, 0.054]], 'shirt'));
    part(forearm, profile([[-0.165, sign * 0.016, 0.006, 0.036, 0.041],
      [-0.017, sign * 0.002, 0, 0.048, 0.049], [0.031, 0, 0, 0.044, 0.044]], 'shirt'));
    part(forearm, profile([[-0.222, sign * 0.019, 0.006, 0.031, 0.032],
      [-0.143, sign * 0.014, 0.006, 0.036, 0.039]], 'skin'));
    part(hand, box([0, -0.043, 0.008], [0.060, 0.106, 0.066], 'skin', 0.014));
    part(thigh, profile([[-0.431, 0, 0, 0.059, 0.070], [-0.27, 0, 0, 0.071, 0.081],
      [0.021, 0, 0, 0.087, 0.104]], 'trousers'));
    part(shin, profile([[-0.365, 0, 0, 0.052, 0.056], [-0.153, 0, -0.006, 0.067, 0.069],
      [0.033, 0, 0, 0.059, 0.064]], 'trousers'));
    part(foot, box([0, -ankleHeight + 0.016, 0.048], [0.126, 0.032, 0.242], 'rubber', 0.006));
    part(foot, box([0, -ankleHeight + 0.058, 0.048], [0.121, 0.072, 0.234], 'shoe', 0.022));
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

const definitions = [
  { glb: desk(), name: 'desk_001', type: 'furniture', reference: 'reference.prototype_desk.001',
    anchors: [{ name: 'ANCHOR_DESK_TOP', translation_m: [0, 0.75, 0], forward: '+Z', purpose: 'Centro de la superficie de apoyo' }] },
  { glb: chair(), name: 'chair_001', type: 'furniture', reference: 'reference.prototype_chair.001',
    anchors: [{ name: 'ANCHOR_SIT', translation_m: [0, 0.46, 0.035], forward: '+Z', purpose: 'Centro de la superficie del asiento' }] },
  { glb: employee(), name: 'employee_001', type: 'char', reference: 'reference.prototype_employee.001', anchors: [] },
];

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
    id, type, version, status: 'ready_for_review', fidelity: 'provisional', file,
    file_size_bytes: binary.length, sha256: createHash('sha256').update(binary).digest('hex'),
    source: { generator: files.generator, blender_script: files.blender, blend_file: null },
    dimensions_m: minus(glb.max, glb.min).map(tidy),
    bounds_m: { min: glb.min.map(tidy), max: glb.max.map(tidy) },
    triangles: glb.triangles,
    materials: glb.doc.materials.map((m) => m.name), textures: [],
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
  schema_version: '1.0.0', schema_status: 'proposal_for_a001', contract_version: '1.0',
  package_id: 'A-001', package_version: version,
  coordinates: { dimension_order: ['X', 'Y', 'Z'], unit: 'm', up: '+Y', character_front: '+Z', handedness: 'right' },
  files, assets,
}, null, 2) + '\n');
