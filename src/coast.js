import * as THREE from 'three'
import { terrainMap, createFoliageBatch } from './nature.js'
import { mountSky } from './sky.js'
import { addMarineSky, coastSunDirection, marineLight, mistOnHorizon } from './coast-sky.js'
import { addPortStreet, onPortStreet } from './coast-village.js'
import { makeHarbour, reflectedShore } from './coast-shore.js'

const COURSE = 1200
const WATER = -19
const { sin, cos, abs, max, min, exp, pow, floor } = Math
const smooth = THREE.MathUtils.smoothstep

function hash(x,y) {
  const a = sin(x * 127.1 + y * 311.7) * 43758.5453
  return a - floor(a)
}

function grain(x,y) {
  const i=floor(x), j=floor(y), u=smooth(x-i,0,1), v=smooth(y-j,0,1)
  return (1-v)*(hash(i,j)*(1-u)+hash(i+1,j)*u) + v*(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)
}

function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0
    return seed/4294967296
  }
}

export function coastAt(s) {
  // A gentler turn around the first headland keeps the bay in view beyond the first gate.
  const turn=(s-155)/44
  return {
    x: 52*sin((s+18)/56)+13*sin((s+5)/31)+20*sin(s/140)+.84*(s-155)*exp(-turn*turn),
    y: 100-0.055*s + 13*cos((s+24)/57) + 7*cos((s+25)/107) - 3*sin(s/44) - 9*smooth(s,16,82) - 8*smooth(s,701,763) + 8*smooth(s,809,918) - 295*smooth(s,1250,1480),
  }
}

function rim(s) { return 9.4 + 1.5 * sin(s/24) + 0.8 * sin(s/8) }
function beach(s) { return 58 + 12*sin(s/47) + 6*sin(s/16) + 1.5*sin(s/4.5) }

// The full four metres either side of centre are rideable. Only the worn tread is bare earth.
function naturalHill(s,d) {
  const {y} = coastAt(s)
  const hd = abs(d)
  const turbulence = 2*grain(s*.105,d*.103)-1
  if (hd <= 4.4) return y + smooth(hd,1.35,4.4)*(.095*turbulence-.022)
  if (d < 0) {
    const rise = hd-4.4
    const high=1-exp(-rise/112)
    return y + 112*high*(.49+.15*sin(s/71)+.10*cos(d/45+s/41)) +
      max(0,rise-90)*.13 + high*37*(grain(s*.008,d*.012)-.5) +
      smooth(rise,0,7)*(1.2*turbulence+4.6*(grain(s*.03,d*.04)-.5))
  }
  const e = rim(s), b = beach(s)
  const capY = y-(e-4.4)*1.16
  if (d < e) return y-(d-4.4)*1.16 + smooth(d,4.4,e)*.65*turbulence
  const t = min(1,(d-e)/(b-e))
  return capY+(WATER-1.8-capY)*pow(t,.77) +
    .65*turbulence*(1-t) + sin(Math.PI*t)*(4.5*turbulence+1.5*sin(s*.47+d*.63))
}

function hill(s,d) {
  const terrain=naturalHill(s,d)
  if (!onPortStreet(s,d)) return terrain
  const terrace=smooth(s,692,701)*(1-smooth(s,795,803))*(1-smooth(abs(d),9,17))
  return THREE.MathUtils.lerp(terrain,coastAt(s).y-.20,terrace)
}

function farCoast(s) {
  return 427 + 84*sin(s/167+.65) + 30*sin(s/66) + 9.1*sin(s/17)
}

function makeGridMesh(parent, rows, columns, point, material) {
  const v=[], c=[], uv=[], edges=[], indices=[]
  for (let i=0;i<rows.length;i++) {
    for (let j=0;j<columns.length;j++) {
      const [x,y,z,r,g,b,tx,ty,edge=0] = point(rows[i], columns[j])
      v.push(x,y,z); c.push(r,g,b); uv.push(tx,ty); edges.push(edge)
      if (i && j) {
        const k=i*columns.length+j
        indices.push(k-columns.length-1,k-columns.length,k, k-columns.length-1,k,k-1)
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3))
  geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3))
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
  geo.setAttribute('trailEdge',new THREE.Float32BufferAttribute(edges,1))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo,material)
  parent.add(mesh)
  return mesh
}

const line = (a,b,step) => Array.from({length:1+Math.ceil((b-a)/step)},(_,i)=>min(b,a+i*step))
const linear = color => new THREE.Color(color)

