import * as THREE from 'three'

const length = 1200
const seaLevel = -21
const edge = 4
const sin = Math.sin
const cos = Math.cos

export function coastAt(s) {
  return {
    x: 22 * sin(s / 86) + 5 * sin(s / 29),
    y: 38 - 0.027 * s + 2.6 * cos(s / 69) + 1.4 * sin(s / 34),
  }
}

function outerEdge(s) {
  return 10 + 2.6 * sin(s / 32) + 0.8 * cos(s / 4.7)
}

function bankHeight(s, d) {
  const { y } = coastAt(s)
  if (d < -edge) {
    const slope = 0.21 + 0.06 * sin(s / 63)
    return y + (-d - edge) * slope + (1 - Math.exp((d + edge) / 10)) * (1.8 * sin(s / 12 - d / 9) + sin(d / 2.3 + s / 19))
  }
  return y - Math.max(0, d - edge) * 0.24 + 0.16 * sin(s / 5) * Math.max(0, d - edge)
}

function seededRandom() {
  let seed = 748291
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function aqueductArch() {
  // Extrude the negative space of a semicircular vault into a thick masonry span.
  const shape = new THREE.Shape()
  shape.moveTo(-6, 0)
  shape.lineTo(-4.8, 0)
  shape.absarc(0, 0, 4.8, Math.PI, 0, true)
  shape.lineTo(6, 0)
  shape.lineTo(6, 6.1)
  shape.lineTo(-6, 6.1)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: 2.6, bevelEnabled: false, curveSegments: 8})
  geometry.translate(0, 0, -1.3)
  return geometry
}

function roofGeometry() {
  // Gable ridge runs along Z.
  const shape = new THREE.Shape()
  shape.moveTo(-0.56, 0)
  shape.lineTo(0, 0.62)
  shape.lineTo(0.56, 0)
  shape.closePath()
  const geom = new THREE.ExtrudeGeometry(shape, {depth: 1.12, bevelEnabled: false})
  geom.translate(0, 0, -0.56)
  return geom
}

