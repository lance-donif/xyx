import * as THREE from 'three'
import { terrainMap, createFoliageBatch } from './nature.js'
import { mountSky } from './sky.js'

const TAU=Math.PI*2
const halfWidth=3.2
const {sin,cos,min,max,abs}=Math
function generator(seed) {
  let n=seed>>>0
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}
}
function point(p,side,height,along=0) {
  return [p.x+cos(p.yaw)*side-sin(p.yaw)*along,p.y+height,p.z-sin(p.yaw)*side-cos(p.yaw)*along]
}

function makeBatch(group,materials) {
  const buffers=new Map(),color=new THREE.Color()
  const uv=[[0,0],[1,0],[1,1],[0,1]]
  function face(kind,points,tone,coords=uv) {
    if(!buffers.has(kind)) buffers.set(kind,{p:[],uv:[],c:[],idx:[]})
    const a=buffers.get(kind),n=a.p.length/3
    color.set(tone)
    for(let i=0;i<points.length;i++){
      a.p.push(...points[i]);a.c.push(color.r,color.g,color.b);a.uv.push(...coords[i])
    }
    a.idx.push(n,n+1,n+2)
    if(points.length===4)a.idx.push(n,n+2,n+3)
  }
  function box(kind,at,x,y,z,w,h,d,tone) {
    const l=x-w/2,r=x+w/2,b=z-d/2,f=z+d/2,t=y+h
    const poly=pts=>face(kind,pts.map(p=>at(...p)),tone)
    poly([[l,y,b],[r,y,b],[r,t,b],[l,t,b]])
    poly([[r,y,f],[l,y,f],[l,t,f],[r,t,f]])
    poly([[l,y,f],[l,y,b],[l,t,b],[l,t,f]])
    poly([[r,y,b],[r,y,f],[r,t,f],[r,t,b]])
    poly([[l,t,b],[r,t,b],[r,t,f],[l,t,f]])
  }
  const a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3()
  const up=new THREE.Vector3(0,1,0),along=new THREE.Vector3(0,0,1)
  function limb(kind,start,end,r1,r2,tone,sides=7) {
    a.fromArray(start);b.fromArray(end);axis.subVectors(b,a).normalize()
    u.crossVectors(axis,abs(axis.y)>.88?along:up).normalize()
    v.crossVectors(u,axis)
    const ring=(p,r,i)=>{
      const angle=TAU*i/sides,si=r*sin(angle),co=r*cos(angle)
      return [p.x+u.x*co+v.x*si,p.y+u.y*co+v.y*si,p.z+u.z*co+v.z*si]
    }
    const length=a.distanceTo(b)
    for(let i=0;i<sides;i++){
      face(kind,[ring(a,r1,i),ring(a,r1,i+1),ring(b,r2,i+1),ring(b,r2,i)],tone,
        [[i/sides,0],[(i+1)/sides,0],[(i+1)/sides,length*.39],[i/sides,length*.39]])
    }
  }
  function finish(){
    for(const [kind,a] of buffers){
      const g=new THREE.BufferGeometry()
      g.setAttribute('position',new THREE.Float32BufferAttribute(a.p,3))
      g.setAttribute('color',new THREE.Float32BufferAttribute(a.c,3))
      g.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2))
      g.setIndex(a.idx);g.computeVertexNormals();g.computeBoundingSphere()
      const mesh=new THREE.Mesh(g,materials[kind])
      mesh.castShadow=kind!=='turf' && kind!=='cliff'
      mesh.receiveShadow=true
      group.add(mesh)
    }
  }
  return {face,box,limb,finish}
}

