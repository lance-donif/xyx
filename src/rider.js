import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const rubber = '#202936', tread = '#35414c', graphite = '#273744'
const silver = '#b6c4c1', darkMetal = '#596769', navy = '#213448'
const orange = '#e45128', scarlet = '#a12c20', cream = '#f3e3b8'
const skin = '#b77351', leather = '#442e25'
const up = new T.Vector3(0, 1, 0)
const finish = new T.MeshStandardMaterial({vertexColors: true, roughness: 0.73, metalness: 0.12})

function v(point) { return new T.Vector3(...point) }

// Bake each rigid assembly into a single vertex-coloured mesh.
function assembly() {
  const parts = []
  function add(geometry, color, matrix = new T.Matrix4()) {
    const shape = geometry.index ? geometry.toNonIndexed() : geometry
    shape.applyMatrix4(matrix)
    for (const name of Object.keys(shape.attributes)) {
      if (name !== 'position' && name !== 'normal') shape.deleteAttribute(name)
    }
    const rgb = new T.Color(color)
    const count = shape.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = rgb.r; colors[i+1] = rgb.g; colors[i+2] = rgb.b
    }
    shape.setAttribute('color', new T.BufferAttribute(colors, 3))
    parts.push(shape)
  }
  const rotation = angles => new T.Quaternion().setFromEuler(new T.Euler(...angles))
  const transform = (p, r, scale) => new T.Matrix4().compose(v(p), rotation(r), v(scale))
  function oval(p, dims, color, angle = [0,0,0]) {
    add(new T.SphereGeometry(1, 12, 8), color, transform(p, angle, dims))
  }
  function box(p, dims, color, angle = [0,0,0]) {
    add(new T.BoxGeometry(...dims), color, transform(p, angle, [1,1,1]))
  }
  function tube(a, b, r1, r2, color, sides = 10) {
    const start = v(a), end = v(b), line = end.clone().sub(start)
    const cylinder = new T.CylinderGeometry(r2, r1, line.length(), sides)
    const q = new T.Quaternion().setFromUnitVectors(up, line.normalize())
    add(cylinder, color, new T.Matrix4().compose(start.lerp(end,.5), q, new T.Vector3(1,1,1)))
  }
  function hoop(p, radius, thickness, color, widthScale = 1) {
    add(new T.TorusGeometry(radius, thickness, 8, 40), color,
      transform(p, [0,Math.PI/2,0], [1,1,widthScale]))
  }
  function mesh() {
    const result = new T.Mesh(mergeGeometries(parts), finish)
    result.castShadow = true
    return result
  }
  return {add, oval, box, tube, hoop, mesh}
}

function wheel(moto, rear) {
  const a = assembly()
  const radius = moto ? .322 : .345
  const thick = moto ? .061 : .023
  const track = moto && rear ? 1.56 : moto ? 1.24 : 1.0
  a.hoop([0,0,0], radius-thick, thick, rubber, track)
  const rim = radius-2*thick
  for (const sign of [-1,1]) {
    const side = sign*thick*track*.79
    a.hoop([side,0,0], rim+thick*.5, moto ? .009 : .007, moto ? tread : '#bd9162')
    a.hoop([side*.72,0,0], rim-.008, moto ? .019 : .012, moto ? silver : darkMetal)
  }
  a.tube([-.063,0,0],[.063,0,0],moto?.046:.022,moto?.046:.022,darkMetal)
  const spokes = moto ? 9 : 18
  for (let i=0; i<spokes; i++) {
    const angle = 2*Math.PI*i/spokes
    const end = [0,rim*Math.cos(angle),rim*Math.sin(angle)]
    const hub = [i%2 ? .033 : -.033, .027*Math.cos(angle+.8), .027*Math.sin(angle+.8)]
    a.tube(hub,end,moto?.009:.003,moto?.011:.003,silver,5)
  }
  if (moto) {
    const x = -.053
    a.tube([x-.004,0,0],[x+.004,0,0],.117,.117,silver,24)
    for (let i=0;i<8;i++) {
      const t = Math.PI*i/4, y=.086*Math.cos(t), z=.086*Math.sin(t)
      a.tube([x-.006,y,z],[x-.004,y,z],.013,.013,graphite,8)
    }
  }
  return a.mesh()
}

