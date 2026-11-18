import * as THREE from 'three'
import { createFoliageBatch, terrainMap } from './nature.js'
import { buildVillage } from './village.js'
import { mountSky } from './sky.js'

const LENGTH = 1200
const FIRST = -76
const LAST = LENGTH + 175
const TAU = Math.PI * 2
const { sin, cos, abs } = Math
const smooth = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b)

// Scale lateral riding limits and gate offsets with the paved width.
// The hamlets use their original broad streets; the two elevated causeways are single-lane.
export function alpineLaneScale(s) {
  const firstRidge = 1 - smooth(245, 365, s)
  const secondRidge = smooth(660, 755, s) * (1 - smooth(960, 1060, s))
  return 1 - .47 * Math.max(firstRidge, secondRidge)
}

export function roadAt(s) {
  return {
    x: 12 * sin(s / 67 + .3) + 15 * sin(s / 109 - .58) + 4.7 * sin(s / 31 - .6),
    y: 53 - .068 * s - 23 * (Math.tanh((s - 35) / 86) + .386)
      - 23 * smooth(325, 496, s) - 20 * smooth(721, 945, s) - 14 * smooth(1005, 1165, s)
      + 1.35 * sin(s / 60),
  }
}

function ridgeDepth(s) {
  return 1.2 + 35 * (1 - smooth(130, 363, s)) + 27 * smooth(662, 785, s) * (1 - smooth(894, 1082, s))
}

// An eroded, grass-topped ridge carries the asphalt. The hamlets are on the fields below.
function groundAt(x, s) {
  const r = roadAt(s)
  const lateral = x - r.x
  const width = alpineLaneScale(s)
  const shoulder = 3.96*width + .72
  const d = Math.max(0, abs(lateral) - shoulder)
  const envelope = 1 - Math.exp(-Math.pow(d / (10.5 + 2.3 * sin(s / 45)), 1.5))
  const undulation = sin(x * .033 + s * .019) * 1.8 + cos(s * .027 - x * .017) * 1.4
  const valleySide = smooth(78, 235, d) * (11 + 9 * sin(s * .011 + lateral * .014))
  return r.y - .09 + .18*Math.exp(-((abs(lateral)-shoulder-.16)**2)/.67) - ridgeDepth(s) * envelope + undulation * smooth(12, 44, d) + valleySide
}

function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function geometry(positions, indices, colors, uvs) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

function makeRoad(scene, shadows) {
  const points = [], uvs = [], indices = [], colors = []
  function strip(s, a, b, tone, lift = 0) {
    const p = roadAt(s), q = roadAt(s + 2), first = points.length / 3
    const w = alpineLaneScale(s), v = alpineLaneScale(s+2)
    points.push(p.x+a*w,p.y+lift,-s,p.x+b*w,p.y+lift,-s,q.x+b*v,q.y+lift,-s-2,q.x+a*v,q.y+lift,-s-2)
    uvs.push(a/3,s/3,b/3,s/3,b/3,(s+2)/3,a/3,(s+2)/3)
    const c = new THREE.Color(tone)
    for (let i = 0; i < 4; i++) colors.push(c.r,c.g,c.b)
    indices.push(first,first+1,first+2,first,first+2,first+3)
  }
  for (let s = FIRST; s < LAST; s += 2) {
    strip(s,-4.18,-3.96,'#bdb498')
    strip(s,-3.96,3.96,'#f1e4c9')
    strip(s,3.96,4.18,'#bdb498')
    for (const x of [-3.88, 3.8]) strip(s,x,x+.08,'#fffbed',.014)
    if (s % 10 === 0) strip(s,-.053,.053,'#fffbed',.014)
  }
  const material = new THREE.MeshLambertMaterial({vertexColors:true, map:terrainMap('asphalt')})
  shadows.apply(material)
  // White paint is applied after the asphalt texture in the shader.
  material.userData.paint = true
  const road=new THREE.Mesh(geometry(points,indices,colors,uvs),material)
  road.receiveShadow=true; scene.add(road)
}