// Blocks are cut radially around a real opening, including the underside of the vault.
function templeGate(batch,p,leaves,random) {
  const at=(x,h,z)=>point(p,x,h,z)
  const stone=['#aaa385','#b4ab8b','#a19b7c','#a9a386','#c5ba97']
  for(const side of [-1,1]){
    const x=side*4
    // The surviving walls stand on deep retaining piers down to the river crag.
    for(let j=0;j<4;j++){
      const center=side*(4.02+j*1.49)
      batch.box('cliff',at,center,-14+sin(j)*.6,.32,1.52,14.1-sin(j)*.6,1.92-j*.13,'#92927c')
    }
    for(let i=0;i<7;i++){
      const base=i*.44
      batch.box('stone',at,x,base,-.05,i===0?1.72:1.39,.425,i%3===0?1.89:1.73,stone[i%5])
    }
    for(const [y,w,h] of [[.24,1.88,.18],[.53,1.65,.17],[2.58,1.55,.20],[2.8,1.83,.20]])
      batch.box('stone',at,x,y,0,w,h,1.97,'#b8ad89')
    // Side buttresses and broken return walls root the portal in the hillside.
    for(let row=0;row<4;row++)for(let col=0;col<2;col++){
      batch.box('stone',at,side*(5.38+col*1.52+row%2*.13),row*.52, .31,1.49,.50,1.15,
        stone[(row+col)%stone.length])
    }
    for(let i=0;i<6;i++){
      const x0=side*(3.7+.78*random()),z=.86-random()*.17,h=2.6-random()*.5
      let prev=at(x0,h,z)
      for(let j=1;j<6;j++){
        const q=at(x0+.10*sin(j*1.9+i),h-j*(.25+i*.025),z+.09*cos(j*1.2+i))
        batch.limb('bark',prev,q,.038,.027,'#789556',5);prev=q
        if(j%2)leaves.crown(q[0],q[1],q[2],.14,.17,.12,i*8+j)
      }
    }
  }
  const radius=3.38,outer=4.59,base=2.96, pieces=17
  for(let k=0;k<pieces;k++){
    const a=k*Math.PI/pieces+.0013,b=(k+1)*Math.PI/pieces-.0013
    const key=k===8, outerRadius=outer+(key?.32:0),front=key?-1.01:-.88,back=.90
    const coord=(t,r,z)=>at(cos(t)*r,base+sin(t)*r,z)
    const poly=(pairs,tone)=>batch.face('stone',pairs,tone)
    for(const z of [front,back])poly([coord(a,radius,z),coord(b,radius,z),coord(b,outerRadius,z),coord(a,outerRadius,z)],stone[k%5])
    poly([coord(a,radius,front),coord(a,radius,back),coord(b,radius,back),coord(b,radius,front)],'#847e63')
    poly([coord(a,outerRadius,back),coord(a,outerRadius,front),coord(b,outerRadius,front),coord(b,outerRadius,back)],'#8b9766')
    for(const end of [a,b])poly([coord(end,radius,front),coord(end,outerRadius,front),coord(end,outerRadius,back),coord(end,radius,back)],'#918668')
    if(k%3!==0){
      const q=coord((a+b)*.5,outerRadius+.08,random()*.58-.29)
      leaves.crown(q[0],q[1],q[2],.8,.31,.66,87+k)
    }
  }
}

function headland(batch,leaves,center,rx,rz,top,coast,random) {
  const count=18,points=[], angles=[]
  for(let i=0;i<count;i++){
    const a=i/count*TAU+.07*(random()-.5)
    angles.push(a);points.push(.84+random()*.23)
  }
  const levels=[[-21,1.20],[-12,1.04],[-9,1.09],[-7,1.00],[-3,1.07],[-1,.98],[0,.91]]
  const rings=levels.map(([h,scale],j)=>points.map((r,i)=>{
    const a=angles[i],s=scale*r*(.99+.025*sin(i*3+j))
    const y=(j===0?h:top+(top+20)*h/21)+sin(a*3+.3)*1.16+.45*sin(i*13+j)
    return [center[0]+cos(a)*rx*s,center[1]+y,center[2]+sin(a)*rz*s]
  }))
  const summit=rings.at(-1)
  for(let i=0;i<count;i++){
    const n=(i+1)%count
    for(let j=1;j<rings.length;j++){
      const a=rings[j-1][i],b=rings[j-1][n],c=rings[j][n],d=rings[j][i]
      const vein=(i%3===0 || j===2 || j===4)
      batch.face('cliff',[a,b,c,d],coast?(vein?'#a9a99a':'#c2bda4'):(vein?'#898c79':'#a3a28d'),
        [[0,a[1]*.17],[1,b[1]*.17],[1,c[1]*.17],[0,d[1]*.17]])
    }
    batch.face('turf',[summit[i],summit[n],[center[0],center[1]+top+1,center[2]]],'#a8ba7b')
  }
  for(let i=0;i<13;i++){
    const a=random()*TAU,r=Math.sqrt(random())*.83
    const x=center[0]+cos(a)*rx*r,z=center[2]+sin(a)*rz*r,y=center[1]+top+.6
    const h=2.8+random()*(coast?6:10)
    if(coast || i%4===0)leaves.conifer(x,y-.6,z,h*.27,h,h*.26,i*31)
    else {
      batch.limb('bark',[x,y-1,z],[x+.24,y+h*.7,z],h*.085,h*.035,'#949176',6)
      leaves.crown(x,y+h*.77,z,h*.56,h*.40,h*.53,i*29+1)
    }
  }
}

