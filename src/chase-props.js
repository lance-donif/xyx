import * as THREE from 'three';
import { terrainMap } from './nature.js';

// Build each prop once. Its bark, cut wood and foliage share two instanced draws.
function geometryBuilder() {
  const positions = [], indices = [], colors = [], uvs = [];
  const color = new THREE.Color();
  return {
    vertex(point, tint, u = 0, v = 0, exposure = 1) {
      positions.push(point.x, point.y, point.z);
      color.set(tint);
      colors.push(color.r * exposure, color.g * exposure, color.b * exposure);
      uvs.push(u, v);
      return positions.length / 3 - 1;
    },
    triangle(a, b, c) { indices.push(a, b, c); },
    quad(a, b, c, d) { indices.push(a, b, d, b, c, d); },
    finish() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }
  };
}

const point = (x, y, z) => new THREE.Vector3(x, y, z);
const tau = Math.PI * 2;

function cutEnd(detail, center, axis, across, outward, radius, size) {
  let previous = [];
  const middle = detail.vertex(center.clone().addScaledVector(outward, .009), '#9b7342');
  const rings = [[.18, '#ac824f'], [.37, '#98653b'], [.41, '#b88d58'], [.63, '#b38550'],
    [.68, '#98673d'], [.77, '#c5985c'], [.94, '#deb776'], [1, '#865c3a']];
  for (const [fraction, tint] of rings) {
    const row = [];
    for (let i = 0; i < size; i++) {
      const angle = i * tau / size, r = radius * fraction * (1 + .034 * Math.sin(angle * 3));
      const p = center.clone().addScaledVector(axis, Math.cos(angle) * r)
        .addScaledVector(across, Math.sin(angle) * r).addScaledVector(outward, .008 * (1 - fraction));
      row.push(detail.vertex(p, tint));
    }
    for (let i = 0; i < size; i++) {
      const n = (i + 1) % size;
      if (previous.length) detail.quad(previous[i], row[i], row[n], previous[n]);
      else detail.triangle(middle, row[i], row[n]);
    }
    previous = row;
  }
}

// A continuous tapered limb, with growth rings confined to its exposed ends.
function limb(bark, detail, knots, ends = [], size = 12) {
  const points = knots.map(([x, y, z]) => point(x, y, z));
  const curve = new THREE.CatmullRomCurve3(points);
  const steps = (points.length - 1) * 3;
  let previous = [], last = points[0], length = 0;
  for (let row = 0; row <= steps; row++) {
    const t = row / steps, p = curve.getPoint(t), direction = curve.getTangent(t);
    const axis = point(0,0,1).cross(direction).normalize();
    const across = direction.clone().cross(axis);
    const section = Math.min(knots.length - 2, Math.floor(row / 3));
    const radius = THREE.MathUtils.lerp(knots[section][3], knots[section + 1][3], row / 3 - section);
    length += p.distanceTo(last); last = p;
    const current = [];
    for (let i = 0; i <= size; i++) {
      const angle = i * tau / size;
      const r = radius * (1 + .034 * Math.sin(angle * 3));
      const n = axis.clone().multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle));
      const moss = n.y > .5 && Math.sin(angle * 3 + row * .7) > .1;
      current.push(bark.vertex(p.clone().addScaledVector(n, r), moss ? '#b4bd78' : '#debb8b',
        i / size * 2, length / 1.25, .91 + .09 * Math.cos(angle * 4)));
      if (row && i) bark.quad(previous[i - 1], previous[i], current[i], current[i - 1]);
    }
    previous = current;
    if ((row === 0 && ends.includes('base')) || (row === steps && ends.includes('tip'))) {
      const normal = direction.clone().multiplyScalar(row === 0 ? -1 : 1);
      cutEnd(detail, p, axis, across, normal, radius, size);
    }
  }
}