function makeTerrain(scene, shadows) {
  const offsets=[-330,-270,-217,-172,-138,-110,-87,-70,-54,-43,-34,-27,-22,-18,-14,-11,-9,-7.5,-6,-5,-4.42,-4.07,0,4.07,4.42,5,6,7.5,9,11,14,18,22,27,34,43,54,70,87,110,138,172,217,270,330]
  const points=[], uv=[], colors=[], indices=[]
  const moss=new THREE.Color('#fff9aa'), stone=new THREE.Color('#dbcaa2')
  for (let s=FIRST-6, row=0; s<=LAST+9; s+=3,row++) {
    for (let j=0; j<offsets.length; j++) {
      const offset=offsets[j]
      const d=offset * THREE.MathUtils.lerp(alpineLaneScale(s),1,smooth(4.2,19,abs(offset)))
      const x=roadAt(s).x+d, y=groundAt(x,s)
      points.push(x,y,-s)
      uv.push((x+y*.28)/3.3,(s+y*.22)/3.3)
      const field=Math.floor((x+310+sin(s/72)*4)/26)+Math.floor((s+92+cos(x/70)*5)/42)*3
      const amt=(sin(field*1253.35)*.5+.5)
      const color=new THREE.Color().setHSL(.215+amt*.032,.21+amt*.08,.72+amt*.12,THREE.SRGBColorSpace)
      color.lerp(stone, smooth(11,19,abs(d))*(1-smooth(20,31,abs(d)))*ridgeDepth(s)/42)
      color.lerp(moss,(1-smooth(5,8,abs(d)))*.70)
      const noise=.975+sin(s*.32 + d*.74)*.024
      colors.push(color.r*noise,color.g*noise,color.b*noise)
      if(row && j){
        const i=row*offsets.length+j, n=offsets.length
        indices.push(i-n-1,i-n,i,i-n-1,i,i-1)
      }
    }
  }
  const material=new THREE.MeshLambertMaterial({map:terrainMap('grass'),vertexColors:true})
  material.userData.fields=true
  shadows.apply(material)
  const meadows=new THREE.Mesh(geometry(points,indices,colors,uv),material)
  meadows.receiveShadow=true;scene.add(meadows)
}

function groundShadows() {
  const w=768,h=2048,spanX=380,spanS=LAST-FIRST+24
  const canvas=document.createElement('canvas')
  canvas.width=w; canvas.height=h
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='white';ctx.fillRect(0,0,w,h)
  ctx.scale(w/spanX,h/spanS);ctx.translate(spanX/2,12-FIRST)
  const map=new THREE.CanvasTexture(canvas)
  function ellipse(x,s,rx,rz,opacity,rotation=0) {
    ctx.save();ctx.translate(x,s);ctx.rotate(rotation);ctx.scale(rx,rz)
    const g=ctx.createRadialGradient(0,0,.01,0,0,1)
    g.addColorStop(0,'rgba(0,0,0,'+opacity+')')
    g.addColorStop(.76,'rgba(0,0,0,'+opacity*.93+')')
    g.addColorStop(1,'rgba(0,0,0,0)')
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore()
  }
  function apply(material) {
    material.onBeforeCompile=shader=>{
      shader.uniforms.shadeAtlas={value:map}
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nvarying vec2 vShadeUV;').replace('#include <begin_vertex>',
        `#include <begin_vertex>
        vShadeUV=vec2(position.x/${spanX.toFixed(1)}+.5,1.-(-position.z+${(12-FIRST).toFixed(1)})/${spanS.toFixed(1)});`)
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nvarying vec2 vShadeUV; uniform sampler2D shadeAtlas;')
        .replace('#include <color_fragment>',`#include <color_fragment>
        ${material.userData.paint ? 'if(vColor.r>.90) diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.90,.82),.83);' : ''}
        ${material.userData.fields ? `
        vec2 world=vec2((vShadeUV.x-.5)*${spanX.toFixed(1)},(1.-vShadeUV.y)*${spanS.toFixed(1)}-${(12-FIRST).toFixed(1)});
        vec2 field=mat2(.97,.24,-.24,.97)*world/vec2(34.,42.);
        field.x+=mod(floor(field.y),2.)*.28;
        vec2 cell=floor(field);vec2 f=fract(field);
        float hash=fract(sin(dot(cell,vec2(12.213,48.7)))*467.432);
        float rows=sin(field.x*97.+field.y*3.1);
        float centre=12.*sin(world.y/67.+.3)+15.*sin(world.y/109.-.58)+4.7*sin(world.y/31.-.6);
        float remote=smoothstep(25.,48.,abs(world.x-centre));
        vec3 oats=mix(vec3(.78,.92,.42), vec3(1.88,1.43,.58),hash);
        float hedge=(1.-smoothstep(.006,.034,min(min(f.x,1.-f.x),min(f.y,1.-f.y))));
        vec3 farmland=mix(oats*(.94+.064*rows),vec3(.47,.59,.32),hedge);
        diffuseColor.rgb*=mix(vec3(1.23,1.29,.80),farmland,remote);
        ` : ''}
        float shade=1.-texture2D(shadeAtlas,vShadeUV).r;
        diffuseColor.rgb *= 1.-vec3(.89,.84,.50)*shade;`)
    }
    material.customProgramCacheKey=()=>material.userData.paint?'paint':'meadow'
  }
  return {ellipse,apply}
}