function brokenViaduct(batch,p) {
  const at=(x,y,z)=>point(p,x,y,z)
  // A valley aqueduct continues behind the bend. Its voussoirs and openings have real depth.
  const stone=['#aaa68d','#bcb69a','#afa98f','#b4ac92']
  for(let k=-3;k<=3;k++){
    const cx=k*10,base=5.2+sin(k*.67)*.32
    if(k<3){
      batch.box('stone',at,cx+5,-20,0,2.1,base+20,2.4,stone[(k+3)%4])
      batch.box('stone',at,cx+5,base-.5,0,2.7,.55,2.8,'#beb79c')
    }
    for(let j=0;j<11;j++){
      const a=j*Math.PI/11,b=(j+1)*Math.PI/11
      const q=(t,r,z)=>at(cx+cos(t)*r,base+sin(t)*r,z)
      for(const z of [-1.3,1.3])
        batch.face('stone',[q(a,4,z),q(b,4,z),q(b,5.15,z),q(a,5.15,z)],stone[(j+k+7)%4])
      batch.face('stone',[q(a,4,-1.3),q(a,4,1.3),q(b,4,1.3),q(b,4,-1.3)],'#8b8e7c')
    }
    batch.box('stone',at,cx,base+4.94,0,10.1,1.03,2.75,'#bab499')
    batch.box('turf',at,cx,base+5.96,0,10.24,.25,2.96,'#a1b27d')
  }
}