function makeGround(root) {
  const sections=[]
  function grid(parent,rows,columns,point,material) {
    const step=rows[1]-rows[0], count=Math.ceil(240/step)
    for (let start=0;start<rows.length-1;start+=count) {
      const strip=rows.slice(start,start+count+1)
      const mesh=makeGridMesh(parent,strip,columns,point,material)
      mesh.geometry.computeBoundingSphere()
      const sparse=[]
      const w=columns.length, last=strip.length-1
      for(let a=0;a<last;a+=3) {
        const b=min(a+3,last)
        for(let j=1;j<w;j++) {
          sparse.push(a*w+j-1,a*w+j,b*w+j,a*w+j-1,b*w+j,b*w+j-1)
        }
      }
      // Both levels share the end rings, UVs, colours and normals; no cracks between blocks.
      const far=new THREE.Uint16BufferAttribute(sparse,1)
      sections.push({mesh,detail:mesh.geometry.index,far,from:strip[0],to:strip[last]})
    }
  }
  const grass = terrainMap('grass'), dirt = terrainMap('dirt'), stone = terrainMap('rock')
  const turf = new THREE.MeshStandardMaterial({map:grass,vertexColors:true,roughness:1})
  const limestone = new THREE.MeshStandardMaterial({map:stone,vertexColors:true,roughness:.95,side:THREE.DoubleSide})
  const trail = new THREE.MeshStandardMaterial({map:dirt,vertexColors:true,roughness:1})
  // Soften the eroded edges of the track into patches of exposed grass and gravel.
  trail.onBeforeCompile=shader=>{
    shader.uniforms.meadowMap={value:grass}
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float trailEdge; varying float edgeOfTrack;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nedgeOfTrack=trailEdge;')
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D meadowMap; varying float edgeOfTrack;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        vec3 grassPatch=texture2D(meadowMap,vMapUv*.615).rgb;
        float grit=texture2D(map,vMapUv*.67).r;
        float wear=smoothstep(.55,.98,abs(edgeOfTrack) + (grit-.2)*.77);
        diffuseColor.rgb=mix(diffuseColor.rgb,grassPatch*vec3(1.62,1.38,.87),wear);`)
  }
  const grassMix = linear(0xf9f9c0), dryMix=linear(0xfffbaf), rockMix=linear(0xc8c3b4), upland=linear(0x818c74)
  const shade = new THREE.Color()
  const roadRows = line(-105,COURSE+280,2)
  // Index separate strips so the wheel-worn centre has the same height and normals as its verge.
  const pathEdge = (s,side) => side * (1.30+.18*sin(s/12)+.09*sin(s*.79+side)+.10*sin(s/4.2+side))
  function grassyPoint(s,d) {
    const {x}=coastAt(s), y=hill(s,d)
    const meadow = grain(s*.073,d*.11)*.48+grain(s*.014,d*.037)*.52
    const shadow = max(.59,1-.27*smooth(-d,8,25)*smooth(sin(s/27+d*.13),-.12,.8))
    const hummocks=grain(s*.054,d*.084)*.56+grain(s*.032,d*.044)*.44
    shade.copy(grassMix).lerp(dryMix,smooth(meadow,.36,.78)).multiplyScalar((.87+meadow*.45+.48*hummocks)*shadow)
    shade.lerp(upland,smooth(-d,76,237)*(.25+.38*grain(s*.034,d*.06)))
    return [x+d,y,-s,shade.r,shade.g,shade.b,(x+d)*.32,s*.32]
  }
  for (const side of [-1,1]) {
    const distances = side < 0 ? [-685,-570,-490,-420,-365,-311,-268,-224,-193,-164,-140,-120,-101,-84,-70,-58,-47,-39,-32,-25,-18,-13,-10,-8,-6,-4.4,-3,-2.35,null] : [null,2.35,3,4.4,5.4,6.4,7.6,8.6,1e3]
    grid(root,roadRows,distances,(s,d)=>grassyPoint(s,d===null?pathEdge(s,side):d===1e3?rim(s): d>4.4?4.4+(rim(s)-4.4)*(d-4.4)/(9.4-4.4):d),turf)
  }
  grid(root,roadRows,[-1,-.78,-.53,0,.53,.78,1],(s,u)=>{
    const d = abs(u)*pathEdge(s,Math.sign(u)||1), {x,y} = coastAt(s)
    const weather = grain(s*.29,d*.75)
    shade.set(0xfff3d4).multiplyScalar(.76 + .24*weather - .07*smooth(abs(u),.75,1))
    return [x+d,y+.004,-s,shade.r,shade.g,shade.b,(x+d)*.52,s*.52,u]
  },trail)
  grid(root,line(-120,COURSE+300,3),line(0,1,.0625),(s,t)=>{
    const d = rim(s)+(beach(s)-rim(s))*t, y=hill(s,d)
    const stratum = .5+.5*cos(y*.22+s*.049+3.6*grain(s*.046,t*4.5))
    shade.copy(rockMix).lerp(grassMix,.47*(1-smooth(t,.05,.55))).multiplyScalar(.78+.23*stratum+.35*grain(s*.09,t*17))
    return [coastAt(s).x+d,y,-s,shade.r,shade.g,shade.b,s*.081+d*.015+grain(s*.031,t*3)*.6,y*.092+grain(s*.024,t*3.8)*.45]
  },limestone)

  return s=>{
    for(const {mesh,detail,far,from,to} of sections) {
      const index=s<from-200 || s>to+75 ? far : detail
      if(mesh.geometry.index!==index) mesh.geometry.setIndex(index)
    }
  }
}

function canvasMap(w,h,painter) {
  const canvas=document.createElement('canvas')
  canvas.width=w; canvas.height=h
  painter(canvas.getContext('2d'),w,h)
  const map=new THREE.CanvasTexture(canvas)
  map.colorSpace=THREE.SRGBColorSpace
  return map
}

function groupInstances(root) {
  const sections=[]
  function batch(geometry,material,range,chunkSize=150,casts=false) {
    const cells=new Map()
    return {
      place(x,y,z,w,h,d,color,yaw=0) {
        const k=floor(-z/chunkSize)
        if(!cells.has(k)) cells.set(k,[])
        cells.get(k).push([x,y,z,w,h,d,color,yaw])
      },
      flush() {
        const matrix=new THREE.Object3D(), tint=new THREE.Color()
        for(const [k,arr] of cells) {
          const mesh=new THREE.InstancedMesh(geometry,material,arr.length)
          arr.forEach(([x,y,z,w,h,d,c,yaw],i)=>{
            matrix.position.set(x,y,z);matrix.scale.set(w,h,d);matrix.rotation.y=yaw
            matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);mesh.setColorAt(i,tint.set(c))
          })
          mesh.computeBoundingSphere()
          mesh.castShadow=casts
          root.add(mesh)
          // Large landmarks far across the bay can still be in view behind the rider's station.
          // Let Three.js frustum culling operate on all their spatial batches together.
          if (Number.isFinite(range)) sections.push({mesh,from:k*chunkSize,to:(k+1)*chunkSize,range})
        }
        cells.clear()
      },
    }
  }
  return {batch, update(s) {
    for (const {mesh,from,to,range} of sections) mesh.visible=to>s-90 && from<s+range
  }}
}

function vegetation(root, instances) {
  const rnd=randomSequence(961725)
  const foliage=createFoliageBatch(root)
  const granite=new THREE.MeshStandardMaterial({map:terrainMap('rock'),roughness:.95})
  const boulder=new THREE.IcosahedronGeometry(1,1)
  const vertices=boulder.attributes.position
  for(let i=0;i<vertices.count;i++) {
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i)
    const scale=.81+.44*grain(x*3.1+z*.87,y*2.9-z*1.14)
    vertices.setXYZ(i,x*scale,max(-.90,min(.79,y*scale))+.08*x-.09*z,z*scale)
  }
  boulder.computeVertexNormals()
  const stones=instances.batch(boulder,granite,180,80,true)
  function tree(s,d,h) {
    const x=coastAt(s).x+d,y=hill(s,d),width=h*(.24+.065*rnd())
    const seed=floor(rnd()*61324)
    if (!onPortStreet(s,d)) foliage.conifer(x,y-.24,-s,width,h,width*.94,seed)
  }
  for(let i=0;i<355;i++) {
    const s=rnd()*(COURSE+290)-90
    const d=rnd()<.58 ? -13-rnd()*65 : rim(s)+4+rnd()*31
    tree(s,d,(d<0?4.2:3.7)+rnd()*7.3)
  }
  // The first bend is framed by downhill firs, with an open view over their tops.
  tree(21,-8.9,7.0)
  tree(41,rim(41)+2.3,6.2)
  tree(76,rim(76)+5.4,7.5)
  for(let i=0;i<380;i++){
    const s=rnd()*(COURSE+215)-80
    const d = (i%4===0 ? 1 : -1)*(5.3+rnd()*(i%4===0 ? 7 : 19))
    const x=coastAt(s).x+d,y=hill(s,d),w=.47+rnd()*.96
    if (!onPortStreet(s,d)) foliage.crown(x,y+w*.30,-s,w,.52*w,.82*w,10001+i)
  }
  for(let i=0;i<12500;i++) {
    const s=rnd()*(COURSE+145)-50, side=rnd()<.55?-1:1
    const d=side*(1.8+pow(rnd(),1.5)*(side>0?12:16))
    const x=coastAt(s).x+d,y=hill(s,d)
    const size=.42+rnd()*.95
    const width=size*(.9+rnd()*.68), height=size*(.39+.36*rnd())
    if (!onPortStreet(s,d)) foliage.tuft(x,y-.048,-s,width,height,1370+i)
  }
  for(let i=0;i<1900;i++) {
    const s=rnd()*(COURSE+165)-55,side=rnd()<.5?-1:1
    const d=side*(4.8+pow(rnd(),1.12)*22),x=coastAt(s).x+d,y=hill(s,d)
    const size=.10+pow(rnd(),3)*1.75
    const width=size*(1.1+rnd()), height=size*(.3+.28*rnd()), depth=size*(.8+rnd()*.6)
    const color=[0x96968e,0x979582,0x828078,0xb5aa95][floor(rnd()*4)], yaw=rnd()*Math.PI
    if (!onPortStreet(s,d)) stones.place(x,y-.04-size*.18,-s,width,height,depth,color,yaw)
  }
  stones.flush();foliage.flush()
  for(const child of root.children) {
    if(child.name==='Foliage · spruce' || child.name==='Foliage · crown') child.castShadow=true
  }
  return foliage
}

function breakers(instances) {
  const random=randomSequence(1189)
  const image=canvasMap(256,192,(ctx,w,h)=>{
    // Thousands of overlapping droplets give the wave a lit crest and a fine, fading wake.
    for(let i=0;i<7400;i++) {
      const a=random(), b=random(), edge=sin(a*Math.PI)
      const plume=(.44*exp(-pow((a-.39)/.18,2))+.29*exp(-pow((a-.72)/.17,2))+.17*edge)
      const height=plume*(.25+.72*b)+.025*random()*edge
      const x=w*(.06+.89*a+.041*b*b), y=h*(1.02-height)
      const r=(1.7+4*random())*(1.22-b*.72)
      const g=ctx.createRadialGradient(x,y,0,x,y,r)
      g.addColorStop(0,'rgba(248,253,255,'+(.12+.26*edge)+')')
      g.addColorStop(1,'rgba(216,235,247,0)')
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)
    }
  })
  const clock={value:0}
  const sprayMat=new THREE.MeshBasicMaterial({map:image,transparent:true,depthWrite:false,side:THREE.DoubleSide})
  sprayMat.onBeforeCompile=shader=>{
    shader.uniforms.breakerClock=clock
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float breakerClock;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float wave = .5 + .5*sin(breakerClock*1.39 + instanceMatrix[3].z*.43);
        transformed.y *= .20 + .80*pow(wave,1.7);
        transformed.x += .09*transformed.y*wave;`)
  }
  const curtain=instances.batch(new THREE.PlaneGeometry(1,1).translate(0,.50,0),sprayMat,1050,280)
  const stacks=instances.batch(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({
    map:terrainMap('rock'),roughness:.83,
  }),1000,280)
  for(let s=-115;s<COURSE+770;s+=62+random()*53){
    const local=random()<.53
    const x=local?coastAt(s).x+beach(s)+3+random()*12:farCoast(s)-4-random()*9
    const spread=5+random()*7
    for(let i=0;i<3;i++){
      const width=spread*(.51+random()*.64)
      stacks.place(x+i*spread*.58,WATER-.52,-s+i*1.4,width,1.2+width*.16,width*.65,0x737877,random())
    }
    curtain.place(x,WATER-.45,-s,spread*2.9,spread*(1.35+random()*.6),1,0xf7fcff,-.40-random()*.4)
  }
  stacks.flush();curtain.flush()
  return t=>{clock.value=t}
}