function makeWood(scene) {
  const material=new THREE.MeshLambertMaterial({map:terrainMap('bark'),vertexColors:true,side:THREE.DoubleSide})
  const grain=random(87223), slices=new Map()
  function limb(path, radii, moss=.0, rootSide=0) {
    const part=Math.floor(-path[0][2]/120)
    const coarse=path
    const curved=new THREE.CatmullRomCurve3(coarse.map(p=>new THREE.Vector3(...p)))
    const radii0=radii
    path=curved.getPoints((coarse.length-1)*3).map(p=>p.toArray())
    radii=path.map((_,j)=>{
      const a=j/3,i=Math.min(radii0.length-2,Math.floor(a))
      return THREE.MathUtils.lerp(radii0[i],radii0[i+1],a-i)
    })
    if(!slices.has(part)) slices.set(part,{p:[],uv:[],c:[],i:[]})
    const data=slices.get(part), first=data.p.length/3
    const n=radii[0]>2?20:9, stride=n+1
    const ring=Array.from({length:n},(_,i)=>.89+grain()*.18+sin(i*Math.PI*.8)*.07)
    const radialBrightness=Array.from({length:n},()=>.84+grain()*.26)
    const aspect=Math.max(1, radii[0]*2.9)
    const wood=new THREE.Color('#e1dbc2'), lichen=new THREE.Color('#a7c45c')
    let length=0
    path.forEach((p,j)=>{
      const prev=path[Math.max(j-1,0)],next=path[Math.min(j+1,path.length-1)]
      if(j)length+=Math.hypot(p[0]-prev[0],p[1]-prev[1],p[2]-prev[2])
      const along=new THREE.Vector3(next[0]-prev[0],next[1]-prev[1],next[2]-prev[2]).normalize()
      const ax=new THREE.Vector3().crossVectors(along,new THREE.Vector3(0,0,1)).normalize()
      const az=new THREE.Vector3().crossVectors(ax,along).normalize()
      for(let k=0;k<=n;k++){
        const a=k/n*TAU+sin(j*.8)*.055, rk=ring[k%n]*radii[j]
        const u=cos(a)*rk, v=sin(a)*rk
        let x=p[0]+ax.x*u+az.x*v
        const y=p[1]+ax.y*u+az.y*v,z=p[2]+ax.z*u+az.z*v
        if(rootSide){
          const centre=roadAt(-z).x
          x=centre+rootSide*Math.max(5.5,(x-centre)*rootSide)
        }
        data.p.push(x,y,z)
        const stain=(.6+.27*sin(a*3+j*.82)+.13*cos(a*6-j))*moss
        const tone=wood.clone().lerp(lichen,stain).multiplyScalar(radialBrightness[k%n])
        data.c.push(tone.r,tone.g,tone.b)
        data.uv.push(k/n*aspect,length/2.1)
        if(j && k){
          const i=first+j*stride+k
          data.i.push(i-stride-1,i-1,i-stride,i-stride,i-1,i)
        }
      }
    })
  }
  function finish(){
    const sections=[]
    for(const [section,d] of slices) {
      const mesh=new THREE.Mesh(geometry(d.p,d.i,d.c,d.uv),material)
      mesh.castShadow=true;mesh.receiveShadow=true
      sections.push({mesh,from:section*120-342,to:(section+1)*120+54})
      scene.add(mesh)
    }
    let previous=-1
    return distance=>{
      const bucket=Math.floor(distance/8)
      if(bucket===previous)return
      previous=bucket
      for(const part of sections)part.mesh.visible=distance>=part.from && distance<=part.to
    }
  }
  return {limb,finish}
}