export function createCoast(scene) {
  const random = seededRandom()
  const root = new THREE.Group()
  root.name = 'Cape aqueduct'
  scene.add(root)
  scene.background = new THREE.Color(0xa6d9ea)
  scene.fog = new THREE.FogExp2(0xbadbe1, 0.0038)

  const sun = new THREE.DirectionalLight(0xffe1a8, 2.1)
  sun.position.set(-100, 190, -100)
  root.add(sun, new THREE.HemisphereLight(0xe4f5ff, 0xc9aa72, 1.6))
  const positions = []
  const colors = []
  const normals = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  function tri(a, b, c, color, jitter = 0.025) {
    // Orient terrain tops toward the sky. Cliff faces use a two-sided material.
    e1.fromArray(b).sub(e2.fromArray(a))
    e2.fromArray(c).sub(normals.fromArray(a))
    normals.crossVectors(e1, e2)
    const verts = normals.y < 0 ? [a,c,b] : [a,b,c]
    const tint = new THREE.Color(color).multiplyScalar(1 + (random() - 0.5) * jitter)
    for (const v of verts) {
      positions.push(...v)
      colors.push(tint.r, tint.g, tint.b)
    }
  }
  function quad(a, b, c, d, color, jitter) {
    tri(a,b,c,color,jitter)
    tri(a,c,d,color,jitter)
  }
  const green = [0x72903b, 0x92a848, 0x9eb249, 0xb2bf56, 0x9da949]
  const grassColor = (s, d) => green[Math.max(0, Math.min(4, Math.round(2 + sin(s / 26 + d / 7) + sin(s / 18 - d / 14))))]
  function row(s) {
    const {x,y} = coastAt(s)
    const outer = outerEdge(s)
    const rim = bankHeight(s, outer)
    const road = (d, h = 0) => [x + d + (Math.abs(d) < edge ? 0.16 * sin(s / 6) + 0.12 * cos(s / 4.3 + d * 3) : 0), y + h, -s]
    const land = d => [x + d, bankHeight(s,d), -s]
    const far = 154 + 26 * sin(s / 114) + 11 * sin(s / 41)
    const height = 12 + 8 * sin(s / 55)
    return [
      land(-170), land(-65), land(-30), land(-16), land(-9), land(-6), land(-4.65),
      road(-edge), road(-2.25, 0.023), road(-1.7, 0.026), road(1.7, 0.026), road(2.25, 0.023), road(edge),
      land(4.65), land(outer), [x + outer + 2.8, rim - 3, -s],
      [x + outer + 6 + sin(s / 4), (rim + seaLevel) / 2, -s],
      [x + outer + 12 + 2 * sin(s / 6.2), seaLevel - 1, -s],
      [far - 14, seaLevel - 1, -s], [far - 4, seaLevel + 1.8, -s],
      [far, height - 15, -s], [far + 12, height - 12, -s],
      [far + 24, height + 6, -s], [far + 63, height + 49 + 14 * sin(s / 62) + 6 * cos(s / 21), -s],
      [far + 250, height + 79 + 28 * sin(s / 89), -s],
    ]
  }
  const roadPalette = [0xac995f, 0xc7a67b, 0xcdad83, 0xc8a679, 0xd1b289, 0xc5a579, 0xa79360]
  const cliffPalette = [0xb3af86, 0xaca591, 0xc3ac8a, 0xc8aa81, 0x92866e, 0xabc09c, 0x9bb392, 0x929b85, 0x9aab99]
  let prev = row(-120)
  for (let s = -115; s <= length + 345; s += 5) {
    const next = row(s)
    for (let i = 0; i < next.length - 1; i++) {
      if (i === 17) continue // water occupies the channel
      const color = i < 6 || i === 13 ? grassColor(s, i * 3) : i <= 12 ? roadPalette[i - 6] : cliffPalette[Math.min(8, i - 14)]
      quad(prev[i],prev[i+1],next[i+1],next[i], color, i >= 6 && i <= 12 ? 0.006 : 0.045)
    }
    prev = next
  }

  const envMat = new THREE.MeshStandardMaterial({roughness: 1, flatShading: true})
  const swatches = {
    stone: 0xdbc69a, cap: 0xf0dfb9, base: 0xb4a282, pine: 0x38664d,
    leaf: 0x59834f, bark: 0x77614c, rock: 0xa9a38a,
  }
  const batches = new Map()
  function batch(name, geometry) {
    const items = []
    batches.set(name, { geometry, items })
    return (x,y,z, w,h,d, color, rotation = 0) => items.push({ x,y,z,w,h,d,color,rotation })
  }
  const box = batch('Stone, wood and plaster', new THREE.BoxGeometry())
  const trunk = batch('Trunks', new THREE.CylinderGeometry(0.8,1,1,6))
  const arch = batch('Vaults', aqueductArch())
  const conifer = batch('Cypresses', new THREE.ConeGeometry(1,1,6))
  const rock = batch('Rock and foliage', new THREE.IcosahedronGeometry(1,0))
  const roof = batch('Terracotta roofs', roofGeometry())
  const grassBlade = batch('Salt meadow grasses', new THREE.ConeGeometry(1,1,3))
  const waterTint = batch('Sea foam and reflections', new THREE.CircleGeometry(1,7).rotateX(-Math.PI / 2))

  // A long aqueduct changes direction by segment. Horizontal caps align between spans.
  function bridgeX(s) { return 89 + 39 * sin(s / 153 + 1.7) + 8 * sin(s / 48) }
  function bridgeY(s) { return 27 + 4 * sin(s / 162 + 0.3) }
  for (let s = -72; s <= length + 288; s += 12) {
    const a = bridgeX(s)
    const b = bridgeX(s + 12)
    const cx = (a + b) / 2
    const top = bridgeY(s + 6)
    const base = top - 6.1
    const span = Math.hypot(b-a, 12)
    const r = Math.atan2(12, b - a)
    arch(cx,base,-s-6,span / 12,1,1, swatches.stone,r)
    box(a,(base+seaLevel)/2,-s,2.1,base-seaLevel+0.5,2.9, swatches.stone,r)
    box(a,base-0.3,-s,2.9,0.65,3.35,swatches.cap,r)
    box(a,seaLevel+2.0,-s,3.4,4.8,4.0,swatches.base,r)
    box(cx,top-0.05,-s-6,span+0.12,0.6,3.25,swatches.cap,r)
    box(cx,top+0.57,-s-6,span+0.12,0.72,2.95,swatches.stone,r)
    if (s % 48 === 0) {
      box(a,top+1.5,-s,1.8,3,3.3,swatches.stone,r)
      box(a,top+3.05,-s,2.0,0.32,3.5,swatches.cap,r)
    }
  }

  function tree(s, d, h) {
    const {x} = coastAt(s)
    const ground = bankHeight(s,d)
    const width = h * (0.21 + random()*0.06)
    trunk(x+d,ground+h*0.12,-s,0.058*h,0.36*h,0.052*h,swatches.bark)
    if (random() < 0.48) {
      // Umbrella pines grow in the lee of the salt cliffs.
      trunk(x+d,ground+h*0.36,-s,0.041*h,h*0.74,0.047*h,swatches.bark)
      rock(x+d-width*0.40,ground+h*0.76,-s,width*1.28,h*0.17,width,0x477956,h)
      rock(x+d+width*0.46,ground+h*0.86,-s+width*0.20,width*1.12,h*0.18,width*0.94,0x5d8859,-h)
      rock(x+d+0.12*width,ground+h*0.98,-s,width*0.82,h*0.13,width*0.72,0x77975e,h)
    } else {
      conifer(x+d,ground+h*0.44,-s,width,h*0.56,width,swatches.pine,h)
      conifer(x+d+0.07*width,ground+h*0.64,-s,width*0.79,h*0.51,width*0.83,0x497652,-h)
      conifer(x+d,ground+h*0.83,-s,width*0.53,h*0.44,width*0.56,swatches.leaf,h)
    }
    // Bake long soft-edged polygon shadows directly onto the curved ground.
    const shadowD = d + h*0.25
    const shadowS = s - h*0.17
    const center = [coastAt(shadowS).x + shadowD, bankHeight(shadowS,shadowD)+0.065,-shadowS]
    const polygon = []
    for (let i=0; i<10; i++) {
      const a = i*Math.PI/5
      const ds = shadowS + width*1.4*sin(a)
      const dd = Math.min(outerEdge(ds)-0.4, shadowD + width*1.5*cos(a) - width*0.48*sin(a))
      polygon.push([coastAt(ds).x + dd, bankHeight(ds,dd)+0.065, -ds])
    }
    for(let i=0; i<10; i++) tri(center, polygon[i], polygon[(i+1)%10], 0x738a48,0.01)
  }
  for (let i = 0; i < 405; i++) {
    const s = random()*(length+215)-65
    const d = i % 10 === 0 ? outerEdge(s) - 1 : -9 - random()*55
    tree(s,d,3.5 + random()*7)
  }

  for (let i = 0; i < 5900; i++) {
    const s = random()*(length+105)-40
    const { x } = coastAt(s)
    const side = random()<0.5 ? -1 : 1
    const d = side*(4.35+random()*(side>0 ? outerEdge(s)-4.45 : 16))
    const y = bankHeight(s,d)
    const h = 0.19 + 0.52*random()
    const color = [0x99ac57,0xb4b65b,0xc6b475,0x8caa52][i%4]
    for (let j=0; j<3;j++) {
      const dx = random()*0.38-0.19
      grassBlade(x+d+dx, y+h*0.39,-s+random()*0.24,h*0.12,h*(0.8+random()*0.55),h*0.15,color,i+j)
    }
    if (i % 15 === 0) rock(x+d, y+h*0.93, -s,0.10,0.08,0.11,i%30 ? 0xe7cb65 : 0xe7deaf,i)
  }

  function village(s, d, ground) {
    const { x } = coastAt(s)
    const w = 3.2 + random() * 2.7
    const h = 3.9 + random() * 4
    const yaw = sin(s / 17) * 0.46
    const walls = [0xf0ce9a,0xf2deb8,0xd99f78,0xe1c48f]
    const tiles = [0xbf6343,0xae543a,0xd0784f,0xb57355]
    box(x+d,ground+h/2,-s,w,h,w*0.86,walls[Math.floor(random()*4)],yaw)
    roof(x+d,ground+h,-s,w,h*0.6,w*0.86,tiles[Math.floor(random()*4)],yaw)
  }
  for (let i = 0; i < 225; i++) {
    const s = random() * (length + 260) - 65
    const far = 154 + 26 * sin(s/114) + 11 * sin(s/41)
    const height = 12 + 8*sin(s/55)
    village(s,far-coastAt(s).x+random()*12, height-15)
  }

  // Foreground coastal plants, small trail stones and wave crests break up the broad surfaces.
  for (let i = 0; i < 1850; i++) {
    const s = random()*(length+125)-40
    const {x,y} = coastAt(s)
    const side = random() > 0.51 ? 1 : -1
    const d = side * (4.52 + random() * (side > 0 ? outerEdge(s)-4.6 : 15))
    const h = bankHeight(s,d)
    const size = 0.15 + random() * 0.8
    if (i % 7 === 0) {
      rock(x+d,h+0.1,-s, size*1.37,size*0.62,size,swatches.rock,i)
    } else {
      const palette = [0x8d9c43,0xa9ac53,0x799652,0xa9b354]
      rock(x+d,h+0.07,-s, size*1.1,size*0.62,size*0.83,palette[i%4],i)
      if (i % 4 === 0) conifer(x+d,h+size*0.59,-s,size*0.25,size*1.15,size*0.3,0xd0ae57,i)
    }
    if (i % 3 === 0) {
      const px = x + (random()-0.5)*7.6
      rock(px,y+0.032,-s,size*0.31,0.027,size*0.17,0xb59c76,i)
    }
    const foamX = x+outerEdge(s)+13+(i%3===0 ? random()*8 : random()*80)
    waterTint(foamX,seaLevel+0.032,-s,0.55+random()*2.2,1,0.16+random()*0.45,i%3 === 0 ? 0xc6e4da : 0x86c2c1,i)
  }

  const terrain = new THREE.BufferGeometry()
  terrain.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  terrain.computeVertexNormals()
  const groundMat = new THREE.MeshStandardMaterial({vertexColors:true, side:THREE.DoubleSide, roughness:1,flatShading:true})
  // World-space grain adds small dry-stone and grass variations without texture assets.
  groundMat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 coastWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ncoastWorld = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 coastWorld;
        float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1,0)),f.x),mix(groundHash(i+vec2(0,1)),groundHash(i+vec2(1,1)),f.x),f.y);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 st = coastWorld.xz + 0.32*coastWorld.y;
        float nearFade=1.-smoothstep(.2,1.,length(fwidth(st)));
        diffuseColor.rgb *= 1. + (groundNoise(st*1.7)-.5)*.18*nearFade + (groundNoise(st*11.)-.5)*.10*nearFade + (groundNoise(st*.18)-.5)*.09;`)
  }
  root.add(new THREE.Mesh(terrain, groundMat))

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1800, 2400),new THREE.MeshStandardMaterial({color:0x4bacc1,roughness:0.44,metalness:0.06}))
  sea.rotation.x = -Math.PI/2
  sea.position.set(260,seaLevel,-600)
  root.add(sea)
  const matrix = new THREE.Object3D()
  const sections = []
  // Keep the entire architectural silhouette, stream near-field detail in modest sections.
  for (const [name, {geometry,items}] of batches) {
    const near = ['Salt meadow grasses','Trunks','Cypresses','Rock and foliage','Sea foam and reflections'].includes(name)
    const bins = new Map()
    for (const item of items) {
      const index = near ? Math.floor(-item.z / 100) : 0
      if (!bins.has(index)) bins.set(index, [])
      bins.get(index).push(item)
    }
    for (const [index, group] of bins) {
      const mesh = new THREE.InstancedMesh(geometry,envMat,group.length)
      mesh.name = name
      group.forEach(({x,y,z,w,h,d,color,rotation},i) => {
        matrix.position.set(x,y,z)
        matrix.scale.set(w,h,d)
        matrix.rotation.set(0,rotation,0)
        matrix.updateMatrix()
        mesh.setMatrixAt(i,matrix.matrix)
        mesh.setColorAt(i,new THREE.Color(color))
      })
      mesh.computeBoundingSphere()
      root.add(mesh)
      if (near) sections.push({mesh,start:index*100,range:name === 'Salt meadow grasses' ? 100 : 280})
    }
  }

  // Gradient and soft graphic cumulus follow the player in the middle distance.
  const skyGeo = new THREE.SphereGeometry(1,40,20)
  const skyMat = new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader: `varying vec3 vDir; void main(){vDir=position;vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=clip.xyww;}`,
    fragmentShader: `
      varying vec3 vDir;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,341.7)))*43758.5453);}
      float n(vec2 p){vec2 f=fract(p);vec2 i=floor(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float cloud(vec2 p){return .54*n(p)+.27*n(p*2.1)+.13*n(p*4.3)+.06*n(p*9.);}
      void main(){
        vec3 d=normalize(vDir);
        float high=clamp(d.y,0.,1.);
        vec3 sky=mix(vec3(.55,.80,.87),vec3(.075,.31,.68),pow(high,.66));
        vec2 p=d.xz/max(d.y+.035,.035)*1.85;
        float clouds=smoothstep(.50,.68,cloud(p+vec2(2.9,7.2)))*smoothstep(.025,.14,high);
        sky=mix(sky,vec3(.98,.95,.84),clouds*.88);
        gl_FragColor=vec4(sky,1.);
        #include <colorspace_fragment>
      }`})
  const sky = new THREE.Mesh(skyGeo,skyMat)
  sky.renderOrder = -1000
  sky.frustumCulled = false
  root.add(sky)
  sky.scale.setScalar(300)
  return {
    length,
    update(s) {
      const {x,y} = coastAt(s)
      sky.position.set(x,y+4,-s)
      for (const {mesh,start,range} of sections) mesh.visible = start+100 > s-35 && start < s+range
    },
  }
}
