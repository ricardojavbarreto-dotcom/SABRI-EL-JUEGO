import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const manifest = JSON.parse(read('data/assets.json'));
const [desk, cluster] = manifest.assets;
assert.equal(manifest.package_id, 'A-002');
assert.equal(manifest.package_version, '0.4.0');
assert.equal(manifest.delivery_mode, 'delta');
assert.equal(manifest.assets.length, 2);
assert.equal(desk.id, 'furniture.desk.001');
assert.equal(desk.version, '1.2.0');
assert.equal(desk.measurement_status, 'confirmed');
assert.deepEqual(desk.dimensions_m, [4.7, 0.751, 1.2]);
assert.equal(desk.nominal_worktop_height_m, 0.75);
assert.deepEqual(desk.replaces, { package_id: 'A-001', asset_version: '0.1.0' });
assert.equal(cluster.id, 'env.desk_cluster.001');
assert.equal(cluster.version, '0.3.0');
for (const [key, path] of Object.entries(manifest.files)) {
  const diskPath = key === 'glb' || key === 'cluster' ? 'public/' + path : path;
  assert.ok(statSync(new URL(diskPath, root)).isFile(), diskPath);
}
const references = JSON.parse(read(manifest.files.references)).references;

function verifyAsset(asset) {
  for (const id of asset.references) {
    assert.ok(references.some((ref) => ref.reference_id === id && ref.applies_to.includes(asset.id)), id);
  }

  const file = read('public/' + asset.file);
  assert.equal(createHash('sha256').update(file).digest('hex'), asset.sha256);
  assert.equal(file.length, asset.file_size_bytes);
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const jsonLength = file.readUInt32LE(12);
  const binOffset = 20 + jsonLength;
  assert.equal(file.toString('ascii', 16, 20), 'JSON');
  assert.equal(jsonLength % 4, 0);
  assert.equal(file.toString('ascii', binOffset + 4, binOffset + 8), 'BIN\0');
  const gltf = JSON.parse(file.toString('utf8', 20, binOffset));
  const bin = file.subarray(binOffset + 8);
  assert.equal(gltf.asset.version, '2.0');
  assert.deepEqual(gltf.buffers, [{ byteLength: bin.length }]);
  assert.equal(file.readUInt32LE(binOffset), bin.length);
  assert.equal(bin.length % 4, 0);
  assert.deepEqual((gltf.images ?? []).map(i=>i.name),asset.textures);
  for (const image of gltf.images ?? []) {
    const v=gltf.bufferViews[image.bufferView];
    assert.equal(bin.toString("hex",v.byteOffset,v.byteOffset+8),"89504e470d0a1a0a");
  }
  assert.ok(!gltf.cameras && !gltf.extensionsRequired && !gltf.animations);

  function accessor(id, shape, type) {
    const { bufferView, componentType, count, byteOffset = 0, type: actualShape } = gltf.accessors[id];
    assert.equal(actualShape, shape);
    assert.equal(componentType, type);
    const view = gltf.bufferViews[bufferView];
    const width = shape === 'VEC3' ? 3 : 1;
    const size = type === 5126 ? 4 : 2;
    assert.equal(view.buffer, 0);
    assert.equal(view.byteOffset % 4, 0);
    assert.ok(view.byteOffset + view.byteLength <= bin.length);
    assert.ok(byteOffset + count * width * size <= view.byteLength);
    return Array.from({ length: count }, (_, i) => {
      const offset = view.byteOffset + byteOffset + i * width * size;
      if (shape === 'SCALAR') return bin.readUInt16LE(offset);
      return [0, 4, 8].map((shift) => bin.readFloatLE(offset + shift));
    });
  }

  const nodes = gltf.nodes;
  const scene = gltf.scenes[gltf.scene];
  assert.deepEqual(scene.nodes, [0]);
  assert.deepEqual(nodes[0].extras, { asset_id: asset.id, asset_version: asset.version });
  assert.deepEqual(nodes[0].translation ?? [0, 0, 0], asset.pivot_m);
  assert.deepEqual(nodes[0].rotation ?? [0, 0, 0, 1], asset.initial_rotation_xyzw);
  assert.deepEqual(nodes[0].scale ?? [1, 1, 1], asset.scale);
  assert.deepEqual(nodes.map((node) => ({ name: node.name,
    children: (node.children ?? []).map((id) => nodes[id].name) })), asset.hierarchy);
  assert.deepEqual(asset.anchors, asset.anchor_details.map(({ name }) => name));
  const parentNames = new Map(nodes.flatMap((node) => (node.children ?? []).map((i) => [nodes[i].name, node.name])));
  for (const anchor of asset.anchor_details) {
    const node = nodes.find((n) => n.name === anchor.name);
    assert.deepEqual(node.translation, anchor.translation_m);
    const expectedParent = anchor.parent ?? (asset.type === 'env' ? 'DESK' : 'ROOT');
    assert.equal(parentNames.get(anchor.name), expectedParent);
  }
  assert.deepEqual(nodes.find((node) => node.name === 'ANCHOR_DESK_TOP').translation, [0, 0.75, 0]);
  assert.deepEqual(gltf.materials.map((m) => m.name), asset.materials);

  const vertices = [];
  let triangles = 0;
  const cross = ([a, b, c], [x, y, z]) => [b * z - c * y, c * x - a * z, a * y - b * x];
  const minus = (a, b) => a.map((value, i) => value - b[i]);
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, a + ' differs from ' + b);
  const rotationY = ([x, y, z], angle) =>
    [Math.cos(angle) * x + Math.sin(angle) * z, y, -Math.sin(angle) * x + Math.cos(angle) * z];
  const worldNodes = [];
  function visit(index, parentPosition, parentAngle) {
    const node = nodes[index];
    assert.ok(!node.scale && !node.matrix);
    const rotation = node.rotation ?? [0, 0, 0, 1];
    near(rotation[0], 0);
    near(rotation[2], 0);
    near(Math.hypot(...rotation), 1);
    const angle = parentAngle + 2 * Math.atan2(rotation[1], rotation[3]);
    const position = rotationY(node.translation ?? [0, 0, 0], parentAngle)
      .map((value, axis) => value + parentPosition[axis]);
    worldNodes.push({ node, position, angle });
    for (const child of node.children ?? []) visit(child, position, angle);
  }
  visit(0, [0, 0, 0], 0);
  for (const {node, position: origin, angle} of worldNodes.filter(({node}) => node.mesh !== undefined)) {
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      assert.equal(primitive.mode ?? 4, 4);
      const position = accessor(primitive.attributes.POSITION, 'VEC3', 5126);
      const normals = accessor(primitive.attributes.NORMAL, 'VEC3', 5126);
      const indices = accessor(primitive.indices, 'SCALAR', 5123);
      assert.equal(position.length, normals.length);
      assert.equal(indices.length % 3, 0);
      assert.ok(indices.every((i) => i < position.length));
      assert.ok(gltf.materials[primitive.material].pbrMetallicRoughness);
      for (const normal of normals) near(Math.hypot(...normal), 1);
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = indices.slice(i, i + 3);
        const normal = cross(minus(position[b], position[a]), minus(position[c], position[a]));
        assert.ok(dot(normal, normals[a]) > 1e-12, 'Triangle has invalid area or winding');
      }
      if (node.name === 'DESK_TOP') near(Math.max(...position.map((p) => p[1])), asset.nominal_worktop_height_m);
      vertices.push(...position.map((point) => rotationY(point, angle).map((value, axis) => value + origin[axis])));
      triangles += indices.length / 3;
    }
  }
  assert.equal(triangles, asset.triangles);
  for (let axis = 0; axis < 3; axis++) {
    const coords = vertices.map((point) => point[axis]);
    const min = coords.reduce((a,b)=>Math.min(a,b)), max = coords.reduce((a,b)=>Math.max(a,b));
    near(min, asset.bounds_m.min[axis]);
    near(max, asset.bounds_m.max[axis]);
    near(max - min, asset.dimensions_m[axis]);
  }
  near(asset.bounds_m.min[1], 0);
  if (asset.type === 'env') {
    for (const prefix of ['NOTEBOOK_', 'CHAIR_', 'MONITOR_', 'KEYBOARD_MOUSE_', 'ANCHOR_SIT_']) {
      assert.equal(nodes.filter((node) => node.name.startsWith(prefix)).length, ['CHAIR_','ANCHOR_SIT_'].includes(prefix) ? 8 : 3, prefix);
    }
    for (const suffix of ['04','05','06']) assert.ok(nodes.some(n=>n.name==='NOTEBOOK_'+suffix));
    assert.ok(nodes.some(n=>n.name==='SIDEBOARD_LEFT' && n.translation[0]<-2.35));
    assert.equal(new Set(nodes.map(({name}) => name)).size, nodes.length);
  }
  console.log(asset.id + ' v' + asset.version + ' OK · ' + asset.dimensions_m.join(' × ')
    + ' m · ' + triangles + ' triángulos · ' + file.length + ' bytes');
}

for (const asset of manifest.assets) verifyAsset(asset);