function makeOakAvenue(scene, leaves, shade) {
  const rng=random(64112),wood=makeWood(scene)
  function oak(side,s,reach,canopyHeight,scaleX,scaleY,scaleZ) {
    const road=roadAt(s)
    const toWorld=([x,y,z])=>[road.x+(x-road.x)*scaleX,road.y+(y-road.y)*scaleY,-s+(z+s)*scaleZ]
    const floor=(x,along)=>{
      const worldX=road.x+(x-road.x)*scaleX, worldS=s+(along-s)*scaleZ
      return road.y+(groundAt(worldX,worldS)-road.y)/scaleY
    }
    function crown(p,rx,ry,rz) {
      leaves.crown(...toWorld(p),rx*scaleX,ry*scaleY,rz*scaleZ,Math.floor(rng()*1e6))
    }
    function limb(path,radii,moss,rootSide=0) {
      wood.limb(path.map(toWorld),radii.map(r=>r*Math.sqrt(scaleX*scaleY)),moss,rootSide)
    }
    const x=road.x+side*reach,z=-s,base=floor(x,s)
    const h=road.y-base+canopyHeight
    const twist=(rng()-.5)*9
    const girth=3.3+h*.070
    const root=[x,base-.9,z], waist=[x+side*1.8,base+h*.30,z+twist]
    const mid=[x-side*1.1,base+h*.55,z+twist*.65]
    const fork=[x-side*5.4,base+h*.71,z-1.8]
    limb([root,[x+side*1.4,base+h*.09,z+.4],waist,mid,fork],
      [girth*1.46,girth*1.06,girth*.76,girth*.65,girth*.51],.65)
    // Buttresses follow the valley floor, with a carved central fluting down the bole.
    for(let i=0;i<12;i++) {
      const a=TAU*i/12+rng()*.21, r=girth*(1.36+rng()*.72)
      const dx=sin(a), ds=cos(a), endS=s+ds*r,bendS=s+ds*r*.63
      const keepOffShoulder=(xx,ss)=>roadAt(ss).x+side*Math.max(7.0,(xx-roadAt(ss).x)*side)
      const endX=keepOffShoulder(x+dx*r,endS),bendX=keepOffShoulder(x+dx*r*.63,bendS)
      const join=girth*(1.8+rng()*.53)
      const t=Math.min(.96,join/(h*.30))
      const start=[THREE.MathUtils.lerp(root[0],waist[0],t)+dx*girth*.14,
        base+join,THREE.MathUtils.lerp(root[2],waist[2],t)-ds*girth*.14]
      const bend=[bendX,floor(bendX,bendS)-girth*.12,-bendS]
      limb([start,[x+dx*girth*.86,base+girth*.70,z-ds*girth*.86],bend,[endX,floor(endX,endS)-girth*.73,-endS]],
        [girth*.17,girth*.36,girth*.18,.12],.95,side)
      if(i%2===0){
        crown([bendX,floor(bendX,bendS)+.65,-bendS],2.3+rng()*1.2,1.4+rng()*.8,2.4)
      }
    }
    // The two road-facing boughs form a vault above the rider, with irregular splits and tips.
    const oldGrowth=scaleX>1.7
    const crossing=[road.x+side*(oldGrowth?reach*.75:11),road.y+canopyHeight*.51,z+twist-1]
    const span=[road.x+side*(oldGrowth?reach*.57:2),road.y+canopyHeight*.64,z-5]
    const far=[road.x+side*(oldGrowth?reach*.34:-7.6),road.y+canopyHeight*.75,z-8.2]
    limb([mid,[x-side*reach*.32,road.y+canopyHeight*.35,z+twist*.5],crossing,span,far],
      [girth*.62,girth*.51,girth*.33,girth*.19,.55],.45)
    crown(far,9.8,5.1,8)
    for(let j=1;j<=3;j++){
      const t=j/4
      crown([span[0]*(1-t)+far[0]*t,span[1]*(1-t)+far[1]*t+1.9,span[2]*(1-t)+far[2]*t],6.4,3.6,5.9)
    }
    for(let k=0;k<6;k++) {
      const a=k*TAU/6+rng()*.5
      const d=13+rng()*7
      const elbow=[fork[0]+sin(a)*d*.49,base+h*(.81+rng()*.036),fork[2]+cos(a)*d*.50]
      const end=[fork[0]+sin(a+.10)*d,base+h*(.92+rng()*.07),fork[2]+cos(a+.10)*d]
      const t0=.40+(k%3)*.24
      const split=mid.map((v,i)=>THREE.MathUtils.lerp(v,fork[i],t0))
      limb([split,[elbow[0]+cos(a)*2.1,elbow[1]-1.6,elbow[2]-sin(a)*2.1],elbow,end],[girth*.32,girth*.235,girth*.18,.36],.32)
      const c=end.map((v,i)=>THREE.MathUtils.lerp(v,elbow[i],.34))
      crown(c,8.2+rng()*2.5,4.1+rng()*1.9,7.5+rng()*2.5)
      crown([elbow[0]+sin(a)*2,elbow[1]+1.6,elbow[2]+cos(a)*2],6.6,3.8,5.8)
      for(let twig=0;twig<3;twig++){
        const t=a+(twig-1)*.77
        const tip=[end[0]+sin(t)*(4+rng()*6),end[1]+3+rng()*5,end[2]+cos(t)*(4+rng()*6)]
        limb([end,[(end[0]+tip[0])*.5,(end[1]+tip[1])*.5-1,(end[2]+tip[2])*.5],tip],
          [1.05,.66,.15],.15)
        crown(tip,7.4+rng()*4.4,4.4+rng()*2.8,7.4+rng()*3.6)
      }
    }
    for(let j=0;j<4;j++){
      const k=j/3, tip=[THREE.MathUtils.lerp(crossing[0],far[0],k),crossing[1]+4+k*6,crossing[2]-5+k*3]
      crown(tip,6.5+rng()*3.5,3.7+rng()*2.6,5+rng()*4)
    }
    // Small leafy colonies along the bark interrupt the otherwise smooth giant silhouette.
    for(let j=0;j<8;j++){
      const t=j/8, a=j*2.412, r=girth*(.69-.19*t)
      const pos=[THREE.MathUtils.lerp(waist[0],fork[0],t)+sin(a)*r,
        THREE.MathUtils.lerp(waist[1],fork[1],t),THREE.MathUtils.lerp(waist[2],fork[2],t)+cos(a)*r]
      crown(pos,1.7+rng()*1.7,2.3+rng()*2.8,1.6+rng()*1.3)
    }
    shade.ellipse(road.x+(x-road.x-girth*.5)*scaleX,s-girth*.3*scaleZ,
      girth*2.7*scaleX,girth*2.1*scaleZ,.83)
    // Sun comes from the front right. The broad crowns break up into pools of shade and light.
    const castX=side>0?road.x-3:road.x-reach*.9
    for(let i=0;i<14;i++) {
      shade.ellipse(castX+(rng()-.5)*19*scaleX,s+(-6+(rng()-.5)*22)*scaleZ,
        (3+rng()*6)*scaleX,(3+rng()*5)*scaleZ,.43+rng()*.29,-.46)
    }
  }
  // Close boughs frame the ridge. Beyond them the valley opens out under much older,
  // wider trees. Their roots are comparable in size to whole blocks of the village.
  const groves=[
    // distance, radial scale, height scale, depth scale, root offset, crown clearance
    [32,.70,.78,.9,20,21], [78,1.04,1.12,1.12,23,23],
    [151,2.76,3.04,1.94,26,27], [222,3.45,3.32,2.34,27,29],
    [298,3.08,2.8,2.06,25,27], [366,2.78,2.68,1.99,26,26],
    [754,.88,.9,.95,23,22], [826,1.46,1.6,1.4,25,26],
    [916,3.0,3.0,2.1,27,27], [1000,2.08,2.32,1.7,26,26],
  ]
  // Above the open valley, the nearest veteran oaks stand on alternating ridges.
  // The painted forest continues the avenue beyond the visible valley floor.
  for(const [i,[s,sx,sy,sz,offset,height]] of groves.entries()){
    const valleyOffset=offset+(sx>1.7?23:0)
    if(sx<1.7 || i%2===0) oak(-1,s-5*sz,valleyOffset+rng()*2,height+rng()*3,sx,sy,sz)
    if(sx<1.7 || i%2!==0) oak(1,s+(6+rng()*4)*sz,valleyOffset+1+rng()*2,height-2+rng()*3,sx,sy,sz)
  }
  return wood.finish()
}