function cycleFrame(a) {
  const crank = [0,.305,.04], seat = [0,.77,.17], head = [0,.78,-.36]
  a.tube(crank,seat,.032,.029,orange)
  a.tube(crank,[0,.69,-.39],.044,.032,orange)
  a.tube(seat,head,.026,.033,orange)
  a.tube([0,.69,-.39],head,.037,.037,scarlet)
  a.tube(seat,[0,.865,.20],.02,.019,graphite)
  a.oval([0,.865,.177],[.10,.031,.155],leather,[-.055,0,0])
  for (const s of [-1,1]) {
    const axle = [s*.061,.345,.56]
    a.tube(axle,[s*.016,.744,.16],.014,.013,orange)
    a.tube(axle,[s*.045,.305,.04],.016,.017,orange)
    a.tube([s*.061,.345,-.56],[s*.031,.70,-.39],.018,.022,graphite)
    a.tube([s*.031,.70,-.39],[0,.78,-.36],.023,.025,scarlet)
    a.tube([s*.045,.927,-.48],[s*.195,.927,-.48],.014,.014,silver)
    a.tube([s*.195,.927,-.48],[s*.203,.914,-.566],.021,.020,leather)
    a.tube([s*.203,.914,-.566],[s*.207,.838,-.568],.016,.016,graphite)
    a.tube([s*.207,.838,-.568],[s*.207,.818,-.467],.014,.017,leather)
  }
  a.tube(head,[0,.915,-.32],.019,.018,silver)
  a.tube([0,.915,-.32],[0,.927,-.48],.019,.019,graphite)
  a.tube([-.061,.305,.04],[.061,.305,.04],.036,.036,silver)
  a.hoop([.062,.305,.04],.079,.008,silver)
  a.hoop([.058,.345,.56],.044,.012,darkMetal)
  a.tube([.062,.385,.04],[.062,.39,.56],.005,.005,darkMetal,4)
  a.tube([.062,.226,.04],[.062,.301,.56],.005,.005,darkMetal,4)
  // Water bottle, pump and rear reflector.
  a.tube([0,.501,-.103],[0,.631,-.21],.029,.031,cream)
  a.tube([0,.631,-.21],[0,.651,-.23],.021,.015,scarlet)
  a.box([0,.813,.233],[.047,.030,.022],'#f5512f')
}

// Longitudinal profiles for tank, seat, fenders and bodywork.
function fairing(a, rings, upper, side, lower) {
  const verts = [[],[],[]]
  const cross = ([z,y,w,h]) => [
    [-w*.62,y+h,z],[w*.62,y+h,z],[w,y+h*.48,z],[w*.82,y-h*.50,z],
    [w*.48,y-h,z],[-w*.48,y-h,z],[-w*.82,y-h*.50,z],[-w,y+h*.48,z]
  ]
  const sections = rings.map(cross)
  // Face winding points outwards as sections progress from front to back.
  for(let k=0;k<sections.length-1;k++) {
    const front=sections[k], back=sections[k+1]
    for(let i=0;i<8;i++) {
      const j=(i+1)%8, dst=verts[i===0 ? 0 : i>=3 && i<=5 ? 2 : 1]
      dst.push(...front[i],...back[j],...front[j], ...front[i],...back[i],...back[j])
    }
  }
  for(let end=0;end<2;end++){
    const cap=sections[end ? sections.length-1 : 0]
    for (let i=1;i<7;i++) {
      const j=end ? 7-i : i, k=end ? 6-i : i+1
      verts[1].push(...cap[0],...cap[j],...cap[k])
    }
  }
  for (let i=0;i<3;i++) {
    const g = new T.BufferGeometry()
    g.setAttribute('position',new T.Float32BufferAttribute(verts[i],3))
    g.computeVertexNormals()
    a.add(g,[upper,side,lower][i])
  }
}