function makeSection(segment,events,sample,materials) {
  const {start,end}=segment
  const random=generator(Math.round(segment.start*100)+41929)
  const group=new THREE.Group(),batch=makeBatch(group,materials),leaves=createFoliageBatch(group)
  const coast=segment.biome==='coast'
  const gaps=events.filter(e=>e.type==='gap' && e.at>start-20 && e.at<end+20)
  const turns=events.filter(e=>e.type==='turn' && e.at>start-24 && e.at<end+24)
  const nearGap=d=>gaps.reduce((r,e)=>min(r,abs(d-e.at)),Infinity)
  const nearTurn=d=>turns.some(e=>abs(d-e.at)<11)
  const wharf=d=>coast && Math.floor((d+6)/55)%3!==0
  const stones=coast?['#d2c7a8','#cac4b1','#d7caac','#c6c0a8']:['#c0ba9e','#a8aa94','#b8b59e','#c7bea1','#b0ad97']
  const take=a=>a[Math.floor(random()*a.length)]
  const frames=new Map()
  const deckPoint=(s,x,y)=>{
    if(!frames.has(s))frames.set(s,sample(s))
    return point(frames.get(s),x,y)
  }
  const quad=(kind,s1,x1,h1,x2,h2,s2,x3,h3,x4,h4,tone,uv)=>batch.face(kind,[
    deckPoint(s1,x1,h1),deckPoint(s1,x2,h2),deckPoint(s2,x3,h3),deckPoint(s2,x4,h4)],tone,uv)
  // Insert exact bridge faces into the grid: there is no invisible terrain below a gap.
  const distances=new Set([start,end])
  for(let s=Math.ceil(start);s<end;s++) distances.add(s)
  for(const g of gaps)for(const n of [-13,-2,2,13])if(g.at+n>start && g.at+n<end)distances.add(g.at+n)
  const rows=[...distances].sort((a,b)=>a-b)
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1], b=rows[i], center=(a+b)/2, gap=nearGap(center)
    if(gap<2)continue
    if(gap<13 || wharf(center)){
      for(let s=a;s<b;s+=.5){
        const stop=min(b,s+.5)-.018
        const l=-3.22+random()*.105,r=3.22-random()*.105,top=-random()*.02
        quad('wood',s+.008,l,top,r,top,stop,r,top,l,top,take(['#be9c70','#ceb48a','#b1976f','#c7ac7c']))
        quad('wood',s+.008,l,-.17,r,-.17,s+.008,r,top,l,top,'#806b53')
      }
      for(const side of [-1,1]){
        const x=side*2.71
        quad('bark',a,x,-.65,x,-.16,b,x,-.16,x,-.65,'#8e755c')
      }
      continue
    }
    const shifts=i%2===0?[-3.18,-1.76,-.08,1.92,3.18]:[-3.18,-2.48,-.76,.85,2.37,3.18]
    // Scanned stone on hand-laid staggered slabs. Narrow joints reveal a darker bed below.
    quad('stone',a,-3.24,-.094,3.24,-.094,b,3.24,-.094,-3.24,-.094,'#6b715c')
    for(let j=1;j<shifts.length;j++){
      const x=shifts[j-1]+.021,y=shifts[j]-.021,t=-.009*random()
      quad('stone',a+.018,x,t,y,t,b-.018,y,t,x,t,take(stones),
        [[x*.42,a*.42],[y*.42,a*.42],[y*.42,b*.42],[x*.42,b*.42]])
    }
    for(const side of [-1,1]){
      const restrict=nearTurn(center)? .52:1
      const verge=s=>side*(3.24+(.64+.37*sin(s*.22+side)+.24*sin(s*.62))*restrict)
      const outside=s=>side*(5.7+1.25*sin(s*.083+side*6)+.36*sin(s*.73))
      const toe=s=>side*(7.8+2.6*sin(s*.068+side*4))
      quad('turf',a,side*3.21,-.10,verge(a),-.16,b,verge(b),-.16,side*3.21,-.10,'#c0ba81',
        [[0,a*.45],[.5,a*.45],[.5,b*.45],[0,b*.45]])
      const depthLow=-17+(coast?2.8:4)*sin(center*.14+side)
      const shelves=[[verge(a),verge(b),-.15],[outside(a),outside(b),-2.4],[outside(a)*.89,outside(b)*.89,-6.1],[toe(a),toe(b),depthLow]]
      for(let j=1;j<shelves.length;j++){
        const [x1,x2,h]=shelves[j-1], [x3,x4,k]=shelves[j]
        quad('cliff',a,x1,h,x3,k,b,x4,k,x2,h,j===1?'#999873':j===2?'#9c9a89':'#777f79',
          [[a*.15,h*.19],[a*.15,k*.19],[b*.15,k*.19],[b*.15,h*.19]])
      }
    }
  }

  // Fixed roadside objects are rejected if a switchback would put them across another lane.
  const lane=[]
  for(let s=max(-14,start-84);s<=end+84;s+=3)lane.push(sample(s))
  const clear=(q,margin)=>lane.every(p=>(q[0]-p.x)**2+(q[2]-p.z)**2>margin*margin)
  if(end-start>18){
    for(const side of [-1,1]){
      const scatter=generator(Math.round(start*73)+(side<0?19201:66153))
      for(let j=0;j<3;j++){
        const along=start+(end-start)*(j+.35)/3,p=sample(along)
        const x=side*(j===1?42+scatter()*14:22+scatter()*19)
        const center=point(p,x,0,(scatter()-.5)*8)
        const width=9+scatter()*8, depth=8+scatter()*7
        if(clear(center,max(width,depth)+6)){
          const top=(coast?3:1)+scatter()*(coast?14:9)
          headland(batch,leaves,center,width,depth,top,coast,scatter)
          if(coast && side>0 && j===1 && Math.floor(start/100)%3===2){
            const beacon=h=>[center[0],center[1]+top+h,center[2]]
            batch.limb('stone',beacon(-.65),beacon(5),2.1,1.57,'#e2d7bb',12)
            batch.limb('stone',beacon(5),beacon(7.65),1.57,1.36,'#a05d47',12)
            batch.limb('stone',beacon(7.65),beacon(10.2),1.36,1.13,'#e8ddbd',12)
            batch.limb('stone',beacon(10.2),beacon(10.6),1.6,1.60,'#7a847b',12)
            batch.limb('stone',beacon(10.6),beacon(12.05),1.02,1.02,'#e4bf73',10)
            batch.limb('stone',beacon(12.05),beacon(13.55),1.58,.09,'#8a5446',12)
          }
        }
      }
    }
  }
  if(start<=2 && end>2){
    const p=sample(0),q=point(p,1,0,92)
    brokenViaduct(batch,{x:q[0],y:p.y,z:q[2],yaw:p.yaw-.22})
    for(const side of [-1,1]){
      headland(batch,leaves,point(p,side*39,0,86+side*8),15,12,9+side*3,false,random)
    }
  }
  if(start<=2 && end>2)templeGate(batch,sample(2),leaves,random)
  for(let s=start+1;s<end;s+=2.9+random()*3.9){
    const near=nearGap(s)
    if(near<13 || wharf(s) || nearTurn(s))continue
    const side=random()<.5?-1:1,p=sample(s),at=(x,h,z)=>point(p,x,h,z)
    const x=side*(3.56+random()*.25)
    if(clear(at(x,.12,0),3.27)){
      batch.box('stone',at,x,-.14,0,.56,.66+random()*.42,.67,'#b8b297')
      if(random()<.62)batch.box('stone',at,x,.52,0,.72,.19,.78,'#b5ae8e')
    }
  }
  for(let s=start+.5;s<end;s+=1.05){
    if(nearGap(s)<14 || wharf(s))continue
    const side=random()<.5?-1:1,p=sample(s),q=point(p,side*(3.26+random()*.74),-.11)
    if(clear(q,3.18))leaves.tuft(q[0],q[1],q[2],.43+random()*.65,.28+random()*.67,s*26)
  }
  for(let s=start+4;s<end;s+=coast?11:6.7){
    const side=random()<.49?-1:1,p=sample(s)
    const x=side*(5.2+random()*2.1),low=-2.7-random()*2.5, h=(coast?6.4:10)+random()*(coast?5.2:9)
    const base=point(p,x,low,0)
    if(!clear(base,4.8) || (nearGap(s)<16) || wharf(s) || nearTurn(s) || abs(s-2)<4)continue
    const bend=point(p,x+side*.4,low+h*.53,.5),top=point(p,x+side*(coast?1.0:-.7),low+h,-.2)
    const girth=coast?.27:.47+random()*.32
    batch.limb('bark',base,bend,girth*1.3,girth*.72,'#9d9174',8)
    batch.limb('bark',bend,top,girth*.73,.19,'#a49a75',7)
    if(coast){
      leaves.conifer(top[0],low+p.y+h*.22,top[2],h*.22,h*.85,h*.21,s*3)
    }else{
      for(let j=0;j<6;j++){
        const angle=j*TAU/6+random()*.7, length=2.0+random()*2.2
        const limb=[top[0]+sin(angle)*length,top[1]+(random()-.62)*3.8,top[2]+cos(angle)*length]
        batch.limb('bark',bend,limb,girth*.36,.085,'#a09878')
        leaves.crown(limb[0],limb[1]+1.1,limb[2],2.6+random(),1.5+random(),2.3+random(),s*5+j)
      }
      for(let j=0;j<4;j++){
        const angle=j*TAU/4+.44,c=point(p,x+cos(angle)*1.8,low-.52,sin(angle)*1.7)
        batch.limb('bark',[base[0],base[1]+1.5,base[2]],c,.42,.17,'#92936b')
      }
    }
  }
  if(coast){
    for(let s=Math.ceil(start/5)*5;s<end;s+=5){
      if(!wharf(s) || nearGap(s)<15)continue
      for(const side of [-1,1]){
        const rail=side*3.28,q=deckPoint(s,rail,-7.8),p=deckPoint(s,rail,.84)
        batch.limb('bark',q,p,.20,.115,'#a39273',7)
        if(wharf(s+5) && nearGap(s+5)>13){
          const low=deckPoint(s+2.5,rail,.51),tail=deckPoint(s+5,rail,.76)
          batch.limb('wood',p,low,.040,.040,'#b6a27c',5)
          batch.limb('wood',low,tail,.040,.040,'#b6a27c',5)
          batch.limb('wood',deckPoint(s,rail,-.62),deckPoint(s+5,rail,-3),.14,.14,'#958068',6)
        }
      }
    }
  }
  for(const g of gaps){
    for(const sign of [-1,1]){
      for(const station of [g.at-12,g.at-7,g.at-2.7,g.at+2.7,g.at+7,g.at+12]){
        if(station<start || station>=end)continue
        const p=sample(station),at=(x,h,z)=>point(p,x,h,z)
        const x=sign*3.32
        batch.limb('bark',at(x,-7,0),at(x,1.03,0),.27,.14,'#aa906a',8)
        batch.box('wood',at,x,.55,0,.33,.11,.32,'#ad8a53')
        const next=station<g.at-10?g.at-7:station<g.at-5?g.at-2.7:station>g.at && station<g.at+4?g.at+7:station>g.at+4 && station<g.at+9?g.at+12:null
        if(next!==null){
          const mid=(station+next)/2,q1=at(x,.79,0),q2=deckPoint(mid,x,.57),q3=deckPoint(next,x,.79)
          batch.limb('wood',q1,q2,.057,.057,'#b4996e',5);batch.limb('wood',q2,q3,.057,.057,'#b4996e',5)
        }
      }
    }
  }
  leaves.flush();batch.finish()
  return group
}

