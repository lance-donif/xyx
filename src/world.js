import * as THREE from 'three'

const LENGTH = 1200
const FIRST = -64
const LAST = LENGTH + 150
const TAU = Math.PI * 2

// x is the centre of the lane at z = -s. The road surface itself stays level across its width.
export function roadAt(s) {
  return {
    x: 18 * Math.sin(s / 72) + 9 * Math.sin(s / 38 + 0.65) - 9 * Math.sin(0.65),
    y: -0.085 * s + 2.6 * Math.sin(s / 43) - 0.9 * Math.sin(s / 21),
  }
}

function groundAt(x, s) {
  const road = roadAt(s)
  const dx = x - road.x
  const d = Math.max(0, Math.abs(dx) - 4.65)
  const ridge = dx < 0 ? -0.15 : 0.044
  return road.y - 0.12 + d * ridge +
    (Math.sin(x * 0.083 + s * 0.025) * 1.6 + Math.cos(s * 0.067 - x * 0.029) * 0.95) * Math.min(1, d / 11)
}

function makeRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function triangleMesh(points, tones, material) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  if (tones) geo.setAttribute('color', new THREE.Float32BufferAttribute(tones, 3))
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

function paintNoise() {
  const size = 128
  const bytes = new Uint8Array(size * size * 4)
  const rand = makeRandom(7304)
  for (let i = 0; i < bytes.length; i += 4) {
    const n = 182 + Math.floor(rand() * 67)
    bytes.set([n, n, n, 255], i)
  }
  const tex = new THREE.DataTexture(bytes, size, size)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

function makeRoad(scene, shade) {
  const points = [], uv = [], index = [], colors = []
  const strips = [
    [-5.05, -4.04, '#acaa8d'], [-4.04, -3.96, '#595d58'],
    [-3.96, -3.89, '#f8efda'], [-3.89, 3.89, '#646970'],
    [3.89, 3.96, '#f8efda'], [3.96, 4.04, '#595d58'], [4.04, 5.05, '#acaa8d'],
  ]
  function strip(s, end, a, b, color, lift = 0) {
    const p = roadAt(s), q = roadAt(end), first = points.length / 3
    points.push(p.x+a,p.y+lift,-s, p.x+b,p.y+lift,-s, q.x+b,q.y+lift,-end, q.x+a,q.y+lift,-end)
    uv.push(a/4,s/4,b/4,s/4,b/4,end/4,a/4,end/4)
    const c = new THREE.Color(color)
    for (let i = 0; i < 4; i++) colors.push(c.r,c.g,c.b)
    index.push(first, first+1, first+2, first, first+2, first+3)
  }
  for (let s = FIRST; s < LAST; s += 2) {
    strips.forEach(([a,b,c]) => strip(s, s+2, a,b,c))
    if (s % 10 === 0) strip(s, s+2, -0.054, 0.054, '#e2ddc8', 0.015)
  }
  const mesh = triangleMesh(points, colors, new THREE.MeshLambertMaterial({vertexColors:true, map: paintNoise()}))
  mesh.geometry.setIndex(index)
  mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2))
  mesh.geometry.computeVertexNormals()
  shade.apply(mesh.material)
  scene.add(mesh)
}