function motoFrame(a) {
  // Broad twin-spar frame, brushed engine fins, fork stanchions and shocks.
  for (const s of [-1,1]) {
    a.tube([s*.10,.32,.68],[s*.10,.43,.00],.032,.043,darkMetal)
    a.tube([s*.11,.32,.58],[s*.14,.72,.33],.032,.034,silver)
    for (let i=0;i<6;i++) {
      const z=.55-i*.027,y=.382+i*.043
      a.tube([s*.12,y,z],[s*.12,y+.023,z-.014],.044,.044,graphite)
    }
    a.tube([s*.12,.325,-.68],[s*.12,.665,-.55],.03,.028,silver)
    a.tube([s*.12,.62,-.566],[s*.12,.90,-.46],.036,.039,'#b6a16e')
    a.tube([s*.12,.86,-.45],[s*.13,.38,.05],.041,.030,graphite)
    a.tube([s*.13,.38,.05],[s*.13,.39,.24],.032,.032,graphite)
    a.tube([s*.13,.39,.24],[s*.13,.72,.35],.032,.036,graphite)
    a.tube([0,.90,-.42],[s*.30,.965,-.44],.019,.019,silver)
    a.tube([s*.25,.962,-.44],[s*.36,.976,-.43],.025,.025,rubber)
    a.tube([s*.31,.975,-.43],[s*.36,1.126,-.51],.010,.009,graphite)
    a.oval([s*.36,1.14,-.515],[.072,.041,.021],darkMetal)
    a.box([s*.173,.403,.21],[.10,.031,.12],rubber)
  }
  a.oval([0,.46,-.054],[.166,.137,.173],graphite)
  a.tube([-.165,.435,.015],[.165,.435,.015],.103,.103,darkMetal,20)
  for (let i=0;i<5;i++) {
    a.box([0,.56+i*.018,-.13-i*.007],[.294,.009,.188],i%2 ? silver : darkMetal,[-.23,0,0])
  }
  a.tube([.105,.60,-.19],[.112,.336,-.31],.029,.029,'#b79771')
  a.tube([.112,.336,-.31],[.17,.31,.17],.029,.030,'#b79771')
  a.tube([.17,.31,.17],[.18,.511,.66],.029,.052,darkMetal)
  a.tube([.18,.402,.365],[.18,.514,.665],.060,.061,silver)
  a.tube([.18,.514,.666],[.18,.522,.684],.046,.041,graphite)
  fairing(a,[[-.44,.765,.08,.040],[-.32,.762,.16,.138],[-.14,.746,.185,.154],[.11,.719,.146,.080]],
          orange,scarlet,graphite)
  a.oval([0,.886,-.20],[.045,.008,.055],silver)
  fairing(a,[[.0,.751,.12,.048],[.21,.757,.153,.064],[.40,.80,.145,.057],[.56,.817,.106,.04]],
          '#443b37',leather,graphite)
  fairing(a,[[.14,.662,.137,.058],[.38,.685,.175,.096],[.56,.754,.148,.072],[.80,.774,.096,.033]],
          orange,scarlet,graphite)
  fairing(a,[[-.95,.55,.055,.017],[-.78,.663,.096,.022],[-.64,.683,.10,.018],[-.48,.609,.078,.019]],
          orange,scarlet,graphite)
  a.box([0,.76,.799],[.138,.052,.026],'#ff4135')
  a.box([0,.714,.777],[.113,.024,.031],graphite)
  a.box([0,.666,.788],[.116,.074,.013],cream,[-.24,0,0])
  for (const s of [-1,1]) {
    a.tube([s*.099,.75,.745],[s*.182,.75,.745],.010,.010,graphite)
    a.oval([s*.182,.75,.749],[.025,.019,.026],'#ffb02d')
  }
  a.oval([0,.866,-.53],[.112,.094,.071],graphite)
  a.oval([0,.874,-.587],[.089,.072,.030],'#ffe6a3')
  a.box([0,.919,-.476],[.119,.046,.077],darkMetal,[-.3,0,0])
}

// Sectioned jacket follows the riding posture. Positive local Z is the back.
function jersey(a, moto) {
  const rows = [
    [0,.162,.117], [.05,.175,.117],[.16,.18,.120],
    [.30,.218,.133],[.385,.208,.119],[.432,.123,.076],
  ]
  const tilt = moto ? -.35 : -.77
  const base = moto ? [0,.918,.156] : [0,.95,.159]
  const mat = new T.Matrix4().compose(v(base),
    new T.Quaternion().setFromEuler(new T.Euler(tilt,0,0)),new T.Vector3(1,1,1))
  const sectors = 16
  const colors = new Map()
  for (let row=0; row<rows.length-1; row++) {
    const point=(r,i)=>{
      const [h,w,d]=rows[r], ang=2*Math.PI*i/sectors
      return [w*Math.sin(ang),h,d*Math.cos(ang)]
    }
    for (let i=0;i<sectors;i++) {
      const side=i>=3 && i<=4 || i>=11 && i<=12
      let c = moto ? '#34475a' : '#ece2bd'
      if (row===0) c=moto ? graphite : orange
      else if (side) c=moto ? '#243140' : orange
      else if (row===3 && moto) c='#6f7978'
      else if (row===4) c=moto ? '#253545' : cream
      if(!colors.has(c)) colors.set(c,[])
      colors.get(c).push(...point(row,i),...point(row,i+1),...point(row+1,i+1),
                         ...point(row,i),...point(row+1,i+1),...point(row+1,i))
    }
  }
  for (const [color,positions] of colors) {
    const geo = new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3))
    geo.computeVertexNormals()
    a.add(geo,color,mat)
  }
  // Rear pockets and twin race bands sit flush with the curved fabric.
  const back=(x,y,z)=>new T.Vector3(x,y,z).applyMatrix4(mat).toArray()
  a.box(back(0,.106,.108),[.22,.102,.027],moto ? '#263543' : '#d05a36',[tilt,0,0])
  for (const x of [-.072,.072]) {
    a.tube(back(x,.066,.121),back(x,.148,.127),.005,.005,moto ? '#929785' : cream,5)
  }
}