function makeWater(root,sky,harbour) {
  const time={value:0}
  const mat=new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{}]), fog:true,
    vertexShader:`
      varying vec3 seaPoint;
      #include <fog_pars_vertex>
      void main(){
        seaPoint=(modelMatrix*vec4(position,1.)).xyz;
        vec4 mvPosition=viewMatrix*vec4(seaPoint,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      varying vec3 seaPoint;
      uniform float tide;
      ${marineLight}
      ${reflectedShore}
      #include <fog_pars_fragment>
      float hash21(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
      float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1)),f.x),f.y);}
      void main(){
        vec2 p=seaPoint.xz;float s=-p.y;
        float farX=bayEdge(s);
        float woodsX=52.*sin((s+18.)/56.)+13.*sin((s+5.)/31.)+20.*sin(s/140.);
        float headland=(s-155.)/44.;
        woodsX+=.84*(s-155.)*exp(-headland*headland);
        float tongue=58.+12.*sin(s/47.)+6.*sin(s/16.)+1.5*sin(s/4.5);
        float depth=min(p.x-(woodsX+tongue)+.7,farX-p.x);
        float sea=clamp(depth/40.,0.,1.);
        vec2 waves=p*vec2(.16,.18);
        float m=noise2(waves*.20+tide*.016);
        float n=noise2(waves*1.2-tide*.04);
        float ripple=noise2(waves*5.7 + vec2(.04,-.13)*tide);
        float swell=sin(dot(waves,vec2(.68,.82))+tide*.63+5.*m);
        float chop=sin(dot(waves,vec2(2.91,-1.93))-tide*1.24+4.*n);
        vec3 norm=normalize(vec3(.060*swell+.074*(ripple-.5)+.035*chop,1.,.055*chop+.048*(n-.5)));
        vec3 view=normalize(cameraPosition-seaPoint);
        vec3 refl=reflect(-view,norm);
        vec3 clouds=marineLight(vec3(refl.x,abs(refl.y),refl.z));
        vec4 cliff=cliffReflection(seaPoint,refl);
        clouds=mix(clouds,cliff.rgb,cliff.a*.85);
        vec3 deep=mix(vec3(.002,.015,.102),vec3(.002,.037,.173),m);
        vec3 water=mix(vec3(.006,.156,.23),deep,sea);
        float fresnel=.13+.43*pow(1.-max(0.,view.y),3.);
        water+=fresnel*clouds*vec3(.57,.67,.98);
        vec3 halfDir=normalize(view+coastSun);
        float shine=pow(max(dot(norm,halfDir),0.),209.);
        water+=vec3(.81,.86,.92)*shine;
        float ridges=smoothstep(.54,.84,ripple)*smoothstep(.55,.96,n);
        water+=vec3(.013,.034,.053)*ridges;
        float tex=noise2(p*vec2(.25,.41)+tide*.18);
        float front=depth+3.9*swell+tex*4.2;
        float shoal=(1.-smoothstep(.3,8.8,front))*(.30+.69*tex);
        float breaker=(1.-smoothstep(.25,1.75,abs(front-4.3-1.8*sin(tide*1.14+s*.21))))*(.6+.4*n);
        float backwash=(1.-smoothstep(.1,1.66,abs(front-8.8-3.*sin(tide*.58+s*.17))))*(.4+.65*tex);
        float froth=clamp(shoal+.77*breaker+.34*backwash,0.,1.);
        water=mix(water,vec3(.80,.92,.89),froth);
        gl_FragColor=vec4(water,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
        if(vFogDepth>860.) {
          vec3 horizon=sRGBTransferOETF(vec4(marineLight(normalize(seaPoint-cameraPosition)),1.)).rgb;
          gl_FragColor.rgb=mix(gl_FragColor.rgb,horizon,smoothstep(860.,1230.,vFogDepth));
        }
      }`,
  })
  mat.uniforms.tide=time
  Object.assign(mat.uniforms,sky.uniforms,{shoreReady:harbour.uniforms.shoreReady,shorePlate:harbour.uniforms.shorePlate})
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(3500,4500),mat)
  sea.rotation.x=-Math.PI/2
  sea.position.set(300,WATER,-900)
  root.add(sea)
  return t=>{time.value=t}
}

export function createCoast(scene) {
  const root=new THREE.Group()
  root.name='Cliffs of the western sea'
  scene.add(root)
  scene.background=new THREE.Color(0x99cce6)
  scene.fog=new THREE.Fog(0x9aaac7,245,1230)
  const sun=new THREE.DirectionalLight(0xffe8ae,3.8)
  sun.position.copy(coastSunDirection).multiplyScalar(150)
  root.add(sun,new THREE.HemisphereLight(0x9db9ff,0x777568,.96))
  const sky=mountSky(scene,'coast')
  const marine=addMarineSky(root,scene)
  const ground=makeGround(root)
  const instances=groupInstances(root)
  const harbour=makeHarbour(root,scene,farCoast,WATER,marine)
  const street=addPortStreet(root,coastAt)
  const plants=vegetation(root,instances)
  const water=makeWater(root,marine,harbour)
  const spray=breakers(instances)
  mistOnHorizon(root,marine)
  return {
    length:COURSE,
    ready:Promise.all([sky.ready,marine.ready,harbour.ready]),
    update(s) {
      ground(s)
      instances.update(s)
      plants.update(s)
      street(s)
      const t=performance.now()*.001
      water(t)
      harbour.update(t)
      spray(t)
    },
  }
}
