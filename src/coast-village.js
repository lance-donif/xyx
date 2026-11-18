import * as THREE from 'three'
import { villageAtlas } from './village.js'
import { terrainMap } from './nature.js'

const first = 695, last = 800
const bayTint = ['#fff2ca','#f7ead2','#ffe1a1','#e9edf0','#fff1d2']
const rafters = '#584839'
const quadUV = [[0,0],[1,0],[1,1],[0,1]]
const triUV = [[0,0],[1,0],[.5,1]]

export function onPortStreet(s,d) {
  return s > first - 3 && s < last + 3 && Math.abs(d) < 19
}

export function addPortStreet(parent, roadAt) {
  const blocks = new THREE.Group()
  blocks.name = 'The descending quay street'
  parent.add(blocks)
  const geometryData={points:[],colors:[],uv:[],indices:[]}
  const shade = new THREE.Color()
  const atlas = villageAtlas()
  const faces = new THREE.MeshLambertMaterial({map:atlas.map,vertexColors:true,side:THREE.DoubleSide})
  function face(points,tile,color,coords=quadUV) {
    const data=geometryData, n=data.points.length/3
    shade.set(color)
    for(let j=0;j<points.length;j++){
      const [u,v]=coords[j]
      data.points.push(...points[j])
      data.colors.push(shade.r,shade.g,shade.b)
      data.uv.push((tile%4+.007+.986*u)/4,1-(Math.floor(tile/4)+.007+.986*(1-v))/4)
    }
    data.indices.push(n,n+1,n+2)
    if(points.length===4) data.indices.push(n,n+2,n+3)
  }
  function basis(s, offset, front=offset) {
    const r=roadAt(s), yaw=Math.atan((roadAt(s+1).x-roadAt(s-1).x)/2)
    const c=Math.cos(yaw), sn=Math.sin(yaw)
    const base=roadAt(s-front*sn).y
    return (u,h,v)=>[r.x+(offset+u)*c-v*sn,base+h,-s+(offset+u)*sn+v*c]
  }
  function house(s,side,width,depth,height,id,detail='') {
    const wallGap=side>0?5.35:5.15
    const at=basis(s,side*(wallGap+width/2),side*wallGap)
    const poly=(pts,tile,tint,uv)=>face(pts.map(p=>at(...p)),tile,tint,uv)
    function box(x,y,z,w,h,d,tile,tint) {
      const a=x-w/2,b=x+w/2,f=z+d/2,k=z-d/2,t=y+h
      poly([[a,y,f],[b,y,f],[b,t,f],[a,t,f]],tile,tint)
      poly([[b,y,k],[a,y,k],[a,t,k],[b,t,k]],tile,tint)
      poly([[b,y,f],[b,y,k],[b,t,k],[b,t,f]],tile,tint)
      poly([[a,y,k],[a,y,f],[a,t,f],[a,t,k]],tile,tint)
      poly([[a,t,f],[b,t,f],[b,t,k],[a,t,k]],tile,tint)
    }
    const w=width/2,d=depth/2, peak=height+w*(1.1+id%3*.15)
    const wall=bayTint[id%bayTint.length], tile=[0,7,3,1,4,7][id%6]
    const roof=[8,8,10,9,8][id%5]
    // The horizontal sandstone footing is visible on the downhill side above the quay.
    box(0,-31,0,width-.18,31.27,depth-.18,11,'#a69579')
    box(0,.23,0,width-.24,2.33,depth-.25,id%3===1?5:2,'#f5e7c9')
    box(0,2.56,0,width,.18,depth,14,rafters)
    box(0,2.73,0,width,height-2.73,depth,tile,wall)
    poly([[-w,height,d],[w,height,d],[0,peak,d]],12,wall,triUV)
    poly([[w,height,-d],[-w,height,-d],[0,peak,-d]],12,wall,triUV)
    const lip=.32
    for(const sign of [-1,1]){
      const edge=sign*(w+lip), ridge=0
      poly([[edge,height-.08,d+lip],[edge,height-.08,-d-lip],[ridge,peak+.12,-d-lip],[ridge,peak+.12,d+lip]],roof,'#f9d8ad')
      box(edge,height-.19,0,.14,.15,depth+lip*2,14,rafters)
    }
    box(-side*.85,peak-1.4,-d*.45,.43,2.18,.62,11,'#c8a78b')
    box(-side*.85,peak+.64,-d*.45,.58,.2,.78,11,'#ae947b')
    // A jetty and end posts give the upper timber floor a distinct silhouette as the rider passes.
    const x=-side*(w+.06)
    for(const z of [-d+.09,d-.09]){
      box(x,2.58,z,.17,height-2.55,.18,14,rafters)
      box(x,2.17,z,.29,.42,.27,14,'#826442')
    }
    if(detail==='stall'){
      const front=-side*(w+1.43), back=-side*w, z1=d*.74, z0=-z1
      for(let i=0;i<8;i++){
        const a=z0+(z1-z0)*i/8,b=z0+(z1-z0)*(i+1)/8
        const color=i%2?'#f4dfa4':['#c75f3a','#688497','#ccae49'][id%3]
        poly([[front,2.08,a],[front,2.08,b],[back,2.83,b],[back,2.83,a]],15,color)
        poly([[front,1.92,a],[front,1.92,b],[front,2.08,b],[front,2.08,a]],15,color)
      }
      for(const z of [z0+.12,z1-.12])box(front,.13,z,.08,1.96,.08,14,'#8e6f47')
      box((front+back)/2,.32,0,.78,.52,z1-z0-.18,14,'#be936a')
      for(let i=0;i<4;i++) {
        const z=z0+(i+.5)*(z1-z0)/4
        box((front+back)/2,.84,z,.72,.18,(z1-z0)/4-.11,15,['#e8c167','#af5e42','#879655','#c58c51'][i])
      }
    }
    if(detail==='tower'){
      box(0,height-1,-d*.28,2.48,5,2.48,13,'#f6dec4')
      const rad=1.5,t=height+4,z=-d*.28
      const tips=[[-rad,t,z+rad],[rad,t,z+rad],[rad,t,z-rad],[-rad,t,z-rad]]
      tips.forEach((p,i)=>poly([p,tips[(i+1)%4],[0,t+3.7,z]],9,'#82949f',triUV))
    }
  }

  // Gaps between the right-hand warehouses give a changing view of the bay.
  house(700,-1,6.8,7.1,6.2,1)
  house(707, 1,5.9,7.5,5.7,2)
  house(715,-1,7.2,8.7,7.0,3)
  house(724, 1,6.2,8.3,6.1,4,'stall')
  house(727,-1,6.6,7.6,6.5,5)
  house(738,-1,8.0,9.1,6.4,6,'stall')
  house(740, 1,6.1,7.0,5.3,9)
  house(752,-1,6.4,7.6,7.5,1)
  house(759, 1,7.8,8.6,5.9,12,'stall')
  house(763,-1,7.3,7.8,6.0,3)
  house(777,-1,6.4,8.3,5.5,7)
  house(786, 1,5.8,7.2,5.7,8,'tower')
  house(791,-1,7.1,7.7,5.9,4,'stall')

  const architecture=new THREE.BufferGeometry()
  const d=geometryData
  architecture.setAttribute('position',new THREE.Float32BufferAttribute(d.points,3))
  architecture.setAttribute('uv',new THREE.Float32BufferAttribute(d.uv,2))
  architecture.setAttribute('color',new THREE.Float32BufferAttribute(d.colors,3))
  architecture.setIndex(d.indices)
  architecture.computeVertexNormals()
  const houses=new THREE.Mesh(architecture,faces)
  houses.castShadow=houses.receiveShadow=true
  blocks.add(houses)

  // A single strip covers both the running surface and raised footways.
  // Continuous world UVs keep the stone grain and transverse blocks stable through a turn.
  const points=[], uv=[], colors=[], indices=[]
  const bands=[
    [-6.25,-3.48,.17,.17,'#c4ad8c'],
    [-3.48,-3.28,.17,.17,'#edd9ae'],
    [-3.28,-3.28,.17,.055,'#666166'],
    [-3.28,-3.10,.055,.055,'#8d8786'],
    [-3.10,3.10,.055,.055,'#b7aea1'],
    [3.10,3.28,.055,.055,'#8d8786'],
    [3.28,3.28,.055,.17,'#666166'],
    [3.28,3.48,.17,.17,'#edd9ae'],
    [3.48,6.25,.17,.17,'#c4ad8c']
  ]
  for(const [left,right,lh,rh,tint] of bands){
    shade.set(tint)
    for(let s=first-4;s<=last+4;s++){
      const blend=THREE.MathUtils.smoothstep(s,first-4,first+4)*(1-THREE.MathUtils.smoothstep(s,last-3,last+4))
      const road=roadAt(s), slope=roadAt(s+.5).x-roadAt(s-.5).x
      const scale=Math.hypot(1,slope)*blend
      for(const [w,h] of [[left,lh],[right,rh]]) {
        points.push(road.x+w*scale,road.y+h,-s)
        uv.push(w*scale*.32,s*.32)
        colors.push(shade.r,shade.g,shade.b)
      }
      if(s>first-4){
        const k=points.length/3-1
        indices.push(k-3,k-2,k,k-3,k,k-1)
      }
    }
  }
  const surface=new THREE.BufferGeometry()
  surface.setAttribute('position',new THREE.Float32BufferAttribute(points,3))
  surface.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
  surface.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
  surface.setIndex(indices)
  surface.computeVertexNormals()
  const pavers=new THREE.MeshLambertMaterial({map:terrainMap('asphalt'),vertexColors:true})
  pavers.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 block=vMapUv*vec2(5.4,9.);
      block.x+=.5*mod(floor(block.y),2.);
      vec2 seam=min(fract(block),1.-fract(block));
      vec2 aa=max(fwidth(block),vec2(.01));
      vec2 edge=smoothstep(vec2(.016)-aa,vec2(.026)+aa,seam);
      float grit=texture2D(map,vMapUv).r;
      float tone=.82+.18*fract(sin(dot(floor(block),vec2(12.71,76.37)))*4128.);
      diffuseColor.rgb*=(.70+.50*grit)*mix(.75,1.,min(edge.x,edge.y))*tone;`)
  }
  const paving=new THREE.Mesh(surface,pavers)
  paving.receiveShadow=true
  blocks.add(paving)
  return s=>{blocks.visible=s>first-165 && s<last+36}
}