function buildUpper(moto) {
  const a=assembly()
  jersey(a,moto)
  const shoulderY=moto?1.263:1.235, shoulderZ=moto?.021:-.093
  const headY=moto?1.485:1.441, headZ=moto?-.046:-.193
  const elbowY=moto?1.04:1.036, elbowZ=moto?-.16:-.195
  const handX=moto?.30:.207, handY=moto?.974:.93, handZ=moto?-.43:-.515
  for (const s of [-1,1]) {
    const shoulder=[s*.188,shoulderY,shoulderZ], elbow=[s*(moto?.30:.242),elbowY,elbowZ]
    const hand=[s*handX,handY,handZ]
    const sleeve=[s*.231, shoulderY-.115, shoulderZ-.049]
    a.oval(shoulder,[.077,.079,.078],moto?'#34475a':cream)
    a.tube(shoulder,sleeve,.073,.066,moto?'#34475a':cream)
    a.tube(sleeve,elbow,.057,.048,moto?navy:skin)
    a.oval(elbow,[.051,.048,.052],moto?graphite:skin)
    a.tube(elbow,hand,.049,.030,moto?navy:skin)
    a.oval(hand,[.035,.035,.052],moto?graphite:'#623e2a')
  }
  a.tube([0,headY-.178,headZ+.055],[0,headY-.052,headZ],.069,.067,skin)
  if (moto) {
    a.oval([0,headY,headZ],[.13,.15,.139],'#172b3d',[-.09,0,0])
    a.oval([0,headY+.026,headZ-.054],[.128,.061,.106],'#669099',[-.11,0,0])
    a.oval([0,headY+.065,headZ+.01],[.133,.098,.146],'#253e56',[-.10,0,0])
    a.oval([0,headY+.072,headZ+.015],[.027,.097,.148],cream,[-.10,0,0])
    a.box([0,headY-.051,headZ+.122],[.09,.018,.010],'#c49e69')
  } else {
    a.oval([0,headY-.034,headZ],[.091,.120,.090],skin,[-.13,0,0])
    a.oval([0,headY-.004,headZ+.049],[.092,.084,.059],leather)
    a.oval([0,headY+.033,headZ+.009],[.111,.097,.151],'#263747',[-.16,0,0])
    // Vented road helmet: four distinct moulded ribs over a dark liner.
    for (const s of [-1,1]) {
      a.oval([s*.029,headY+.053,headZ+.003],[.027,.082,.152],orange,[-.18,0,s*.10])
      a.oval([s*.078,headY+.039,headZ+.001],[.021,.070,.128],cream,[-.18,0,s*.22])
      a.tube([s*.089,headY+.008,headZ+.048],[s*.083,headY-.099,headZ-.005],.007,.007,graphite,5)
    }
    a.oval([0,headY-.004,headZ-.053],[.099,.034,.059],'#243d46',[-.18,0,0])
  }
  return a.mesh()
}

function legParts(moto) {
  const thigh = assembly(), shin = assembly(), shoe = assembly()
  // Rigid limb pieces are aligned along local +Y and scaled to their joint span.
  thigh.tube([0,0,0],[0,.65,0],.094,.077,navy)
  thigh.tube([0,.65,0],[0,.80,0],.077,.065,moto?navy:'#323e42')
  thigh.tube([0,.80,0],[0,1,0],.065,.055,moto?graphite:skin)
  shin.tube([0,0,0],[0,.43,0],.055,.058,moto?navy:skin)
  shin.tube([0,.43,0],[0,.67,0],.058,.042,moto?graphite:skin)
  shin.tube([0,.67,0],[0,1,0],.043,.032,moto?leather:cream)
  shoe.oval([0,-.012,-.039],[.046,.042,.095],moto?leather:graphite,[-.06,0,0])
  shoe.box([0,-.039,-.034],[.072,.017,.143],rubber)
  return [thigh.mesh(),shin.mesh(),shoe.mesh()]
}

