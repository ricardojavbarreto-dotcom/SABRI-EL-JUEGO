import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const project = new URL('../../', import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, project)));
const json = (path) => JSON.parse(read(path));
const manifest = json('data/assets.json');
const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) <= tolerance, a + ' differs from ' + b);
const nearArray = (a, b, tolerance) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => near(v, b[i], tolerance));
};
const zero = [0, 0, 0];
const identity = [0, 0, 0, 1];
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const cross = ([a, b, c], [x, y, z]) => [b * z - c * y, c * x - a * z, a * y - b * x];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

function multiply(a, b) {
  const v = cross(a, b).map((n, i) => n + a[i] * b[3] + b[i] * a[3]);
  return [...v, a[3] * b[3] - dot(a.slice(0, 3), b.slice(0, 3))];
}

function rotate(v, q) {
  const conjugate = [-q[0], -q[1], -q[2], q[3]];
  return multiply(multiply(q, [...v, 0]), conjugate).slice(0, 3);
}

function parseGlb(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const jsonLength = bytes.readUInt32LE(12);
  const binaryChunk = 20 + jsonLength;
  assert.equal(jsonLength % 4, 0);
  assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
  assert.equal(bytes.toString('ascii', binaryChunk + 4, binaryChunk + 8), 'BIN\0');
  const binary = bytes.subarray(binaryChunk + 8);
  const doc = JSON.parse(bytes.toString('utf8', 20, binaryChunk));
  assert.equal(doc.asset.version, '2.0');
  assert.deepEqual(doc.buffers, [{ byteLength: binary.length }]);
  assert.equal(binary.length, bytes.readUInt32LE(binaryChunk));
  assert.equal(binary.length % 4, 0);
  assert.ok(!doc.extensionsRequired && !doc.images && !doc.textures);
  return { doc, binary };
}

function getAccessor(doc, binary, index) {
  const { bufferView, componentType, count, type, byteOffset = 0 } = doc.accessors[index];
  const view = doc.bufferViews[bufferView];
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
  const [step, method] = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5126: [4, 'readFloatLE'] }[componentType];
  assert.equal(view.buffer, 0);
  assert.equal(view.byteOffset % 4, 0);
  assert.ok(view.byteOffset + view.byteLength <= binary.length);
  assert.ok(byteOffset + count * width * step <= view.byteLength);
  return Array.from({ length: count }, (_, i) =>
    Array.from({ length: width }, (_, j) => binary[method](view.byteOffset + byteOffset + (i * width + j) * step)));
}

function makeHierarchy(doc) {
  assert.deepEqual(doc.scenes[doc.scene].nodes, [0]);
  const parents = new Map();
  const found = new Set();
  function visit(i) {
    assert.ok(!found.has(i), 'Cycle or multiple parents');
    found.add(i);
    for (const child of doc.nodes[i].children ?? []) {
      parents.set(child, i);
      visit(child);
    }
  }
  visit(0);
  assert.equal(found.size, doc.nodes.length);
  return parents;
}

function transforms(nodes, parents, pose = new Map()) {
  const world = new Map();
  function transform(index) {
    if (world.has(index)) return world.get(index);
    const node = nodes[index];
    const local = pose.get(index) ?? {};
    const position = local.translation ?? node.translation ?? zero;
    const rotation = local.rotation ?? node.rotation ?? identity;
    assert.deepEqual(node.scale ?? [1, 1, 1], [1, 1, 1]);
    const parent = parents.has(index) ? transform(parents.get(index)) : { position: zero, rotation: identity };
    const global = { position: add(parent.position, rotate(position, parent.rotation)),
      rotation: multiply(parent.rotation, rotation) };
    world.set(index, global);
    return global;
  }
  nodes.forEach((_, i) => transform(i));
  return world;
}

function sampleTrack(track, t) {
  if (t === 0) return track.values[0];
  const end = track.times.findIndex((time) => time >= t);
  if (end < 0) return track.values.at(-1);
  const mix = (t - track.times[end - 1]) / (track.times[end] - track.times[end - 1]);
  const a = track.values[end - 1], b = track.values[end];
  const result = a.map((v, i) => v * (1 - mix) + b[i] * mix);
  return track.path === 'rotation' ? result.map((v) => v / Math.hypot(...result)) : result;
}