function makeMeadows(scene, shade) {
  const rand = makeRandom(71522)
  const points = [], colors = []
  const offsets = [-230,-180,-130,-99,-71,-49,-35,-23,-15,-9,-5,0,5,9,15,23,35,49,71,99,130,180,230]
  const rows = []
  for (let s = FIRST - 6; s <= LAST + 8; s += 6) {
    rows.push(offsets.map(dx => {
      const along = s + (Math.abs(dx) > 7 ? rand()*3-1.5 : 0)
      const x = roadAt(along).x + dx + (Math.abs(dx) > 9 ? rand()*2-1 : 0)
      return [x, groundAt(x, along), -along]
    }))
  }
  const shades = ['#a8b95f','#adbf66','#91aa54','#809d4e','#9db553','#b4bd66']
  for (let r=1; r<rows.length; r++) {
    for (let j=1; j<offsets.length; j++) {
      const a=rows[r-1][j-1], b=rows[r-1][j], c=rows[r][j], d=rows[r][j-1]
      const sector = Math.floor((a[0] + 260 + Math.sin(r*0.09)*13)/21) + Math.floor(r/6)*3
      const tint = new THREE.Color(shades[Math.abs(sector)%shades.length])
      if (Math.abs(offsets[j]) < 10) tint.set('#a7b66a')
      for (const tri of [[a,b,c],[a,c,d]]) {
        const brightness = .98 + rand()*.035
        for (const p of tri) {
          points.push(...p); colors.push(tint.r*brightness,tint.g*brightness,tint.b*brightness)
        }
      }
    }
  }
  const material = new THREE.MeshLambertMaterial({vertexColors:true})
  shade.apply(material)
  scene.add(triangleMesh(points, colors, material))
}

function prism() {
  const shape = new THREE.Shape()
  shape.moveTo(-.5,0); shape.lineTo(.5,0); shape.lineTo(0,1); shape.closePath()
  return new THREE.ExtrudeGeometry(shape, {bevelEnabled:false,depth:1}).translate(0,0,-.5)
}

function masonry(span, radius) {
  const sh = new THREE.Shape()
  sh.moveTo(-span/2,0); sh.lineTo(span/2,0); sh.lineTo(span/2,-48)
  sh.lineTo(radius,-48); sh.lineTo(radius,-9)
  sh.absarc(0,-9,radius,0,Math.PI,false)
  sh.lineTo(-radius,-48); sh.lineTo(-span/2,-48); sh.closePath()
  return new THREE.ExtrudeGeometry(sh,{bevelEnabled:false,depth:2.8,curveSegments:12}).translate(0,0,-1.4)
}

function stoneArchTrim() {
  const sh = new THREE.Shape()
  const a=-Math.PI/26+.009,b=Math.PI/26-.009
  sh.absarc(0,0,6.12,a,b,false); sh.absarc(0,0,5.62,b,a,true); sh.closePath()
  return new THREE.ExtrudeGeometry(sh,{bevelEnabled:false,depth:.19,curveSegments:2})
}

function batches(scene) {
  const geo = {
    box:new THREE.BoxGeometry(),
    trunk:new THREE.CylinderGeometry(.65,1,1,8),
    pipe:new THREE.CylinderGeometry(1,1,1,6),
    crown:new THREE.IcosahedronGeometry(1,1),
    shrub:new THREE.IcosahedronGeometry(1,0),
    spruce:new THREE.ConeGeometry(1,1,8),
    roof:prism(),
    arch:masonry(14,5.66),
    archTrim:stoneArchTrim(),
  }
  const material = new THREE.MeshLambertMaterial({flatShading:true})
  const groups = new Map()
  const sections = []
  const rotation = new THREE.Euler(), quaternion = new THREE.Quaternion(), matrix = new THREE.Matrix4()
  const up = new THREE.Vector3(0,1,0)
  function place(type,x,y,z,w,h,d,tint,rx=0,ry=0,rz=0) {
    quaternion.setFromEuler(rotation.set(rx,ry,rz,'YXZ'))
    put(type,x,y,z,w,h,d,tint,quaternion)
  }
  function put(type,x,y,z,w,h,d,tint,q) {
    // Group by distance to keep distant villages and woodland out of the draw list.
    const section=Math.floor(-z/80)
    const key = type + ':' + section
    if (!groups.has(key)) groups.set(key,{type,section,list:[]})
    matrix.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(w,h,d))
    groups.get(key).list.push([matrix.clone(), new THREE.Color(tint)])
  }
  function beam(type,a,b,radius,tint,depth=radius) {
    const v = new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2])
    const len = v.length()
    put(type,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,radius,len,depth,tint,quaternion.setFromUnitVectors(up,v.normalize()))
  }
  function finish() {
    for (const {type,section,list} of groups.values()) {
      const mesh = new THREE.InstancedMesh(geo[type],material,list.length)
      list.forEach(([m,c],i) => {mesh.setMatrixAt(i,m); mesh.setColorAt(i,c)})
      mesh.computeBoundingSphere(); scene.add(mesh)
      const reach=type==='shrub'?100:300
      sections.push({mesh,from:section*80-reach,to:(section+1)*80+24})
    }
  }
  let lastBucket
  function update(s) {
    const bucket=Math.floor(s/8)
    if(bucket===lastBucket) return
    lastBucket=bucket
    for(const part of sections) part.mesh.visible=s>=part.from && s<=part.to
  }
  return {place,beam,finish,update}
}