function horizon(root) {
  const ridges=new THREE.TextureLoader().load(new URL('./art/alpine-ridgeline.webp',import.meta.url).href)
  ridges.colorSpace=THREE.SRGBColorSpace
  const far=new THREE.MeshBasicMaterial({map:ridges,color:'#d8ebdc',side:THREE.DoubleSide,alphaTest:.28,fog:false,depthWrite:false})
  const mountain=new THREE.Mesh(new THREE.CylinderGeometry(172,172,56,112,1,true),far)
  mountain.renderOrder=-5
  root.add(mountain)
  const material=new THREE.ShaderMaterial({
    uniforms:{clock:{value:0}},side:THREE.DoubleSide,
    vertexShader:`varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`varying vec3 vWorld;uniform float clock;
      void main(){
        vec2 p=vWorld.xz;
        vec3 v=normalize(cameraPosition-vWorld);
        float a=sin(p.x*.26+p.y*.42+clock*1.2+sin(p.y*.16))*.6+sin(p.x*.71-p.y*.3-clock*.8)*.4;
        float gleam=pow(max(0.,a),9.);
        float fres=pow(1.-max(v.y,0.),2.);
        vec3 col=mix(vec3(.013,.18,.19),vec3(.24,.45,.50),fres)+gleam*vec3(.12,.18,.14);
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`})
  const water=new THREE.Mesh(new THREE.PlaneGeometry(760,760),material)
  water.rotation.x=-Math.PI/2;root.add(water)
  return {
    update(p){mountain.position.set(p.x,p.y-13,p.z);water.position.set(p.x,p.y-18.2,p.z);material.uniforms.clock.value=performance.now()*.001},
    dispose(){ridges.dispose()}
  }
}

export function createChaseWorld(scene) {
  const root=new THREE.Group();root.name='Overgrown temple road';scene.add(root)
  const sun=new THREE.DirectionalLight(0xffe8ba,2.65)
  sun.position.set(-38,53,-29);sun.castShadow=true
  sun.shadow.mapSize.set(1024,1024)
  Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:130})
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00035;sun.shadow.normalBias=.045
  const hemi=new THREE.HemisphereLight(0xd8f0ff,0x737c57,1.05)
  root.add(sun,sun.target,hemi)
  scene.fog=new THREE.Fog(0xb4cfc7,68,175)
  const sky=mountSky(scene,'alpine'),far=horizon(root)
  const stone=map=>new THREE.MeshLambertMaterial({map:terrainMap(map),vertexColors:true,side:THREE.DoubleSide})
  const materials={stone:stone('rock'),cliff:stone('rock'),bark:stone('bark'),wood:stone('bark'),turf:stone('grass')}
  const chunks=new Map()
  function disposeGroup(g){
    const used=new Set()
    g.traverse(o=>{o.geometry?.dispose();if(o.material)used.add(o.material)})
    for(const m of used)if(!Object.values(materials).includes(m))m.dispose()
    g.removeFromParent()
  }
  return {
    ready:sky.ready,
    update(segments,distance,events,sample){
      const keep=new Set()
      for(const s of segments){
        if(s.end < distance-26 || s.start>distance+150)continue
        keep.add(s.id)
        if(!chunks.has(s.id)){
          const mesh=makeSection(s,events,sample,materials)
          chunks.set(s.id,mesh);root.add(mesh)
        }
      }
      for(const [id,g] of chunks)if(!keep.has(id)){disposeGroup(g);chunks.delete(id)}
      const p=sample(distance),focus=sample(distance+12)
      far.update(p)
      sun.position.set(focus.x-38,focus.y+53,focus.z-29)
      sun.target.position.set(focus.x,focus.y,focus.z)
    },
    dispose(){
      for(const g of chunks.values())disposeGroup(g)
      chunks.clear()
      disposeGroup(root)
      for(const m of Object.values(materials))m.dispose()
      far.dispose();sun.shadow.dispose();sky.dispose()
    },
  }
}
