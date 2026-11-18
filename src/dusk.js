import * as THREE from 'three'
import { terrainMap, createFoliageBatch } from './nature.js'
import { villageAtlas } from './village.js'
import { mountSky } from './sky.js'
import { mountDuskVista } from './dusk-vista.js'

const {sin,cos,atan,abs,min,max,exp,floor,PI} = Math
const smooth = THREE.MathUtils.smoothstep
const length = 1200
const blend = THREE.MathUtils.lerp
const region = (s,a,b,fade) => smooth(s,a-fade,a)*(1-smooth(s,b,b+fade))

export function duskAt(s) {
  return {
    x:9*sin(s/19+1.0)+14*sin(s/70-1)-3*sin(s/12-.35)
      + 6*exp(-Math.pow((s-39)/18,2)) - 3.9*exp(-Math.pow((s-72)/21,2)),
    y:94-.102*s-26*atan(s/90)-6*atan((s-430)/90)-5*atan((s-840)/90)+1.9*sin(s/30),
  }
}

export function duskLaneScale(s) {
  return .51+.095*region(s,59,161,30)+.115*region(s,304,576,41)+.14*region(s,770,1115,64)
}

function roadWidth(s) { return 4.25*duskLaneScale(s)+.29 }
function market(s) { return max(region(s,78,137,25),region(s,346,548,29),region(s,788,1129,36)) }
function canal(s) { return 25 + 3.6*sin(s/27) }
function waterline(s) { return 65.5-.018*(s-28) }

function ground(x,s) {
  const road=duskAt(s),d=x-road.x, edge=roadWidth(s)
  const side=d<0?-1:1, outside=max(0,abs(d)-edge)
  const relief=(12.4+5.5*cos(s/77)+2.8*sin(s/37))*(side>0?1.15:.82)
  const street=market(s)*(.72+.18*sin(s/35+side*1.7))
  const shoulder=2.2+2.2*region(s,-32,75,35)+.48*sin(s/15+side)
  const fall=max(0,outside-shoulder)
  let y=road.y-.072*min(outside,shoulder)-relief*(1-exp(-fall/10.8))*(1-street)
  y+=smooth(outside,.5,2.9)*(.16*sin(s*.42+d)+.11*sin(s*.72-d*.83))
  const country=smooth(outside,6,32)
  y+=country*(1.8*sin(s/22+d/23)+2.35*cos(s/67-d/19))
  y+=smooth(outside,56,162)*(8.5+8*cos(s/83-d/41))
  const quay=region(s,30,103,18)*smooth(d,8.5,17)*(1-smooth(d,63,88))
  y=blend(y,waterline(s)+1.18+max(0,d-41)*.09,quay)
  const channel=(1-smooth(abs(d-canal(s)),5.7,7.4))*region(s,23,107,12)
  return y-3.7*channel
}

function sequence(seed) {
  return () => {
    seed=(Math.imul(1664525,seed)+1013904223)>>>0
    return seed/4294967296
  }
}