function verifyClips(doc, binary, asset, parents, joints, bind, feet) {
  const clips = doc.animations ?? [];
  const nodeIndex = (name) => doc.nodes.findIndex((n) => n.name === name);
  assert.deepEqual(clips.map((clip) => clip.name), asset.animations);
  for (const [i, clip] of clips.entries()) {
    const info = asset.animation_details[i];
    assert.equal(clip.name, info.name);
    assert.equal(info.loop && info.in_place, true);
    assert.equal(info.channels, clip.channels.length);
    const targets = new Set();
    const tracks = clip.channels.map(({ sampler, target: { node, path } }) => {
      assert.ok(joints.includes(node));
      assert.notEqual(node, 0);
      assert.ok(!targets.has(node + ':' + path));
      targets.add(node + ':' + path);
      const { input, output, interpolation } = clip.samplers[sampler];
      const times = getAccessor(doc, binary, input).flat();
      const values = getAccessor(doc, binary, output);
      assert.equal(interpolation, 'LINEAR');
      assert.equal(times.length, values.length);
      assert.ok(times.every((t, j) => j === 0 || t > times[j - 1]));
      near(times[0], 0);
      near(times.at(-1), info.duration_s);
      nearArray(values[0], values.at(-1));
      assert.ok(values.some((v) => subtract(v, values[0]).some((d) => Math.abs(d) > 0.001))
        || path === 'rotation' && node === nodeIndex('spine'));
      if (path === 'rotation') {
        for (const q of values) near(Math.hypot(...q), 1);
      } else {
        assert.equal(path, 'translation');
        assert.equal(node, nodeIndex('hips'));
        for (const [x, , z] of values) nearArray([x, z], [0, 0]);
      }
      return { node, path, times, values };
    });
    const soles = [nodeIndex('foot_l'), nodeIndex('foot_r')].map((index) => {
      const points = feet.get(index);
      assert.ok(points.length > 0);
      const restPosition = bind.get(index).position;
      return { index, local: points.map((v) => subtract(v, restPosition)) };
    });
    let minY = Infinity, maxLift = 0;
    for (let sample = 0; sample <= 224; sample++) {
      const pose = new Map();
      for (const track of tracks) {
        if (!pose.has(track.node)) pose.set(track.node, {});
        pose.get(track.node)[track.path] = sampleTrack(track, sample * info.duration_s / 224);
      }
      const world = transforms(doc.nodes, parents, pose);
      nearArray(world.get(0).position, zero);
      nearArray(world.get(0).rotation, identity);
      const floors = soles.map(({ index, local }) => {
        const { position, rotation } = world.get(index);
        return Math.min(...local.map((v) => add(position, rotate(v, rotation))[1]));
      });
      minY = Math.min(minY, ...floors);
      maxLift = Math.max(maxLift, ...floors);
      assert.ok(Math.abs(Math.min(...floors)) < 0.004, 'No foot planted at t=' + sample);
    }
    assert.ok(minY >= -0.004);
    if (clip.name === 'Walk') assert.ok(maxLift > 0.12);
    console.log('  ' + clip.name + ' ' + info.duration_s + ' s, continuous loop, static ROOT, minimum sole Y '
      + minY.toFixed(4) + ' m, maximum sole lift ' + maxLift.toFixed(4) + ' m');
  }
}