// The shadow atlas follows the entire course. Sampling it on the ground avoids shadow-map
// shimmers on the road as the chase camera moves and keeps trees cheap on mobile GPUs.
function groundShadows() {
  const width=512, height=2048, spanX=400, spanS=LAST-FIRST+24
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='white';ctx.fillRect(0,0,width,height)
  ctx.scale(width/spanX,height/spanS)
  ctx.translate(spanX/2,12-FIRST)
  const tex=new THREE.CanvasTexture(canvas)
  const rand=makeRandom(219)
  function ellipse(x,s,rx,rz,strength) {
    ctx.save()
    ctx.translate(x,s);ctx.scale(rx,rz)
    const g=ctx.createRadialGradient(0,0,.03,0,0,1)
    g.addColorStop(0,'rgba(0,0,0,'+strength+')')
    g.addColorStop(.67,'rgba(0,0,0,'+strength*.94+')')
    g.addColorStop(.87,'rgba(0,0,0,'+strength*.75+')')
    g.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=g
    ctx.fillRect(-1,-1,2,2)
    // Canopy lobes break up the shadow edge in the large tree galleries.
    if(rx>7) for(let i=0;i<12;i++) {
      const a=i/12*TAU, r=.13+rand()*.14, dx=Math.cos(a)*.85,dy=Math.sin(a)*.83
      const patch=ctx.createRadialGradient(dx,dy,r*.42,dx,dy,r)
      patch.addColorStop(0,'rgba(0,0,0,'+strength*.48+')')
      patch.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=patch;ctx.fillRect(dx-r,dy-r,r*2,r*2)
    }
    ctx.restore()
  }
  function apply(material) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.courseShade={value:tex}
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nvarying vec2 vShadeUV;').replace('#include <begin_vertex>',
        `#include <begin_vertex>
        vShadeUV=vec2(position.x/${spanX.toFixed(1)}+.5,1.-(-position.z+${(12-FIRST).toFixed(1)})/${spanS.toFixed(1)});`)
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying vec2 vShadeUV; uniform sampler2D courseShade;')
        .replace('#include <color_fragment>',`#include <color_fragment>
        float shade=1.-texture2D(courseShade,vShadeUV).r;
        diffuseColor.rgb *= 1.-vec3(.88,.76,.54)*shade;`)
    }
  }
  return {ellipse,apply}
}