// Put a spine in each leaf, so the two halves catch the sunlight differently.
function spray(detail, x, y, z, length, direction, seed) {
  const root = point(x, y, z);
  for (let i = 0; i < 11; i++) {
    const t = i / 11, side = i % 2 ? 1 : -1;
    const base = root.clone().add(point(length * t * direction, t * .18, Math.sin(t * 2 + seed) * .11));
    const spread = (.31 + .18 * Math.sin(t * Math.PI)) * (1 - t * .45);
    const tip = base.clone().add(point(.31 * direction, .11 * Math.cos(i + seed) - .09, side * spread));
    const mid = base.clone().lerp(tip, .49);
    const a = detail.vertex(base, '#52582a'), b = detail.vertex(mid.clone().add(point(-.105, 0, .02)), '#84963b');
    const c = detail.vertex(tip, '#b6b956'), d = detail.vertex(mid.clone().add(point(.11, 0, -.02)), '#708237');
    const e = detail.vertex(mid.add(point(0,.048,0)), '#aeba4d');
    detail.triangle(a,b,e); detail.triangle(b,c,e); detail.triangle(c,d,e); detail.triangle(d,a,e);
  }
}

function makeBranch() {
  const bark = geometryBuilder(), detail = geometryBuilder();
  limb(bark, detail, [[-4.72,-5.8,.92,.83],[-4.12,-1.5,.52,.63],[-3.8,.85,.09,.5],[-3.36,1.89,.05,.41],
    [-2.25,1.80,-.12,.34],[-.68,1.57,.015,.30],[.8,1.50,.04,.27],
    [2.15,1.56,-.03,.22],[3.58,1.61,-.05,.17]], ['tip'], 16);
  limb(bark, detail, [[-3.55,1.48,.05,.29],[-3.13,2.28,-.14,.24],[-2.52,2.76,-.24,.12],[-2.16,2.99,-.31,.085]], ['tip']);
  limb(bark, detail, [[-.65,1.62,-.01,.21],[-.27,1.9,-.14,.14],[.68,2.07,-.24,.09],[1.63,2.34,-.18,.04]], ['tip']);
  limb(bark, detail, [[2.3,1.58,-.01,.12],[2.76,1.81,.21,.10],[3.37,2.02,.42,.055]], ['tip']);
  spray(detail, -.2,1.98,-.11,1.36,1,1.4);
  spray(detail, -2.73,2.66,-.22,.95,1,4.3);
  spray(detail, 2.73,1.85,.21,.95,1,3.1);
  return [bark.finish(), detail.finish()];
}

function makeLogs() {
  const bark = geometryBuilder(), detail = geometryBuilder();
  // Three wedged pieces on one side of the road have an unmistakable step-over silhouette.
  limb(bark,detail,[[-.96,.24,.22,.24],[-.37,.24,.18,.27],[.31,.26,.05,.26],[.96,.23,-.06,.22]], ['base','tip'],16);
  limb(bark,detail,[[-.89,.22,-.39,.19],[-.17,.21,-.32,.23],[.91,.24,-.40,.20]], ['base','tip']);
  limb(bark,detail,[[-.78,.55,-.01,.16],[-.32,.66,-.05,.20],[.39,.61,-.04,.22],[.84,.54,-.19,.16]], ['base','tip']);
  limb(bark,detail,[[.1,.63,-.01,.14],[.24,.78,.11,.104],[.29,.93,.24,.075]], ['tip']);
  return [bark.finish(),detail.finish()];
}

function makeSplinters() {
  const detail = geometryBuilder();
  for (const [x, width, length, drop] of [[-2.82,.32,.36,.12],[-2.48,.23,.54,.19],[-1.9,.18,.23,.05],
    [-.56,.24,.32,.16],[-.3,.12,.43,.18],[.02,.26,.20,.06],[1.28,.18,.39,.14],[2.56,.4,.49,.25]]) {
    const a = detail.vertex(point(x,.019,.12), '#966336');
    const b = detail.vertex(point(x+width,.019,.12), '#b68850');
    const c = detail.vertex(point(x+width*.28,-drop,-length), '#ddba79');
    const d = detail.vertex(point(x+width*.62,-.18,.09), '#6a4126');
    detail.triangle(a,b,c); detail.triangle(b,d,c); detail.triangle(d,a,c);
  }
  return detail.finish();
}