function surface(scene) {
  const dirt=terrainMap('dirt'), grass=terrainMap('grass')
  const trail=new THREE.MeshLambertMaterial({map:dirt,vertexColors:true})
  trail.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 mineral=texture2D(map,vMapUv).rgb;
      float fleck=dot(mineral,vec3(.22,.65,.13));
      diffuseColor.rgb*=mix(vec3(.58,.40,.32),vec3(.95,.76,.60),min(1.,fleck*1.1));`)
  }
  const hills=new THREE.MeshLambertMaterial({map:grass,vertexColors:true})
  const tone=new THREE.Color(),stoneTint=new THREE.Color().setRGB(.91,.69,.53)
  const groups=[]
  const shoulders=[-265,-202,-152,-115,-86,-62,-42,-27,-18,-12,-8.8,-6.6,-4.6,-3.4,0]
  for(let from=-80;from<1440;from+=100) {
    const group=new THREE.Group()
    for(const section of [-1,0,1]) {
      const positions=[],uv=[],colors=[],indices=[]
      const across=section<0?shoulders:section>0?shoulders.map(v=>-v).reverse():[-1,-.76,-.36,0,.36,.76,1]
      for(let i=0;i<=50;i++) {
        const s=from+i*2, {x,y}=duskAt(s), w=roadWidth(s)
        for(let j=0;j<across.length;j++) {
          const p=across[j]
          const d=section===0?p*w:p===0?w*section:p
          const h=section===0?y+.012:ground(x+d,s)
          const grassy=.5+.24*sin(s*.175+d*.32)+.18*cos(s*.09-d*.43)
          const m=market(s)
          if(section===0) {
            const track=smooth(abs(p),.76,1)
            tone.set(0xffd3b0).multiplyScalar(1.04+.08*sin(s*.22+d*.4)-track*.18)
          } else {
            tone.setRGB(1.0+grassy*.51,.64+grassy*.32,.36+grassy*.18)
            tone.lerp(stoneTint,m*.52*smooth(abs(d),2.3,4.3))
            const hollow=smooth(abs(d),9,28)*(.53+.30*sin(s/37+d/28)+.17*sin(s/69-d/21))
            tone.multiplyScalar(1.-.45*hollow)
          }
          positions.push(x+d,h,-s);uv.push((x+d)*.33,s*.33);colors.push(tone.r,tone.g,tone.b)
          if(i&&j) {
            const k=i*across.length+j
            indices.push(k-across.length-1,k-across.length,k,k-across.length-1,k,k-1)
          }
        }
      }
      const g=new THREE.BufferGeometry()
      for(const [name,arr,size] of [['position',positions,3],['uv',uv,2],['color',colors,3]])g.setAttribute(name,new THREE.Float32BufferAttribute(arr,size))
      g.setIndex(indices);g.computeVertexNormals()
      const mesh=new THREE.Mesh(g,section===0?trail:hills)
      mesh.receiveShadow=true;group.add(mesh)
    }
    scene.add(group);groups.push({from,group})
  }
  return s=>{for(const {from,group} of groups) group.visible=from+100>s-105&&from<s+675}
}

function mapUV(tile,u,v) {
  return [(tile%4+.006+u*.988)/4,1-(floor(tile/4)+.006+(1-v)*.988)/4]
}

// The same plaster, window and tile atlas used in the valley keeps roofs legible while
// allowing an entire hillside district to fit in a small number of draw calls.
function city(scene) {
  const random=sequence(6732193)
  const atlas=villageAtlas()
  const material=new THREE.MeshLambertMaterial({
    ...atlas,vertexColors:true,emissive:0xffd396,emissiveIntensity:2.75,side:THREE.DoubleSide,
  })
  const lampMat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false})
  const byBlock=new Map(), rendered=[], glows=[]
  const tint=new THREE.Color()
  function buffer(s,light=false) {
    const idx=floor(s/88),key=idx*2+Number(light)
    if(!byBlock.has(key)) byBlock.set(key,{idx,light,v:[],u:[],c:[],f:[]})
    return byBlock.get(key)
  }
  function face(b,vertices,tile,color,uv) {
    const start=b.v.length/3
    tint.set(color)
    for(let i=0;i<vertices.length;i++) {
      b.v.push(...vertices[i]);b.c.push(tint.r,tint.g,tint.b)
      b.u.push(...mapUV(tile,...uv[i]))
    }
    b.f.push(start,start+1,start+2)
    if(vertices.length===4)b.f.push(start,start+2,start+3)
  }
  const square=[[0,0],[1,0],[1,1],[0,1]],triangle=[[0,0],[1,0],[.5,1]]
  function frame(x,y,s,angle) {
    const b=buffer(s),illuminated=buffer(s,true), c=cos(angle),sn=sin(angle)
    const point=(u,v,w)=>[x+u*c+w*sn,y+v,-s-u*sn+w*c]
    function quad(a,d,e,f,tile,color,lit=false) {
      face(lit?illuminated:b,[a,d,e,f].map(p=>point(...p)),tile,color,square)
    }
    function tri(a,d,e,tile,color) { face(b,[a,d,e].map(p=>point(...p)),tile,color,triangle) }
    function box(cx,base,cz,w,h,depth,tile,color,lit=false) {
      const l=cx-w/2,r=cx+w/2,f=cz+depth/2,k=cz-depth/2,t=base+h
      quad([l,base,f],[r,base,f],[r,t,f],[l,t,f],tile,color,lit)
      quad([r,base,k],[l,base,k],[l,t,k],[r,t,k],tile,color,lit)
      quad([r,base,f],[r,base,k],[r,t,k],[r,t,f],tile,color,lit)
      quad([l,base,k],[l,base,f],[l,t,f],[l,t,k],tile,color,lit)
      quad([l,t,f],[r,t,f],[r,t,k],[l,t,k],tile,color,lit)
    }
    function halo(u,v,w,size) {glows.push([...point(u,v,w),size])}
    return {point,quad,tri,box,halo}
  }
  const pick=a=>a[floor(random()*a.length)]
  const facades=[0xffe4b3,0xffdec8,0xffcfa0,0xf3debf,0xeac399]
  const roofs=[0xd6b3a5,0xcaa49f,0xffbc89,0x9f9fa8,0xf3bb95,0xbdafbb]
  function house(s,d,w,deep,h,angle,detail,shop=false) {
    const x=duskAt(s).x+d, y=ground(x,s)
    const {quad,tri,box,halo}=frame(x,y,s,angle)
    const l=-w*.5,r=w*.5,f=deep*.5,b=-f,wall=pick(facades),tile=floor(random()*8)
    const slope=pick([.46,.54,.59,.65]),peak=h+w*slope
    const tileRoof=pick([8,8,9,9,9,10]),roofColor=pick(roofs)
    // Cool shadow masses alternate with ridges exposed to the low sun. The emissive atlas is
    // independent of this tint, so individual windows still carry through the backlit quarters.
    const district=.74+.14*sin(s/43+d/24)+.12*cos(s/77-d/38)
    const frontDot=.36*sin(angle)-.93*cos(angle)
    const sideDot=.36*cos(angle)+.93*sin(angle)
    function exposure(base,dot,floorLight) {
      const light=smooth(dot,-.23,.70), amount=blend(floorLight,1.,light)*district
      const col=new THREE.Color(base)
      col.r*=amount*(.79+.21*light);col.g*=amount*(.86+.14*light);col.b*=amount*(1.08-.08*light)
      return col
    }
    box(0,-5,0,w+.1,5.48,deep+.1,11,0xcbaf94)
    quad([l,.46,f],[r,.46,f],[r,h,f],[l,h,f],tile,exposure(wall,frontDot,.38))
    quad([r,.46,b],[l,.46,b],[l,h,b],[r,h,b],tile,exposure(wall,-frontDot,.38))
    quad([r,.46,f],[r,.46,b],[r,h,b],[r,h,f],(tile+2)%8,exposure(wall,sideDot,.38))
    quad([l,.46,b],[l,.46,f],[l,h,f],[l,h,b],(tile+2)%8,exposure(wall,-sideDot,.38))
    const ov=detail ? .39 : .23,hip=random()<.24?min(1.5,deep*.21):0
    quad([l-ov,h-.12,f+ov],[l-ov,h-.12,b-ov],[0,peak,b+hip],[0,peak,f-hip],tileRoof,exposure(roofColor,-sideDot+.35,.62))
    quad([r+ov,h-.12,b-ov],[r+ov,h-.12,f+ov],[0,peak,f-hip],[0,peak,b+hip],tileRoof,exposure(roofColor,sideDot+.35,.62))
    tri([l,h,f],[r,h,f],[0,peak,f-hip],hip?tileRoof:12,hip?roofColor:wall)
    tri([r,h,b],[l,h,b],[0,peak,b+hip],hip?tileRoof:12,hip?roofColor:wall)
    if(detail || random()<.18) {
      const cx=w*(random()-.5)*.60,cz=deep*(random()-.50)*.64
      box(cx,h-.4,cz,.55,peak-h+1.4,.69,11,0xdac2aa)
      box(cx,peak+1.,cz,.70,.19,.84,11,0xcfa885)
    }
    if(detail) {
      for(const e of [l-ov,r+ov])box(e,h-.26,0,.12,.17,deep+2*ov,14,0xa38473)
      const dx=(random()<.5?-1:1)*w*.34
      box(dx,h+(peak-h)*.25,deep*.10,1.13,1.10,1.12,12,wall)
      tri([dx-.67,h+(peak-h)*.25+1.1,deep*.1+.67],[dx+.67,h+(peak-h)*.25+1.1,deep*.1+.67],[dx,h+(peak-h)*.25+1.7,deep*.1+.67],12,wall)
      for(const sign of [-1,1])quad([dx+sign*.70,h+(peak-h)*.25+1.1,deep*.1+.74],[dx+sign*.70,h+(peak-h)*.25+1.1,deep*.1-.74],[dx,h+(peak-h)*.25+1.7,deep*.1-.74],[dx,h+(peak-h)*.25+1.7,deep*.1+.74],tileRoof,roofColor)
    }
    if(shop){
      // A projecting arcade and lit shop windows give the market a bright, inhabited edge.
      const length=w*.84, awning=pick([0xa65336,0x89717d,0xcf9252,0x586a78,0x916a42])
      box(0,-.15,f+1.0,length+.47,.30,2.35,11,0xc2aa91)
      for(let j=0;j<7;j++){
        const a=length*(j/7-.5),b=length*((j+1)/7-.5),cloth=j%2?0xe2c49e:awning
        quad([a,2.38,f+2.05],[b,2.38,f+2.05],[b,3.26,f],[a,3.26,f],15,cloth)
        quad([a,2.18,f+2.05],[b,2.18,f+2.05],[b,2.38,f+2.05],[a,2.38,f+2.05],15,cloth)
      }
      for(const u of [-.44,.44])box(u*length,.12,f+1.92,.085,2.12,.085,14,0x957452)
      box(0,.66,f+.025,length,.99,.17,15,0xffcf79,true)
      for(let j=0;j<5;j++)box((j/4-.5)*length,.6,f+.13,.06,1.18,.05,14,0x84532f)
      box(0,.46,f+.90,length*.85,.45,.68,14,0xa57d50)
      for(let j=0;j<4;j++)box((j-1.5)*length*.19,.91,f+.9,length*.18,.15,.59,15,[0xcc8755,0xad512f,0xd3a853,0x8f9760][j])
      halo(0,1.15,f+.30,3.1)
    }
    if(random()<.37)halo((random()-.5)*w*.57,h*.60,f+.10,detail?1.22:1.65)
  }

  // Continuous roofscape below the ridge. The lots turn with lanes and contour lines.
  for(const side of [-1,1]) {
    for(let row=0;row<12;row++){
      for(let s=-48+random()*12;s<1410;s+=8.8+random()*4.5) {
        const d=side*(25+row*9.35+4.4*sin(s/37+row*.32)+4.2*sin(s/61+side))
        if(abs(d-canal(s))<9.6&&s<123&&s>12)continue
        const density=.70+.22*sin(s/63+row*.45)
        if(random()>density)continue
        const w=4.25+random()*3.45,depth=4.2+random()*3.28
        const yaw=.31*sin(s/21+row*.41)+(row%3===1?1.42:0)+(random()-.5)*.41
        house(s,d,w,depth,4.7+2.9*random(),yaw,false)
      }
    }
  }

  // Nearest buildings are separate groups of cottages, quays and market wings.
  const districts=[
    [-1,22,55,14.5,false], [1,18,52,44,true], [1,44,113,12.8,true],
    [-1,62,141,8.8,true],[1,124,190,10.8,false],[-1,164,242,13.4,false],
    [1,233,319,13.7,true],[-1,288,369,11.1,false],[-1,374,481,8.5,true],
    [1,345,427,10.8,true],[1,446,568,8.8,true],[-1,510,585,12.2,false],
    [1,604,687,16.5,false],[-1,642,714,10.8,true],[1,728,841,10.1,false],
    [-1,765,893,9.4,true],[1,861,969,8.5,true],[-1,917,1052,9.6,true],
    [1,1001,1124,10.7,true],[-1,1083,1161,11.5,false],[1,1143,1217,12.5,true],
  ]
  for(const [side,start,end,setback,shop] of districts) {
    for(let s=start;s<end;) {
      const w=5.7+random()*2.8,deep=4.05+random()*2.1
      const heading=atan((duskAt(s+1).x-duskAt(s-1).x)*.5)
      const dx=setback+.85*sin(s/8)+random()*2.15
      house(s,side*dx,w,deep,5.6+random()*3.9,-side*PI/2-heading+(random()-.5)*.24,true,shop&&random()<.73)
      s+=w+1.4+random()*3.5
    }
  }

  function belfry(s,d,h) {
    const x=duskAt(s).x+d,y=ground(x,s),w=h*.164
    const {quad,tri,box,halo}=frame(x,y,s,.33)
    box(0,-5,0,w+1.6,h*.53+5,w+1.8,11,0xf3ceb6)
    box(0,h*.50,0,w+.50,h*.29,w+.55,13,0xffd9a6)
    box(0,h*.77,0,w+1.50,.52,w+1.5,11,0xe3c6a2)
    box(0,h*.79,0,w*.80,2.1,w*.8,14,0x745c55)
    const roofY=h*.79+2.1,r=w*.68,tip=roofY+h*.33
    const eaves=[[-r,roofY,r],[r,roofY,r],[r,roofY,-r],[-r,roofY,-r]]
    for(let i=0;i<4;i++)tri(eaves[i],eaves[(i+1)%4],[0,tip,0],9,0x887c8b)
    box(0,tip,0,.11,1.3,.11,15,0xbf9f77)
    box(0,tip+.81,0,.60,.11,.11,15,0xd5ad7a)
    const wingW=w*2.0,depth=w*2.9,z=-w*1.55
    box(0,-4,z,wingW,h*.34+4,depth,3,0xffd9aa)
    for(const side of [-1,1])quad([side*wingW*.57,h*.34,z+depth*.52],[side*wingW*.57,h*.34,z-depth*.52],[0,h*.34+wingW*.58,z-depth*.52],[0,h*.34+wingW*.58,z+depth*.52],9,0x98879b)
    halo(0,h*.65,w*.53,1.7)
  }
  for(const [s,d,h] of [[118,-32,27],[216,63,37],[412,-57,32],[568,39,24],[814,-48,28],[1044,44,35],[1238,-36,26]])belfry(s,d,h)

  // Retaining walls are sampled along the actual bend, their blocks grounded into the bank.
  function parapet(a,b,side,offset,height) {
    for(let s=a;s<b;s+=2.65) {
      const t=min(b,s+2.65),r=duskAt(s),q=duskAt(t)
      const d=side*(roadWidth(s)+offset),e=side*(roadWidth(t)+offset)
      const x=r.x+d,xx=q.x+e, yy=ground(x,s),zz=ground(xx,t)
      const buf=buffer(s),thickness=.44
      face(buf,[[x,yy-2.2,-s],[xx,zz-2.2,-t],[xx,zz+height,-t],[x,yy+height,-s]],11,0xb19383,square)
      face(buf,[[x+side*thickness,yy-2.8,-s],[xx+side*thickness,zz-2.8,-t],[xx+side*thickness,zz+height,-t],[x+side*thickness,yy+height,-s]],11,0xb19383,square)
      face(buf,[[x-.06,yy+height,-s],[xx-.06,zz+height,-t],[xx+side*thickness+.06,zz+height,-t],[x+side*thickness+.06,yy+height,-s]],11,0xdac4af,square)
    }
  }
  for(const [a,b,side] of [[14,43,1],[55,72,-1],[134,165,1],[211,250,-1],[323,350,1],[458,487,-1],[607,664,1],[706,740,-1],[873,893,1],[1138,1177,-1]])parapet(a,b,side,.60,.54)
  // The canal bridges sit in the quay below the riding line.
  for(const s of [53,95]) {
    const x=duskAt(s).x+canal(s),y=waterline(s)
    const {box}=frame(x,y,s,.02)
    box(0,.60,0,16.1,.67,2.7,14,0xac8367)
    for(const z of [-1.34,1.34]) {
      box(0,2.08,z,16.4,.17,.15,14,0xc8a77e)
      for(let i=-3;i<=3;i++)box(i*2.5,1.19,z,.14,.98,.14,14,0xb8966d)
    }
  }

  function lantern(s,side,pos) {
    const x=duskAt(s).x+side*pos,y=ground(x,s)
    const {box,halo}=frame(x,y,s,.15)
    box(0,-.05,0,.27,.31,.27,11,0xcdb28e)
    box(0,.19,0,.085,2.65,.085,14,0x564b43)
    box(0,2.77,0,.31,.13,.32,14,0x664b37)
    box(0,2.88,0,.22,.37,.23,15,0xffdb87,true)
    box(0,3.24,0,.35,.14,.35,9,0x705343)
    halo(0,3.08,0,2.2)
  }
  for(let s=31,i=0;s<1240;s+=12+random()*15,i++)lantern(s,i%3===0?1:-1,roadWidth(s)+1.17+random()*.81)

  for(const block of byBlock.values()){
    const g=new THREE.BufferGeometry()
    for(const [name,data,size] of [['position',block.v,3],['color',block.c,3],['uv',block.u,2]])g.setAttribute(name,new THREE.Float32BufferAttribute(data,size))
    g.setIndex(block.f);g.computeVertexNormals();g.computeBoundingSphere()
    const mesh=new THREE.Mesh(g,block.light?lampMat:material)
    mesh.receiveShadow=!block.light;scene.add(mesh)
    rendered.push({mesh,from:block.idx*88,light:block.light})
  }
  const glowing=makeLights(glows)
  scene.add(glowing)
  return s=>{
    for(const {mesh,from,light} of rendered){
      mesh.visible=from+88>s-72&&from<s+600
      mesh.castShadow=!light&&from+88>s-38&&from<s+79
    }
  }
}

function makeLights(points) {
  const g=new THREE.BufferGeometry(),positions=[],size=[]
  for(const [x,y,z,w] of points){positions.push(x,y,z);size.push(w)}
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  g.setAttribute('glowSize',new THREE.Float32BufferAttribute(size,1))
  const mat=new THREE.ShaderMaterial({
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
    vertexShader:`attribute float glowSize;void main(){
      vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(glowSize*340./max(-mv.z,1.),1.,42.);
    }`,
    fragmentShader:`void main(){
      float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
      float a=(exp(-r*r*8.)*.20+exp(-r*r*39.)*.28)*(1.-smoothstep(.78,1.,r));
      gl_FragColor=vec4(1.,.48,.12,a);
      #include <colorspace_fragment>
    }`,
  })
  const mesh=new THREE.Points(g,mat);mesh.renderOrder=3
  return mesh
}

function orchards(scene) {
  const random=sequence(91639),foliage=createFoliageBatch(scene),logs=[]
  function log(a,b,r) {logs.push({a:new THREE.Vector3(...a),b:new THREE.Vector3(...b),r})}
  function tree(s,d,h) {
    const x=duskAt(s).x+d, y=ground(x,s)
    log([x,y-.44,-s],[x-.17,y+h*.70,-s+.28],h*.050)
    for(let i=0;i<4;i++) {
      const a=i*PI/2+random()*.75,r=h*(.15+random()*.08)
      const px=x+r*cos(a),pz=-s+r*sin(a),py=y+h*(.55+random()*.24)
      log([x-.10,y+h*.41,-s+.1],[px,py,pz],h*.021)
      foliage.crown(px,py,pz,h*.22,h*.19,h*.24,s*3+i)
    }
    foliage.crown(x-.16,y+h*.84,-s+.19,h*.23,h*.21,h*.22,s*7)
  }
  tree(39,-6.8,7.6);tree(51,10.8,8.0);tree(102,-7.3,6.8)
  for(let i=0;i<138;i++){
    const s=random()*1305-35, d=(i%3===0?1:-1)*(8.1+random()*59)
    if(d>0&&s<112&&abs(d-canal(s))<9)continue
    tree(s,d,3.6+random()*5.7)
  }
  for(let i=0;i<9000;i++) {
    const s=random()*1300-38,d=(i%2===0?1:-1)*(roadWidth(s)+.30+random()**1.7*12)
    const x=duskAt(s).x+d,y=ground(x,s),w=.19+random()*.66
    if(random()<market(s)*.80)continue
    foliage.tuft(x,y-.03,-s,w,.20+w*.32,i+17)
    if(i%17===0)foliage.crown(x,y+.2*w,-s,w*.79,w*.43,w*.70,30+i)
  }
  const cylinder=new THREE.CylinderGeometry(.65,1,1,7)
  const material=new THREE.MeshLambertMaterial({map:terrainMap('bark'),color:0x8c7563})
  const stems=new THREE.InstancedMesh(cylinder,material,logs.length)
  const up=new THREE.Vector3(0,1,0),helper=new THREE.Object3D()
  logs.forEach(({a,b,r},i)=>{
    helper.position.copy(a).lerp(b,.5);const dir=b.clone().sub(a)
    helper.scale.set(r,dir.length(),r);helper.quaternion.setFromUnitVectors(up,dir.normalize())
    helper.updateMatrix();stems.setMatrixAt(i,helper.matrix)
  })
  stems.castShadow=true;scene.add(stems)
  foliage.flush()
  for(const item of scene.children)if(item.name==='Foliage · crown')item.castShadow=true
  return foliage
}

function water(scene) {
  const v=[],idx=[]
  for(let s=18,i=0;s<121;s+=1.5,i++) {
    const x=duskAt(s).x+canal(s)
    v.push(x-7.2,waterline(s),-s,x+7.2,waterline(s),-s)
    const k=i*2
    if(i)idx.push(k-2,k-1,k+1,k-2,k+1,k)
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geometry.setIndex(idx)
  const mat=new THREE.ShaderMaterial({
    side:THREE.DoubleSide,uniforms:{t:{value:0}},
    vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float t;varying vec3 p;void main(){
      float ripple=sin(p.z*3.1+.8*sin(p.x*2.7)+t*1.1);
      float sky=pow(max(0.,.5+.5*sin(p.x*.21+sin(p.z*.15)+ripple*.10)),8.);
      float lights=pow(max(0.,sin(p.z*.64+sin(p.x*.41)+ripple*.29)),19.);
      vec3 color=mix(vec3(.012,.034,.065),vec3(.075,.15,.22),sky)+lights*sky*vec3(.56,.25,.051);
      gl_FragColor=vec4(color,1.);
      #include <colorspace_fragment>
    }`,
  })
  scene.add(new THREE.Mesh(geometry,mat))
  return ()=>{mat.uniforms.t.value=performance.now()*.001}
}

export function createDusk(scene) {
  scene.background=new THREE.Color(0x915241)
  scene.fog=new THREE.FogExp2(0x83555a,.00265)
  const sun=new THREE.DirectionalLight(0xffa14d,3.1)
  sun.position.set(46,38,-122)
  scene.add(sun,new THREE.HemisphereLight(0xcbbede,0xc2947d,1.06))
  const sky=mountSky(scene,'dusk')
  sky.setTheme('dusk')
  mountDuskVista(scene)
  const hills=surface(scene),town=city(scene),trees=orchards(scene),waves=water(scene)
  return {
    length, ready:sky.ready,
    update(s){hills(s);town(s);trees.update(s);waves()},
  }
}