function verifyAsset(asset) {
  const bytes = read('public/' + asset.file);
  assert.equal(bytes.length, asset.file_size_bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  const { doc, binary } = parseGlb(bytes);
  const parents = makeHierarchy(doc);
  const world = transforms(doc.nodes, parents);
  assert.equal(doc.nodes[0].name, asset.root);
  assert.equal(doc.nodes[0].extras.asset_id, asset.id);
  assert.equal(doc.nodes[0].extras.asset_version, asset.version);
  assert.deepEqual(world.get(0).position, asset.pivot_m);
  assert.deepEqual(world.get(0).rotation, asset.initial_rotation_xyzw);
  assert.deepEqual(doc.nodes[0].scale ?? [1, 1, 1], asset.scale);
  assert.deepEqual(doc.nodes.map((n) => ({ name: n.name, children: (n.children ?? []).map((i) => doc.nodes[i].name) })),
    asset.hierarchy);
  assert.equal(new Set(doc.nodes.map((n) => n.name)).size, doc.nodes.length);
  assert.deepEqual(doc.materials.map((m) => m.name), asset.materials);
  for (const material of doc.materials) {
    const { baseColorFactor, roughnessFactor, metallicFactor } = material.pbrMetallicRoughness;
    assert.ok([...baseColorFactor, roughnessFactor, metallicFactor].every((n) => n >= 0 && n <= 1));
  }

  assert.deepEqual(asset.anchor_details.map((a) => a.name), asset.anchors);
  for (const anchor of asset.anchor_details) {
    const node = doc.nodes.findIndex((n) => n.name === anchor.name);
    assert.equal(parents.get(node), 0);
    nearArray(world.get(node).position, anchor.translation_m);
    nearArray(world.get(node).rotation, identity);
  }

  const lower = [Infinity, Infinity, Infinity], upper = [-Infinity, -Infinity, -Infinity];
  const feet = new Map();
  let forwardFeatures = 0, triangles = 0;
  let joints = [];
  for (const [i, node] of doc.nodes.entries()) {
    if (node.mesh === undefined) continue;
    if (node.skin !== undefined) {
      const skin = doc.skins[node.skin];
      assert.equal(skin.name, asset.rig);
      assert.equal(doc.nodes[skin.skeleton].name, 'ARMATURE');
      joints = skin.joints;
      assert.deepEqual(joints.map((index) => doc.nodes[index].name), asset.joints);
      const matrices = getAccessor(doc, binary, skin.inverseBindMatrices);
      assert.equal(matrices.length, joints.length);
      for (const [j, index] of joints.entries()) {
        const [x, y, z] = world.get(index).position;
        nearArray(matrices[j], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
      }
    }
    for (const primitive of doc.meshes[node.mesh].primitives) {
      assert.equal(primitive.mode ?? 4, 4);
      const position = getAccessor(doc, binary, primitive.attributes.POSITION);
      const normal = getAccessor(doc, binary, primitive.attributes.NORMAL);
      const indices = getAccessor(doc, binary, primitive.indices).flat();
      const material = doc.materials[primitive.material].name;
      const bounds = doc.accessors[primitive.attributes.POSITION];
      assert.equal(position.length, normal.length);
      for (let axis = 0; axis < 3; axis++) {
        near(Math.min(...position.map((p) => p[axis])), bounds.min[axis]);
        near(Math.max(...position.map((p) => p[axis])), bounds.max[axis]);
      }
      for (let j = 0; j < position.length; j++) {
        const tr = world.get(i);
        const point = add(tr.position, rotate(position[j], tr.rotation));
        near(Math.hypot(...normal[j]), 1);
        for (let a = 0; a < 3; a++) {
          lower[a] = Math.min(lower[a], point[a]);
          upper[a] = Math.max(upper[a], point[a]);
        }
      }
      assert.equal(indices.length % 3, 0);
      assert.ok(indices.every((n) => n >= 0 && n < position.length));
      for (let k = 0; k < indices.length; k += 3) {
        const [a, b, c] = indices.slice(k, k + 3);
        const areaNormal = cross(subtract(position[b], position[a]), subtract(position[c], position[a]));
        assert.ok(dot(areaNormal, normal[a]) > 1e-10, 'Invalid or reversed triangle');
      }
      triangles += indices.length / 3;
      if (node.skin !== undefined) {
        const ids = getAccessor(doc, binary, primitive.attributes.JOINTS_0);
        const weights = getAccessor(doc, binary, primitive.attributes.WEIGHTS_0);
        assert.equal(ids.length, position.length);
        assert.equal(weights.length, position.length);
        for (let j = 0; j < ids.length; j++) {
          assert.ok(ids[j].every((v) => v < joints.length));
          nearArray(weights[j], [1, 0, 0, 0]);
          const joint = joints[ids[j][0]];
          const name = doc.nodes[joint].name;
          if (name.startsWith('foot_')) {
            if (!feet.has(joint)) feet.set(joint, []);
            feet.get(joint).push(position[j]);
          }
          if (material === 'MAT_EYE') {
            assert.equal(name, 'head');
            assert.ok(position[j][2] > 0);
            forwardFeatures++;
          }
        }
      }
    }
  }
  nearArray(lower, asset.bounds_m.min);
  nearArray(upper, asset.bounds_m.max);
  nearArray(subtract(upper, lower), asset.dimensions_m);
  near(lower[1], 0);
  assert.equal(triangles, asset.triangles);
  console.log(asset.id + ' OK, ' + triangles + ' tris, ' + bytes.length + ' bytes');
  if (asset.type === 'char') {
    assert.equal(asset.front, '+Z');
    assert.ok(forwardFeatures > 0);
    const feetPositions = [...feet.values()].map((points) => Math.min(...points.map((p) => p[1])));
    nearArray(feetPositions, [0, 0]);
    const centers = [...feet.keys()].map((index) => world.get(index).position[0]);
    near(centers[0] + centers[1], 0);
    verifyClips(doc, binary, asset, parents, joints, world, feet);
  } else {
    assert.deepEqual(doc.animations ?? [], []);
  }
}

const refs = json(manifest.files.references).references;
const refsById = new Map(refs.map((ref) => [ref.reference_id, ref]));
assert.equal(manifest.package_id, 'A-001');
assert.equal(manifest.schema_version, '1.0.0');
for (const [key, file] of Object.entries(manifest.files)) {
  assert.ok(statSync(fileURLToPath(new URL(file, project))).isFile(), key);
}
assert.deepEqual(manifest.assets.map((asset) => asset.id), ['furniture.desk.001', 'furniture.chair.001', 'char.employee.001']);
for (const asset of manifest.assets) {
  assert.equal(asset.version, manifest.package_version);
  for (const ref of asset.references) {
    assert.ok(refsById.get(ref)?.applies_to.includes(asset.id), ref);
  }
  verifyAsset(asset);
}