// Sweep irregular cross sections along each limb so bent boughs stay continuous at their joints.
function woodwork(scene) {
  const points=[],tones=[],indices=[],rand=makeRandom(422)
  const axis=new THREE.Vector3(0,0,1)
  const bark=new THREE.Color('#826d4e')
  function limb(centres,radii) {
    const n=9, start=points.length/3
    const grain=Array.from({length:n},()=>.79+rand()*.4)
    centres.forEach((point,j)=>{
      const prev=centres[Math.max(0,j-1)],next=centres[Math.min(centres.length-1,j+1)]
      const tangent=new THREE.Vector3(next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]).normalize()
      const side=new THREE.Vector3().crossVectors(tangent,axis).normalize()
      const normal=new THREE.Vector3().crossVectors(tangent,side).normalize()
      for(let i=0;i<n;i++){
        const a=i/n*TAU,r=radii[j]*(.82+grain[i]*.18),u=Math.cos(a)*r,v=Math.sin(a)*r
        points.push(point[0]+side.x*u+normal.x*v,point[1]+side.y*u+normal.y*v,point[2]+side.z*u+normal.z*v)
        tones.push(bark.r*grain[i],bark.g*grain[i],bark.b*grain[i])
        if(j){
          const k=start+j*n+i,kn=start+j*n+(i+1)%n
          indices.push(k-n,kn-n,k,kn-n,kn,k)
        }
      }
    })
  }
  function finish(){
    const g=new THREE.BufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute(points,3))
    g.setAttribute('color',new THREE.Float32BufferAttribute(tones,3))
    g.setIndex(indices); g.computeVertexNormals()
    scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})))
  }
  return {limb,finish}
}