function lawnBlades() {
  const rng=random(752),p=[],c=[],i=[]
  for(let j=0;j<10;j++){
    const a=rng()*TAU,x=sin(a)*rng()*.37,z=cos(a)*rng()*.37
    const h=.20+rng()*.59,w=.024+rng()*.047,lean=.12+rng()*.18
    const dx=cos(a)*w,dz=sin(a)*w, ox=sin(a)*lean,oz=cos(a)*lean,f=p.length/3
    p.push(x-dx,0,z-dz,x+dx,0,z+dz,x+ox*.43+dx*.56,h*.63,z+oz*.43+dz*.56,
      x+ox*.43-dx*.56,h*.63,z+oz*.43-dz*.56,x+ox,h,z+oz)
    for(let k=0;k<5;k++) c.push(...(k<2?[.15,.23,.052]:k<4?[.45,.68,.20]:[.82,.91,.36]))
    i.push(f,f+1,f+3,f+1,f+2,f+3,f+2,f+4,f+3)
  }
  return geometry(p,i,c)
}

function archSpan() {
  const sh=new THREE.Shape()
  sh.moveTo(-9,0);sh.lineTo(9,0);sh.lineTo(9,-65);sh.lineTo(7.6,-65);sh.lineTo(7.6,-10.5)
  sh.absarc(0,-10.5,7.6,0,Math.PI,false);sh.lineTo(-7.6,-65);sh.lineTo(-9,-65);sh.closePath()
  return new THREE.ExtrudeGeometry(sh,{depth:3.8,bevelEnabled:false,curveSegments:14}).translate(0,0,-1.9)
}