function makeCoin() {
  const detail = geometryBuilder(), segments = 32;
  // Raised edge, recessed amber field, and a die-struck eight-pointed sun on both faces.
  const profile = [[0,-.059,'#f5a928'],[.193,-.059,'#eaa023'],[.206,-.078,'#ffe999'],
    [.248,-.078,'#ffda58'],[.273,-.052,'#e8a720'],[.273,.052,'#e5a129'],
    [.248,.078,'#fff29e'],[.206,.078,'#ffd35c'],[.193,.059,'#d98d16'],[0,.059,'#f5aa30']];
  let previous = [];
  for (const [radius, depth, tint] of profile) {
    const row = [];
    for (let i = 0; i < segments; i++) {
      const a = i * tau / segments;
      row.push(detail.vertex(point(radius*Math.cos(a), radius*Math.sin(a),depth), tint,0,0,
        radius === .273 && i%2 ? .74 : 1));
    }
    if (previous.length) for(let i=0;i<segments;i++) {
      const next=(i+1)%segments; detail.quad(previous[i],previous[next],row[next],row[i]);
    }
    previous = row;
  }
  for(const side of [-1,1]) {
    const middle = detail.vertex(point(0,0,.094*side),'#fff6b2'), rim=[];
    for(let i=0;i<16;i++) {
      const a=i*tau/16, r=i%2?.054:(i%4===0?.154:.113);
      rim.push(detail.vertex(point(r*Math.cos(a),r*Math.sin(a),.062*side),i%2?'#df961c':'#ffe06c'));
    }
    for(let i=0;i<16;i++) detail.triangle(middle,rim[i],rim[(i+1)%16]);
  }
  return detail.finish();
}

export function createChaseProps(scene) {
  const bark = new THREE.MeshLambertMaterial({map:terrainMap('bark'), vertexColors:true});
  const wood = new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const gold = new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,metalness:.48,
    roughness:.25,emissive:0x9a5b0b,emissiveIntensity:.31});
  function pool(name, geometry, material, capacity, castShadow = false) {
    const mesh = new THREE.InstancedMesh(geometry,material,capacity);
    mesh.name=name;
    mesh.count=0;
    mesh.castShadow=castShadow;
    mesh.receiveShadow=material!==gold;
    mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    return mesh;
  }
  const branch = makeBranch().map((g,i)=>pool('Low overhanging bough',g,i?wood:bark,16,true));
  const logs = makeLogs().map((g,i)=>pool('Fallen timber',g,i?wood:bark,16,true));
  const splinters = pool('Fractured bridge boards', makeSplinters(), wood, 32);
  const medallions = pool('Gold sun coins',makeCoin(), gold, 128);
  const batches=[...branch,...logs,splinters,medallions];
  const transform = new THREE.Object3D();
  function pose(p, offset = 0, height = 0, turn = 0) {
    transform.position.set(p.x + Math.cos(p.yaw)*offset,p.y+height,p.z-Math.sin(p.yaw)*offset);
    transform.rotation.y = p.yaw + turn;
    transform.updateMatrix();
  }
  function place(mesh) {
    if (mesh.count < mesh.instanceMatrix.count) mesh.setMatrixAt(mesh.count++, transform.matrix);
  }
  return {
    update(events, coins, collected, distance, sample, time) {
      for (const mesh of batches) mesh.count=0;
      for (const e of events) {
        if (e.at < distance-9 || e.at > distance+140) continue;
        if (e.type==='branch') {
          pose(sample(e.at)); branch.forEach(place);
        } else if (e.type==='log') {
          pose(sample(e.at),e.side*1.8); logs.forEach(place);
        } else if (e.type==='gap') {
          pose(sample(e.at-2)); place(splinters);
          pose(sample(e.at+2),0,0,Math.PI); place(splinters);
        }
      }
      for (const c of coins) {
        if (c.at < distance-3 || c.at > distance+125 || collected.has(c.id)) continue;
        const phase = time*2.25+c.at*.18;
        pose(sample(c.at),c.offset,c.height+.046*Math.sin(phase),.98*Math.sin(phase*.83));
        place(medallions);
      }
      for (const mesh of batches) {
        mesh.visible=mesh.count>0;
        if(mesh.visible) mesh.instanceMatrix.needsUpdate=true;
      }
    }
  };
}