const shadowColors = new Uint8Array(32*32*4)
for(let y=0;y<32;y++) for(let x=0;x<32;x++) {
  const i=(y*32+x)*4, r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5)
  shadowColors.set([26,40,46,Math.round(105*Math.pow(Math.max(0,1-r*r),2))],i)
}
const shadowMap = new T.DataTexture(shadowColors,32,32,T.RGBAFormat)
shadowMap.magFilter=T.LinearFilter
shadowMap.minFilter=T.LinearFilter
shadowMap.needsUpdate=true
const shadowMaterial = new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})

export function createRider(type) {
  const moto = type === 'moto'
  const group = new T.Group(), pivot = new T.Group()
  const contact = new T.Mesh(new T.PlaneGeometry(moto?1.15:.91,moto?2.35:2.1),shadowMaterial)
  contact.rotation.x=-Math.PI/2
  contact.position.y=.012
  group.add(contact,pivot)
  const frame = assembly()
  if (moto) motoFrame(frame)
  else cycleFrame(frame)
  pivot.add(frame.mesh())
  const radius=moto?.322:.345, wheelBase=moto?.68:.56
  const wheels=[wheel(moto,false),wheel(moto,true)]
  wheels.forEach((w,i)=>{
    w.position.set(0,radius,(i?1:-1)*wheelBase)
    pivot.add(w)
  })
  const upper=buildUpper(moto), hips=assembly()
  hips.oval([0,moto?.896:.926,.165],[.159,.104,.142],navy,[-.14,0,0])
  pivot.add(upper,hips.mesh())
  const legs=[legParts(moto),legParts(moto)]
  for (const leg of legs) pivot.add(...leg)
  const crank = new T.Group()
  if (!moto) {
    const pedals = assembly()
    for(const side of [-1,1]){
      pedals.tube([side*.083,0,0],[side*.083,0,side*.159],.012,.014,silver)
      pedals.box([side*.111,0,side*.159],[.062,.015,.044],graphite)
    }
    crank.add(pedals.mesh())
    crank.position.set(0,.305,.04)
    pivot.add(crank)
  }
  const hip=new T.Vector3(), knee=new T.Vector3(), ankle=new T.Vector3(), direction=new T.Vector3()
  function align(part,a,b) {
    direction.copy(b).sub(a)
    part.position.copy(a)
    part.scale.y=direction.length()
    part.quaternion.setFromUnitVectors(up,direction.normalize())
  }
  let angle=0, phase=0, tilt=0
  function update(dt,speed,steer,time=0) {
    const moving=Math.abs(speed)
    tilt=T.MathUtils.damp(tilt,-T.MathUtils.clamp(steer,-1,1)*(moto?.37:.26),8,dt)
    pivot.rotation.z=tilt
    angle=(angle-moving*dt/radius)%(Math.PI*2)
    wheels.forEach(w=>w.rotation.x=angle)
    phase=(phase + (moving>.3 ? Math.min(8,2.9+moving*.29)*dt : 0))%(Math.PI*2)
    crank.rotation.x=phase
    const bob=moto ? Math.sin(time*18)*Math.min(moving*.0003,.003) : Math.sin(2*phase)*.009
    upper.position.y=bob
    upper.rotation.z=moto?0:.015*Math.cos(phase)
    legs.forEach(([thigh,shin,shoe],i)=>{
      const side=i?1:-1
      hip.set(side*.092,moto?.907:.924,.159)
      if (moto) {
        ankle.set(side*.191,.468,.225)
        knee.set(side*.177,.65,-.126)
      } else {
        ankle.set(side*.111,.367-side*.159*Math.sin(phase),.079+side*.159*Math.cos(phase))
        // Choose the forward solution of the two-link knee in the sagittal plane.
        const dy=ankle.y-hip.y, dz=ankle.z-hip.z, length=Math.hypot(dy,dz)
        const half=length*.5, rise=Math.sqrt(Math.max(0,.394**2-half**2))
        knee.set(side*.119,hip.y+dy*.5-dz*rise/length,hip.z+dz*.5+dy*rise/length)
      }
      align(thigh,hip,knee); align(shin,knee,ankle)
      shoe.position.copy(ankle)
    })
  }
  update(0,0,0,0)
  return {group,update}
}