function makeLandmarks(scene,leaves,shade) {
  const rng=random(590), rngSeed=()=>Math.floor(rng()*987654)
  const trunkGeo=new THREE.CylinderGeometry(.6,1,1,7)
  const blocks={
    grass:[lawnBlades(),new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})],
    tree:[trunkGeo,new THREE.MeshLambertMaterial({map:terrainMap('bark')})],
    stone:[new THREE.DodecahedronGeometry(1),new THREE.MeshLambertMaterial({map:terrainMap('rock')})],
    box:[new THREE.BoxGeometry(),new THREE.MeshLambertMaterial()],
    arch:[archSpan(),new THREE.MeshLambertMaterial({map:terrainMap('rock')})],
  }
  const batches=new Map(), matrix=new THREE.Object3D(), groups=[]
  function add(key,x,y,z,w,h,d,color,angle=0,lean=0) {
    const area=Math.floor(-z/100),id=key+':'+area
    if(!batches.has(id))batches.set(id,{key,area,list:[]})
    matrix.position.set(x,y,z);matrix.rotation.set(0,angle,lean,'YXZ');matrix.scale.set(w,h,d);matrix.updateMatrix()
    batches.get(id).list.push([matrix.matrix.clone(),new THREE.Color(color)])
  }
  function littleTree(x,s,h,slim) {
    const y=groundAt(x,s),z=-s, r=h*(slim?.24:.39)
    add('tree',x,y+h*.32,z,h*.047,h*.65,h*.05,'#b8ad8a',rng()*TAU)
    leaves.crown(x,y+h*.72,z,r,h*.33,r*.97,rngSeed())
    if(h>6) leaves.crown(x+r*.55,y+h*.63,z+r*.32,r*.72,h*.24,r*.72,rngSeed())
    shade.ellipse(x-h*.37,s-h*.36,r*1.3,r*1.2,.74,-.72)
  }
  // Hedges define rectangular plots and orchards, giving the valley a readable scale.
  for(let s=-42;s<LAST;s+=28+rng()*19) {
    for(const side of [-1,1]) {
      const dx=42+rng()*113
      const base=roadAt(s).x+side*dx
      for(let j=0;j<5+rng()*7;j++) {
        const along=s+j*(2.7+rng()*.6), x=base+rng()*1.6
        littleTree(x,along,3.2+rng()*3.3,true)
      }
    }
  }
  for(let k=0;k<430;k++){
    const s=FIRST+rng()*(LAST-FIRST),side=rng()<.5?-1:1
    const d=18+rng()*160
    if(s>354 && s<677 && d<35 || s>1030 && d<35) continue
    littleTree(roadAt(s).x+side*d,s,3.5+rng()*6.0,false)
  }
  // Dense woods occupy alternating valley flanks. Conifers give the ridges a serrated skyline.
  for(let along=-35;along<LAST+32;along+=52) {
    for(const side of [-1,1]){
      const centre=roadAt(along).x+side*(78+rng()*97)
      for(let j=0;j<75;j++){
        const a=rng()*TAU, t=Math.sqrt(rng()), x=centre+cos(a)*t*(27+rng()*20), s=along+sin(a)*t*(21+rng()*23)
        const y=groundAt(x,s), h=4+rng()*9
        if(j%3) leaves.conifer(x,y-.1,-s,h*.31,h,h*.28,rngSeed())
        else leaves.crown(x,y+h*.51,-s,h*.5,h*.47,h*.45,rngSeed())
      }
      const back=roadAt(along).x+side*(175+rng()*14)
      for(let j=0;j<52;j++){
        const s=along+rng()*58, x=back+side*rng()*61,y=groundAt(x,s),h=6.5+rng()*9
        leaves.conifer(x,y-.65,-s,h*.34,h,h*.32,rngSeed())
      }
    }
  }
  // These groves rise from the banks in front of the distant forest, tying its
  // painted foothills to the roofs and live geometry in the valley.
  for(const [from,to] of [[83,343],[737,1028]]){
    for(let s=from; s<to; s+=8.5){
      for(const side of [-1,1]){
        const belt=16+19*(.5+.5*sin(s*.037+side))
        for(let j=0;j<8;j++){
          const along=s+rng()*8, x=roadAt(along).x+side*(belt+rng()*16)
          const h=2.2+rng()*(j%4===0?9:4),y=groundAt(x,along)
          if(j%3===0)leaves.conifer(x,y-.2,-along,h*.32,h,h*.30,rngSeed())
          else leaves.crown(x,y+h*.44,-along,h*.57,h*.43,h*.56,rngSeed())
          shade.ellipse(x-h*.35,along-h*.24,h*.49,h*.51,.60,-.7)
        }
      }
    }
  }
  // A grass fringe replaces rails on the high causeway so the drop stays visible.
  for(let i=0;i<6400;i++){
    const s=FIRST+rng()*(LAST-FIRST),side=rng()<.5?-1:1, x=roadAt(s).x+side*(3.96*alpineLaneScale(s)+.65+rng()**1.9*6)
    if(s>=397 && s<=661 || s>=1050 && s<=1210) continue
    const h=.30+rng()*.72
    const room=2*(abs(x-roadAt(s).x)-3.96*alpineLaneScale(s)-.13)
    if(i%2===0) leaves.tuft(x,groundAt(x,s)-.05,-s,Math.min(room,.9+rng()*1.65),.33+rng()*.52,rngSeed())
    add('grass',x,groundAt(x,s)-.04,-s,.65+rng()*.8,h,.66+rng()*.8,'#dee5b7',rng()*TAU)
    if(i%29===0){
      const d=.22+rng()*.71
      add('stone',x,groundAt(x,s)+d*.13,-s,d,d*.44,d*.74,'#c1c4a4',rng()*TAU,rng()*.4)
    }
  }
  for(let s=350;s<1080;s+=18){
    if(s>700 && s<1000) continue
    const side=s%36===8?-1:1, x=roadAt(s).x+side*4.8, y=groundAt(x,s)
    add('box',x,y+.51,-s,.13,1.02,.14,'#eee7ce')
    add('box',x,y+.76,-s,.137,.18,.145,'#434343')
  }
  function aqueduct(originX,s,angle,height,count) {
    const deck=roadAt(s).y+height,ca=cos(angle),sa=sin(angle)
    for(let j=0;j<count;j++){
      const at=(u,v,z)=>[originX+(j*18+u)*ca+z*sa,deck+v,-s-(j*18+u)*sa+z*ca]
      add('arch',...at(0,0,0),1,1,1,'#d6c49d',angle)
      for(const [y,w,h,tone] of [[.29,4.26,.54,'#e7d9aa'],[-.55,4.12,.35,'#aa9778'],[.79,3.8,.42,'#b1b393']]){
        add('box',...at(0,y,0),18,h,w,tone,angle)
      }
      for(let k=0;k<17;k++){
        const a=(k+.5)*Math.PI/17
        add('box',...at(cos(a)*7.96,-10.5+sin(a)*7.96,1.97),.67,1.43,.22,
          k%3===0?'#d9cbaa':'#e8d9b8',angle,a)
      }
      for(const y of [-12,-20,-28,-36,-44])add('box',...at(9,y,0),3.0,.30,4.15,'#d5c09c',angle)
    }
  }
  // An oblique viaduct runs along the side valley behind the steeples, without closing the vanishing point.
  aqueduct(roadAt(115).x-94,108,1.61,5.2,13)
  aqueduct(roadAt(450).x-66,390,1.48,16,15)
  aqueduct(roadAt(935).x+67,812,1.72,15,15)
  for(const {key,area,list} of batches.values()) {
    const mesh=new THREE.InstancedMesh(...blocks[key],list.length)
    list.forEach(([m,c],j)=>{mesh.setMatrixAt(j,m);mesh.setColorAt(j,c)})
    mesh.computeBoundingSphere();scene.add(mesh)
    const reach=key==='grass'?85:key==='stone'?100:390
    groups.push({mesh,start:area*100-reach,end:(area+1)*100+48})
  }
  let prev=-100
  return s=>{
    const q=Math.floor(s/8)
    if(q===prev) return
    prev=q
    for(const g of groups)g.mesh.visible = s>=g.start && s<=g.end
  }
}