function landscapeObjects(batch,shade,wood) {
  const {place,beam} = batch, rand = makeRandom(9301)
  const pick = list => list[Math.floor(rand()*list.length)]
  const canopies = ['#44703c','#58813f','#688f40','#779441','#47723e','#668845','#83a14c']
  function canopy(x,y,z,r) {
    place('crown',x,y,z,r*(1.05+rand()*.3),r*.75,r,pick(canopies),rand()*.3,rand()*6,rand()*.4)
  }
  function greatTree(side,s,height) {
    const x = roadAt(s).x + side*(8.5+rand()*1.5), z=-s
    const y = groundAt(x,s)
    shade.ellipse(x+height*.44,s-height*.27,height*.43,height*.29,.52)
    shade.ellipse(x,s,height*.15,height*.15,.42)
    const root=[x,y-.65,z], elbow=[x+side*1.25,y+height*.38,z-1], fork=[x-side*1.35,y+height*.69,z-.5]
    wood.limb([root,[x+side*.47,y+height*.16,z-.3],elbow,[x+side*.42,y+height*.52,z-.78],fork],
      [.125,.08,.069,.055,.038].map(r=>r*height))
    for(let k=0;k<7;k++) {
      const a=k*TAU/7
      wood.limb([[x+Math.sin(a)*height*.17,y-.44,z+Math.cos(a)*height*.17],
        [x+Math.sin(a)*height*.101,y+.38,z+Math.cos(a)*height*.101],
        [x+side*.4,y+height*.17,z-.3]],[height*.013,height*.038,height*.052])
    }
    for(let k=0;k<7;k++) {
      const a=TAU*k/7+rand()*.4
      const end=[fork[0]+Math.sin(a)*height*.29,fork[1]+(.19+rand()*.11)*height,fork[2]+Math.cos(a)*height*.25]
      const bend=[(fork[0]+end[0])*.5,(fork[1]+end[1])*.5-.65,(fork[2]+end[2])*.5]
      wood.limb([fork,bend,end],[height*.034,height*.025,height*.011])
      canopy(...end,height*(.18+rand()*.044))
      canopy(end[0]+Math.sin(a)*2,end[1]-1,end[2]+Math.cos(a)*2,height*.133)
    }
    const inward=[x-side*height*.35, y+height*.66,z+1]
    const tip=[x-side*height*.5,y+height*.72,z+2.2]
    wood.limb([elbow,[x-side*height*.16,y+height*.53,z+.6],inward,tip],[.056,.044,.032,.019].map(r=>r*height))
    canopy(...tip,height*.173)
  }
  for(const s of [13,39,75,112,245,268,880,905,939,977,1103,1138]) {
    greatTree(-1,s,16+rand()*5); greatTree(1,s+5+rand()*3,15+rand()*6)
  }
  function tree(x,s,h,pine) {
    const y = groundAt(x,s), z=-s
    if(Math.abs(x-roadAt(s).x)<33) shade.ellipse(x+h*.36,s-h*.25,h*.34,h*.24,.38)
    place('trunk',x,y+h*.28,z,h*.048,h*.58,h*.047,'#6d6551')
    if (pine) {
      const t=pick(['#426d5a','#385d50','#567a5b','#466d52'])
      for(let i=0;i<3;i++) place('spruce',x,y+h*(.43+i*.16),z,h*(.23-i*.041),h*(.55-i*.066),h*(.23-i*.04),t,0,i*.37)
    } else {
      canopy(x,y+h*.74,z,h*.31)
      canopy(x+h*.14,y+h*.70,z+h*.09,h*.22)
      canopy(x-h*.15,y+h*.65,z-h*.1,h*.235)
    }
  }
  for(let i=0;i<1250;i++) {
    const s = FIRST+rand()*(LAST-FIRST)
    const side = rand()<.5?-1:1
    const lateral=10+Math.pow(rand(),.75)*140
    if (s>385 && s<740 && lateral<29 || s>140 && s<170 && lateral<19) continue
    tree(roadAt(s).x+side*lateral,s,3+rand()*7.5,lateral>32?rand()<.65:rand()<.18)
  }
  // Small rocks, grasses and flowering verges supply a readable near-ground speed cue.
  for(let i=0;i<3400;i++) {
    const s=FIRST+rand()*(LAST-FIRST), side=rand()<.5?-1:1
    const x=roadAt(s).x+side*(5.35+rand()*20),y=groundAt(x,s),z=-s
    if (i%8===0) place('shrub',x,y+.15,z,.4+rand()*1.1,.25+rand()*.5,.5+rand()*.6,pick(['#9b9c86','#888e83','#a2a291']),rand()*.4,rand()*4)
    else if (i%4===0) place('shrub',x,y+.32,z,.55+rand(),.45+rand()*.5,.9,pick(canopies),0,rand()*3)
    else place('shrub',x,y+.16,z,.10+rand()*.22,.16+rand()*.35,.12+rand()*.19,pick(['#bbbe64','#7f9d48','#cdbe72','#c4b270','#d8c993']),0,rand()*3)
  }
  for(let i=0;i<560;i++) {
    const s=FIRST+rand()*(LAST-FIRST), side=rand()<.5?-1:1
    const x=roadAt(s).x+side*(5.3+rand()*4.7)
    const bloom=pick(['#f3cc64','#f4db89','#e8dfaa','#d4a8a2'])
    for(let j=0;j<5;j++) {
      const dx=x+(rand()-.5)*1.2, ds=s+(rand()-.5)*1.2, y=groundAt(dx,ds)
      place('shrub',dx,y+.19,-ds,.12,.26+rand()*.21,.08,'#819d4c',0,rand()*3,(rand()-.5)*.4)
      if(j%2===0) place('shrub',dx,y+.42,-ds,.10,.09,.11,bloom,0,rand()*3)
    }
  }
  // Galvanised guardrails and Swiss-style roadside delineators.
  for (let s=FIRST+4;s<LAST-6;s+=4) {
    for (const side of [-1,1]) {
      const road=roadAt(s), next=roadAt(s+4), x=road.x+side*4.88, end=next.x+side*4.88
      const guard=side===-1 && (s%165)<78 && !(s>380&&s<730)
      if(guard) {
        place('box',x,road.y+.44,-s,.11,.94,.12,'#808484')
        beam('box',[x,road.y+.76,-s],[end,next.y+.76,-s-4],.105,'#c4c9b5',.23)
      } else if(s%16===4) {
        place('box',x+side*.26,road.y+.47,-s,.16,.95,.18,'#eae6cf')
        place('box',x+side*.26,road.y+.72,-s,.164,.18,.185,'#353d3b')
        place('box',x+side*.26,road.y+.74,-s+.102,.084,.079,.025,side<0?'#d96a40':'#f4e7b2')
      }
    }
  }
  function house(x,s,w,h,d,angle,tone) {
    const y=groundAt(x,s),z=-s, ca=Math.cos(angle),sa=Math.sin(angle)
    function part(type,ox,oy,oz,width,height,depth,color) {
      place(type,x+ox*ca+oz*sa,y+oy,z-ox*sa+oz*ca,width,height,depth,color,0,angle)
    }
    const roof=pick(['#965c48','#8f5c46','#665c55','#ae7350','#626772','#9a6e55'])
    const timber=pick(['#675345','#755d49','#564c43'])
    const near = Math.abs(x-roadAt(s).x)<24
    if(near) shade.ellipse(x+2.4,s-2,w*.92,d*.79,.42)
    part('box',0,h/2-.65,0,w,h+1.3,d,tone)
    part('roof',0,h,0,w+1.1,w*.48,d+.95,roof)
    if(near) {
      // Plastered gable ends sit just under the overhanging tiled roof.
      part('roof',0,h,0,w*.85,w*.415,d+.96,'#e4cda6')
      part('box',0,h+w*.48,0,.14,.13,d+1.02,'#82533e')
    }
    part('box',w*.23,h+w*.30,-d*.17,w*.10,w*.43,w*.125,'#b8a48d')
    for (const side of [-1,1]) {
      const face=d/2*side
      for(let i=-1;i<=1;i++) {
        part('box',w*.31*i,h*.65,face,w*.12,h*.17,.1,'#4a6262')
        for(const sign of [-1,1]) part('box',w*.31*i+sign*w*.088,h*.65,face,w*.046,h*.19,.14,timber)
      }
      part('box',0,h*.29,face,w*.16,h*.55,.14,timber)
      part('box',0,h*.49,face,w+.06,.12,.15,timber)
      part('box',0,h-.08,face,w+.06,.13,.15,timber)
      if(near) {
        part('box',0,h*.87,face,.13,h*.25,.17,timber)
        for(const t of [-.46,-.19,.19,.46]) part('box',w*t,h*.53,face,.13,h*.94,.18,timber)
        for(const t of [-.24,.24]) {
          const ax=x+(w*t)*ca+(face+.08*side)*sa, az=z-(w*t)*sa+(face+.08*side)*ca
          place('box',ax,y+h*.77,az,.12,h*.42,.16,timber,0,angle,t>0?.5:-.5)
        }
        part('box',0,h*.11,face+.32*side,w*.20,.19,.73,'#a59c86')
        part('box',0,h+w*.17,side*(d+.99)/2,w*.1,w*.15,.11,'#4e5c59')
        part('box',0,h+w*.165,side*(d+.98)/2,.10,w*.35,.09,timber)
      }
    }
    for(const side of [-1,1]) {
      part('box',side*w*.49,h*.52,0,.13,.15,d+.1,timber)
      for(const t of [-.28,.28]) {
        part('box',side*w*.5,h*.69,t*d,.09,h*.2,d*.14,'#536e6a')
        if(near) {
          part('box',side*w*.5,h*.27,t*d,.10,h*.22,d*.13,'#506464')
          part('box',side*(w*.5+.05),h*.575,t*d,.16,.10,d*.19,'#e4c598')
          for(const sign of [-1,1]) part('box',side*w*.5,h*.69,(t+sign*.10)*d,.12,h*.22,d*.05,timber)
        }
      }
      if(near) for(const t of [-.475,0,.475]) part('box',side*w*.5,h*.5,t*d,.14,h,.16,timber)
    }
  }
  const plaster=['#ead4aa','#d9c59e','#f0dcb2','#d0b99d','#efdfc2','#d6b58b']
  for(let s=367;s<736;s+=10+rand()*8) {
    for (const side of [-1,1]) {
      const away=10+rand()*3.2
      house(roadAt(s).x+side*away,s+rand()*2,5+rand()*2.2,4.3+rand()*4,6+rand()*2.5,side*(1+rand()*.4),pick(plaster))
    }
  }
  for(let i=0;i<115;i++) {
    const s=35+rand()*1110,side=rand()<.75?-1:1
    const x=roadAt(s).x+side*(31+rand()*100)
    house(x,s,5+rand()*3,4+rand()*3,6+rand()*3,rand()*Math.PI,pick(plaster))
  }
  for (const [s,lateral] of [[115,-46],[440,24],[686,-24],[936,54]]) {
    const x=roadAt(s).x+lateral, base=groundAt(x,s)
    house(x,s,8,7,14,.3,'#ecd9ad')
    place('box',x+2,base+7.3,-s-5,3.1,16.6,3.1,'#e8d5b0',0,.3)
    place('spruce',x+2,base+19,-s-5,3,7,3,'#52655e',0,.55)
  }
  function viaduct(s, yaw, elevation, count) {
    const road=roadAt(s), deck=road.y+elevation, ca=Math.cos(yaw),sa=Math.sin(yaw)
    for(let i=-count; i<=count; i++) {
      const centre=i*14
      function at(a,b,c){return [road.x+(centre+a)*ca+c*sa,deck+b,-s-(centre+a)*sa+c*ca]}
      place('arch',...at(0,0,0),1,1,1,pick(['#b8a78a','#c0ae90','#baaa8d']),0,yaw)
      place('box',...at(0,-.18,0),14,.42,3.25,'#d5c4a0',0,yaw)
      place('box',...at(0,.15,0),14,.25,3.0,'#a2967c',0,yaw)
      place('box',...at(0,.48,.99),14,.58,.36,'#c3b18e',0,yaw)
      place('box',...at(0,.48,-.99),14,.58,.36,'#c3b18e',0,yaw)
      for(let k=0;k<13;k++){
        const a=(k+.5)*Math.PI/13
        place('archTrim',...at(0,-9,1.405),1,1,1,k%3===0?'#dcccac':'#cebd9e',0,yaw,a)
      }
      for(const sy of [-10,-15,-20,-25,-30]) {
        place('box',...at(6.98,sy,0),2.95,.38,3.06,'#ae9d81',0,yaw)
      }
    }
  }
  viaduct(152,.36,15,13)
  viaduct(778,-.48,16,13)
}

function makeHorizon(scene) {
  const sky = new THREE.Group()
  sky.renderOrder = -5
  scene.add(sky)
  const dome = new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,
    uniforms: {
      zenith:{value:new THREE.Color('#5097c2')},haze:{value:new THREE.Color('#d6e7db')},
      sunlight:{value:new THREE.Color('#fff2c0')},
    },
    vertexShader:`varying vec3 ray;
    void main() {ray=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec3 ray;
      uniform vec3 zenith; uniform vec3 haze; uniform vec3 sunlight;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
      }
      void main(){
        vec3 v=normalize(ray);
        vec3 col=mix(haze,zenith,smoothstep(-.035,.66,v.y));
        float sun=max(dot(v,normalize(vec3(-.52,.32,-.85))),0.);
        col=mix(col,sunlight,clamp(pow(sun,30.)*.30+pow(sun,350.)*.51+smoothstep(.9992,.9998,sun),0.,1.));
        vec2 p=v.xz/max(.06,v.y)*1.7;
        float cloud=noise(p)*.52+noise(p*2.03)*.27+noise(p*4.1)*.14+noise(p*8.3)*.07;
        col=mix(col,vec3(.94,.96,.90),smoothstep(.60,.78,cloud)*smoothstep(.02,.15,v.y)*.70);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  })
  const domeMesh=new THREE.Mesh(new THREE.SphereGeometry(240,32,18),dome)
  domeMesh.renderOrder=-5; domeMesh.frustumCulled=false; sky.add(domeMesh)
  const rand=makeRandom(15)
  // A triangulated Alpine skyline. Pale rock faces and snow follow the same sun direction as the track.
  const mountainLayers=[]
  for(let layer=0;layer<2;layer++) {
    const points=[],colors=[]
    const radius=208-layer*25, n=116
    const rings=[[],[],[],[]]
    for(let i=0;i<n;i++) {
      const a=i/n*TAU, wave=(Math.sin(a*6+.8)+1)/2, peak=(Math.sin(a*11+1.7)+1)/2
      const height=layer===0 ? 25+wave*17+peak*9+rand()*7 : 7+wave*10+peak*4+rand()*3
      for(let k=0;k<4;k++) {
        const r=radius-k*(4+layer*2)-rand()*1.8
        const offset=k===0 ? 0 : Math.sin(i*1.7+k)*.019
        rings[k].push([Math.sin(a+offset)*r,[height,height*.70,height*.26,-29][k],-Math.cos(a+offset)*r])
      }
    }
    const lightRock=['#91a7b2','#adbdc3','#90a9b5','#849ba8']
    const nearHill=['#88a69b','#87a295','#8fac9e','#76968b']
    for(let i=0;i<n;i++) {
      const j=(i+1)%n
      for(let k=0;k<3;k++) {
        for(const tri of [[rings[k][i],rings[k+1][i],rings[k][j]],[rings[k][j],rings[k+1][i],rings[k+1][j]]]) {
          const high=Math.max(...tri.map(p=>p[1]))
          const snowy=layer===0 && k===0 && high>38 && (tri[0][1]>tri[2][1] || rand()>.45)
          const tint=new THREE.Color(snowy?(rand()<.5?'#f0f0df':'#e2e8df'):(layer?nearHill:lightRock)[Math.floor(rand()*4)])
          for(const p of tri){points.push(...p);colors.push(tint.r,tint.g,tint.b)}
        }
      }
    }
    const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false,fog:false})
    const mountains=triangleMesh(points,colors,mat)
    mountains.frustumCulled=false; mountains.renderOrder=-4+layer
    sky.add(mountains); mountainLayers.push(mat)
  }
  return {
    follow(s){ const p=roadAt(s);sky.position.set(p.x,p.y,-s) },
    theme(dusk){
      dome.uniforms.zenith.value.set(dusk?'#625a89':'#5097c2')
      dome.uniforms.haze.value.set(dusk?'#f6ba88':'#d6e7db')
      dome.uniforms.sunlight.value.set(dusk?'#ffcf76':'#fff2c0')
      mountainLayers.forEach(mat=>mat.color.set(dusk?'#d6aaa2':'#ffffff'))
    },
  }
}

export function createWorld(scene) {
  const hemisphere = new THREE.HemisphereLight('#e5f3ff','#9ca381',1.65)
  const sunlight = new THREE.DirectionalLight('#fff1d1',2.0)
  sunlight.position.set(-50,84,-42)
  scene.add(hemisphere,sunlight)
  scene.fog=new THREE.FogExp2('#c8dace',.0054)
  const horizon=makeHorizon(scene)
  const shade=groundShadows()
  makeMeadows(scene,shade)
  makeRoad(scene,shade)
  const batch=batches(scene)
  const wood=woodwork(scene)
  landscapeObjects(batch,shade,wood)
  batch.finish()
  wood.finish()
  return {
    length:LENGTH,
    update(s) { horizon.follow(s); batch.update(s) },
    setTheme(name) {
      const dusk=name==='dusk'
      horizon.theme(dusk)
      hemisphere.color.set(dusk?'#ffd2b4':'#e5f3ff')
      hemisphere.groundColor.set(dusk?'#777187':'#9ca381')
      sunlight.color.set(dusk?'#ffa967':'#fff1d1')
      sunlight.position.set(-50,dusk?38:84,-42)
      scene.fog.color.set(dusk?'#d6a18e':'#c8dace')
    },
  }
}