// Photographed Alpine ridges sit behind the local farmland. The alpha channel follows
// the actual skyline so both the day and sunset panoramas remain visible above it.
function distantAlps(scene){
  const image=new THREE.TextureLoader().load(new URL('./art/alpine-ridgeline.webp',import.meta.url).href)
  image.colorSpace=THREE.SRGBColorSpace
  const mat=new THREE.MeshBasicMaterial({map:image,alphaTest:.3,side:THREE.DoubleSide,
    fog:false,depthWrite:false,depthTest:false,toneMapped:false})
  // The far bank loses contrast at its base, matching the atmospheric perspective of the last local fields.
  const haze={value:new THREE.Color('#bfd7e1')}
  mat.onBeforeCompile=shader=>{
    shader.uniforms.ridgeHaze=haze
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 ridgeHaze;')
      .replace('#include <opaque_fragment>',`outgoingLight=mix(ridgeHaze,outgoingLight,.18+.36*smoothstep(.52,1.,vMapUv.y));
      #include <opaque_fragment>`)
  }
  const layer=new THREE.Mesh(new THREE.CylinderGeometry(165,165,72,120,1,true),mat)
  layer.renderOrder=-10
  scene.add(layer)
  // Geometry covers y -47..25 at the rider so only the distant massifs break the horizon.
  layer.rotation.y=2.66
  return {
    update(s){const r=roadAt(s);layer.position.set(r.x,r.y-14,-s)},
    setTheme(mode){
      const dusk=mode==='dusk'
      mat.color.set(dusk?'#d8a898':'#e1ecfb')
      haze.value.set(dusk?'#c69991':'#bfd7e1')
    },
  }
}

// The high forest extends into a painted aerial perspective. Keep the luminous
// opening aligned with the distant road, while the playable trees, rider and gates
// retain their own depth and parallax in front of the painting.
function elderwoodVista(scene) {
  const image=new THREE.TextureLoader().load(new URL('./art/elderwood-vista.webp',import.meta.url).href)
  image.colorSpace=THREE.SRGBColorSpace
  const width=260,height=width*793/1983,depth=119
  const mat=new THREE.ShaderMaterial({
    uniforms:{viewMap:{value:image},amount:{value:0}},
    transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec2 st;
      void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 st;uniform sampler2D viewMap;uniform float amount;
      void main(){
        vec3 col=texture2D(viewMap,st).rgb;
        // Preserve the golden leaf rims while cooling the succession of shadowed arches.
        float lum=dot(col,vec3(.2126,.7152,.0722));
        float under=(1.-smoothstep(.10,.46,lum))*smoothstep(.12,.40,st.y);
        col=mix(col,col*vec3(.54,.66,1.10)+vec3(.002,.004,.014),under*.78);
        float sides=smoothstep(0.,.13,min(st.x,1.-st.x));
        float lower=smoothstep(.035,.22,st.y);
        float top=1.-smoothstep(.87,1.,st.y);
        float lane=exp(-pow((st.x-.5)*28.,2.))*(1.-smoothstep(.18,.26,st.y));
        gl_FragColor=vec4(col,amount*sides*lower*top*(1.-.91*lane));
        #include <colorspace_fragment>
      }`,
  })
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat)
  panel.renderOrder=0
  scene.add(panel)
  let day=true,current=0
  function update(s){
    current=s
    const first=1-smooth(240,343,s)
    const second=smooth(670,741,s)*(1-smooth(947,1032,s))
    const road=roadAt(s+depth)
    const approach=1+.17*(s<600?smooth(55,306,s):smooth(735,960,s))
    panel.scale.set(approach,approach,1)
    panel.position.set(road.x,road.y+height*.27*approach+1,-s-depth)
    mat.uniforms.amount.value=day?Math.max(first,second):0
    panel.visible=mat.uniforms.amount.value>.001
  }
  return {update,setTheme(mode){day=mode!=='dusk';update(current)}}
}

// In the deepest arches, direct sunlight catches the upper sprays while the
// undersides receive mostly blue skylight. Distance compresses them into a silhouette.
function shadeForest(group) {
  const day = {value:1}, seen = new Set()
  group.traverse(object=>{
    const material=object.material
    if(!material || seen.has(material)) return
    seen.add(material)
    const leaves=object.name==='Foliage · crown'
    const prepare=material.onBeforeCompile.bind(material)
    material.onBeforeCompile=shader=>{
      prepare(shader)
      shader.uniforms.forestDay=day
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float forestDay;')
        .replace('#include <opaque_fragment>',`
          ${leaves ? `float rim=smoothstep(.42,.91,vMapUv.y);
          outgoingLight*=mix(vec3(1.),mix(vec3(.22,.34,.61),vec3(1.25,1.21,.89),rim),forestDay);` : ''}
          #include <opaque_fragment>`)
        .replace('#include <fog_fragment>',`#include <fog_fragment>
        #ifdef USE_FOG
          float air=smoothstep(30.,155.,vFogDepth)*forestDay;
          float distant=smoothstep(210.,387.,vFogDepth);
          vec3 skyline=mix(vec3(.070,.18,.41),vec3(.30,.54,.93),distant);
          gl_FragColor.rgb=mix(gl_FragColor.rgb,skyline,air*.81);
        #endif`)
    }
    material.customProgramCacheKey=()=>leaves?'alpine-crown-light':'alpine-wood-light'
  })
  return mode=>{day.value=mode==='dusk'?0:1}
}

export function createWorld(scene) {
  const sky=mountSky(scene,'alpine'), hills=distantAlps(scene)
  const hemi=new THREE.HemisphereLight('#c3d6fc','#9aa847',1.1)
  const sun=new THREE.DirectionalLight('#fff0bc',3.9)
  sun.position.set(45,57,-50)
  scene.add(hemi,sun)
  scene.fog=new THREE.Fog('#b9d6e7',138,376)
  const shade=groundShadows(),leaves=createFoliageBatch(scene)
  makeTerrain(scene,shade)
  makeRoad(scene,shade)
  const grove=new THREE.Group()
  scene.add(grove)
  const crowns=createFoliageBatch(grove)
  const updateWood=makeOakAvenue(grove,crowns,shade)
  crowns.flush()
  const forestTheme=shadeForest(grove)
  const vista=elderwoodVista(scene)
  const updateObjects=makeLandmarks(scene,leaves,shade)
  leaves.flush()
  const village=buildVillage(scene,roadAt,groundAt,shade)
  return {
    length:LENGTH,
    update(s){hills.update(s);updateWood(s);crowns.update(s);vista.update(s);updateObjects(s);leaves.update(s);village.update(s)},
    setTheme(mode){
      const dusk=mode==='dusk'
      sky.setTheme(mode);hills.setTheme(mode);village.setTheme(mode);forestTheme(mode);vista.setTheme(mode)
      hemi.color.set(dusk?'#c4addf':'#c3d6fc')
      hemi.groundColor.set(dusk?'#977046':'#9aa847')
      hemi.intensity=dusk?.89:1.1
      sun.color.set(dusk?'#ff9650':'#fff0bc')
      sun.position.set(45,dusk?26:57,-50)
      sun.intensity=dusk?3.25:3.9
      scene.fog.color.set(dusk?'#d59c87':'#b9d6e7')
    },
  }
}
