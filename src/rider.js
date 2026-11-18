import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const rubber = '#181a20', tread = '#2b2f32', graphite = '#222a32'
const silver = '#b9bfbd', darkMetal = '#555960', navy = '#202832'
const orange = '#a83224', scarlet = '#74190f', cream = '#f1eee3'
const skin = '#ae7655', leather = '#26272a'
const up = new T.Vector3(0, 1, 0)

// A small, shared mountain-sky reflection supplies a horizon for lacquer, glass
// and brushed metal even on renderers without scene-wide environment lighting.
function mountainReflection() {
  const size = 64
  const faces = Array.from({length: 6}, (_, face) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const image = ctx.createImageData(size, size)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (2 * x + 1) / size - 1, w = (2 * y + 1) / size - 1
      const vectors = [[1,-w,-u],[-1,-w,u],[u,1,w],[u,-1,-w],[u,-w,1],[-u,-w,-1]]
      const [dx,dy,dz] = vectors[face]
      const h = dy / Math.hypot(dx,dy,dz), angle = Math.atan2(dz,dx)
      const ridge = .07 + .13 * Math.sin(angle * 3.0 + .4) + .07 * Math.cos(angle * 8)
      const high = h >= ridge
      const k = high ? Math.sqrt(Math.max(0, h - ridge)) : Math.max(0, -h)
      const rgb = high ? [230-116*k,237-85*k,239-40*k] : [48+48*k,57+34*k,58+30*k]
      const glint = Math.max(0, Math.cos(angle + 2.4)) ** 25 * Math.exp(-24*(h-.43)**2)
      const i=(y*size+x)*4
      for(let c=0;c<3;c++) image.data[i+c]=rgb[c]+(255-rgb[c])*glint
      image.data[i+3]=255
    }
    ctx.putImageData(image,0,0)
    return canvas
  })
  const texture = new T.CubeTexture(faces)
  texture.colorSpace = T.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

let finish
function riderMaterial() {
  if (finish) return finish
  finish = new T.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 1, envMap: mountainReflection(), envMapIntensity: .78,
  })
  // Per-vertex roughness and metalness let leather and chrome share a draw call.
  finish.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 surface; varying vec2 vSurface; varying vec3 vWeave;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface; vWeave = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSurface; varying vec3 vWeave;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        // Tucked fabric breaks up long highlights. Fade out the thread pattern
        // where its projected spacing falls below a pixel.
        float textile = smoothstep(.40, .70, vSurface.x) * (1. - smoothstep(.10, .26, vSurface.y));
        float warp = dot(vWeave, vec3(510.,340.,195.));
        float weft = dot(vWeave, vec3(-340.,480.,235.));
        float thread = sin(warp) * sin(weft) / (1. + fwidth(warp) + fwidth(weft));
        diffuseColor.rgb *= 1. + .13 * textile * thread;
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= vSurface.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= max(0.,vSurface.y);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += max(0.,-vSurface.y)*diffuseColor.rgb;')
  }
  return finish
}
const cloth = [.79,.01], hide = [.51,.07], alloy = [.26,.82], lacquer = [.21,.49], glass = [.095,.76]
const finishes = new Map([[silver, alloy], [darkMetal, [.38,.69]], [graphite,[.55,.30]],
  [orange,lacquer],[scarlet,lacquer],[rubber,[.92,.01]],[leather,hide],[navy,cloth]])

function v(point) { return new T.Vector3(...point) }

// Bake each rigid assembly into a single vertex-coloured mesh.
function assembly() {
  const parts = []
  function add(shape, color, matrix = new T.Matrix4(), surface = finishes.get(color) ?? cloth) {
    shape.applyMatrix4(matrix)
    for (const name of Object.keys(shape.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') shape.deleteAttribute(name)
    }
    const rgb = new T.Color(color)
    const count = shape.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = rgb.r; colors[i+1] = rgb.g; colors[i+2] = rgb.b
    }
    const channels = new Float32Array(count * 2)
    for (let i=0; i<channels.length; i+=2) { channels[i]=surface[0]; channels[i+1]=surface[1] }
    if (!shape.hasAttribute('color')) shape.setAttribute('color', new T.BufferAttribute(colors, 3))
    shape.setAttribute('surface', new T.BufferAttribute(channels, 2))
    parts.push(shape)
  }
  const rotation = angles => new T.Quaternion().setFromEuler(new T.Euler(...angles))
  const transform = (p, r, scale) => new T.Matrix4().compose(v(p), rotation(r), v(scale))
  function oval(p, dims, color, angle = [0,0,0], surface) {
    const large = Math.max(...dims) > .075
    add(new T.SphereGeometry(1, large ? 18 : 12, large ? 12 : 8), color, transform(p, angle, dims), surface)
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
    const result = new T.Mesh(mergeGeometries(parts), riderMaterial())
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
  const spokes = moto ? 7 : 22
  for (let i=0; i<spokes; i++) {
    const angle = 2*Math.PI*i/spokes
    const end = [0,rim*Math.cos(angle),rim*Math.sin(angle)]
    const hub = [i%2 ? .033 : -.033, .027*Math.cos(angle+.8), .027*Math.sin(angle+.8)]
    a.tube(hub,end,moto?.015:.002,moto?.023:.002,silver,5)
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
  a.oval([0,.815,.237],[.028,.015,.013],'#e53532',[0,0,0],lacquer)
  for (const sign of [-1,1]) {
    const cable = new T.CatmullRomCurve3([[sign*.2,.915,-.552],[sign*.154,.832,-.586],[sign*.041,.634,-.389]].map(v))
    a.add(new T.TubeGeometry(cable,16,.003,5,false),graphite)
  }
}

// Longitudinal profiles for tank, seat, fenders and bodywork.
function fairing(a, rings, upper, side, lower) {
  const blue = '#214267', flanks = '#152e4a'
  const top = upper===orange ? blue : upper
  const edge = side===scarlet ? flanks : side
  const sections=rings.map(([z,y,w,h])=>[z,w,h,-y])
  const [first,...rest]=sections, last=rest[rest.length-1]
  const rounded=[[first[0]-.005,.005,.003,first[3]],first,...rest,[last[0]+.005,.005,.003,last[3]]]
  loft(a,rounded,[0,0,0],[Math.PI/2,0,0],angle=>{
    const vertical=-Math.cos(angle)
    return vertical>.52 ? top : vertical < -.56 ? lower : edge
  },upper===orange?lacquer:hide)
}

function registrationPlate() {
  const canvas=document.createElement('canvas')
  canvas.width=160; canvas.height=92
  const ctx=canvas.getContext('2d')
  ctx.fillStyle='#d6d5be';ctx.fillRect(0,0,160,92)
  ctx.fillStyle='#3b5682';ctx.fillRect(0,0,17,92)
  ctx.fillStyle='#464945';ctx.font='bold 12px sans-serif';ctx.textAlign='center'
  ctx.fillText('RIDGELINE',88,19)
  ctx.fillStyle='#24292a';ctx.font='bold 37px sans-serif';ctx.fillText('RL 042',88,61,124)
  for(const x of [23,150]) { ctx.beginPath();ctx.arc(x,8,2.5,0,2*Math.PI);ctx.fill() }
  const map=new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace
  const plate=new T.Mesh(new T.PlaneGeometry(.129,.086),new T.MeshStandardMaterial({map,roughness:.64}))
  plate.position.set(0,.64,.806);plate.rotation.x=-.26
  return plate
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
  // The upswept LED tail sits below the pillion cowl, with a separate hanging plate.
  a.oval([0,.773,.80],[.106,.037,.029],graphite,[-.10,0,0])
  a.oval([0,.774,.822],[.091,.023,.013],'#e43525',[-.06,0,0],[.2,-.72])
  for(const s of [-1,1]) {
    a.tube([s*.014,.769,.836],[s*.076,.78,.828],.004,.003,'#ffaca1',7)
    a.tube([s*.026,.737,.75],[s*.040,.65,.79],.009,.008,graphite)
  }
  a.box([0,.64,.799],[.129,.086,.012],'#e0dcc5',[-.26,0,0])
  for (const s of [-1,1]) {
    a.tube([s*.099,.75,.745],[s*.182,.75,.745],.010,.010,graphite)
    a.oval([s*.182,.75,.749],[.025,.019,.026],'#ffb02d')
  }
  fairing(a,[[-.69,.76,.061,.043],[-.63,.815,.152,.101],[-.52,.866,.169,.114],[-.41,.876,.128,.053]],
    orange,scarlet,graphite)
  a.oval([0,.934,-.534],[.133,.09,.045],'#384e61',[-.55,0,0],glass)
  for(const s of [-1,1]) {
    a.oval([s*.087,.835,-.616],[.063,.029,.022],'#eee9ce',[-.4,0,s*.19],glass)
    const sideCover = [s*.155,.608,-.116]
    a.oval(sideCover,[.027,.114,.176],'#213c57',[-.34,0,0],lacquer)
    a.tube([s*.164,.607,-.025],[s*.174,.65,-.185],.007,.002,'#bcced4',6)
  }
  a.box([0,.919,-.476],[.119,.046,.077],darkMetal,[-.3,0,0])

}

// Sections describe height, half-width, half-depth and the fore/aft centre.
// Interpolated oval rings form a continuous silhouette and smooth normals.
function loft(a, sections, base, angles, pigment, surface, sculpt) {
  const profile = new T.CatmullRomCurve3(sections.map(([h,w,d]) => new T.Vector3(w,h,d)))
  const spine = new T.CatmullRomCurve3(sections.map(([h,w,d,cz=0]) => new T.Vector3(0,h,cz)))
  const rows = (sections.length-1)*2, sides = sculpt ? 32 : 20
  const positions = [], index = [], colors = []
  const color = new T.Color()
  for (let row=0;row<=rows;row++) {
    const t=row/rows, ring=profile.getPoint(t), cz=spine.getPoint(t).z
    for(let i=0;i<sides;i++) {
      const theta = 2*Math.PI*i/sides
      const [sw,sd] = sculpt ? sculpt(theta,t) : [1,1]
      positions.push(Math.sin(theta)*ring.x*sw, ring.y, Math.cos(theta)*ring.z*sd+cz)
      color.set(typeof pigment === 'function' ? pigment(theta,t) : pigment)
      colors.push(color.r,color.g,color.b)
      if (row===rows) continue
      const m = row*sides+i, n = row*sides+(i+1)%sides
      index.push(m,n,m+sides,n,n+sides,m+sides)
    }
  }
  const geo=new T.BufferGeometry()
  geo.setIndex(index)
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3))
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  geo.computeVertexNormals()
  const matrix=new T.Matrix4().compose(v(base),new T.Quaternion().setFromEuler(new T.Euler(...angles)),new T.Vector3(1,1,1))
  a.add(geo,'#ffffff',matrix,surface)
}

const kitColours = {
  moto:  { fabric:'#242632', side:'#171d25', seam:'#484952' },
  ivory: { fabric:'#e7e2d9', side:'#b0b5b0', seam:'#ccd1cc' },
  red:   { fabric:'#bb3728', side:'#7e2018', seam:'#ce6950' },
  blue:  { fabric:'#224ed4', side:'#162f82', seam:'#608beb', cuff:'#e8f4f7' },
}

function jacket(a, moto, colours) {
  const {fabric,side,seam}=colours
  const tilt = moto ? -.52 : -.97
  const base = moto ? [0,.875,.196] : [0,.934,.18]
  const cross = [
    [0,.144,.099], [.045,.153,.104], [.095,.148,.116], [.19,.163,.131],
    [.29,.195,.139,-.006], [.35,.215,.125,-.011],
    [.387,.198,.105,-.015], [.423,.122,.083,-.017], [.436,.079,.069,-.014],
  ]
  const matrix = new T.Matrix4().compose(v(base),new T.Quaternion().setFromEuler(new T.Euler(tilt,0,0)),new T.Vector3(1,1,1))
  const at = (x,y,z) => new T.Vector3(x,y,z).applyMatrix4(matrix).toArray()
  const paint = (angle,t) => {
    const flank=Math.abs(Math.sin(angle))
    if (t<.055) return side
    if (flank>.94-t*.07 && t<.90) return side
    return fabric
  }
  // Paired shoulder blades, flatter spine and small compressed lumbar folds.
  const sculpt = (angle,t) => {
    const fold=Math.sin(t*100+Math.cos(angle*2)*1.4)*Math.exp(-((t-.24)**2)/.014)
    const blade=Math.exp(-((t-.67)**2)/.047)*Math.max(0,Math.cos(angle))*Math.sin(angle*2)**2
    return [1+.021*fold,1+.033*fold+.085*blade]
  }
  loft(a,cross,base,[tilt,0,0],paint,moto?hide:cloth,sculpt)
  function stitch(path,color,r=.0028) {
    for(let i=1;i<path.length;i++) a.tube(at(...path[i-1]),at(...path[i]),r,r,color,5)
  }
  for (const sign of [-1,1]) {
    stitch([[sign*.122,.026,.062],[sign*.123,.092,.079],[sign*.126,.19,.09],[sign*.148,.29,.088],[sign*.161,.37,.068],[sign*.177,.386,.028]],seam)
    stitch([[sign*.17,.377,.059],[sign*.119,.346,.103],[sign*.061,.339,.12],[0,.337,.124]],seam,.002)
    if (!moto) {
      stitch([[sign*.128,.134,.077],[sign*.077,.144,.108],[0,.141,.124]],side,.004)
      stitch([[sign*.044,.041,.101],[sign*.046,.103,.117],[sign*.045,.142,.123]],seam,.0024)
    }
  }
  if(moto) {
    stitch([[0,.073,.109],[0,.163,.13],[0,.25,.136],[0,.336,.126]],'#2f3239',.0036)
    // Reinforced leather kidney band below the jacket hem.
    a.oval(at(0,.013,.006),[.15,.03,.105],'#191c22',[tilt,0,0],hide)
  }
}

function limb(a, start, end, profile, color, surface) {
  const vector=v(end).sub(v(start))
  const length=vector.length()
  const q=new T.Quaternion().setFromUnitVectors(up,vector.normalize())
  const angles=new T.Euler().setFromQuaternion(q)
  const rings=profile.map(([t,w,d,cz=0]) => [t*length,w,d,cz])
  loft(a,rings,start,[angles.x,angles.y,angles.z],color,surface)
}

function buildUpper(moto,name='ivory') {
  const a=assembly()
  const colours=kitColours[moto?'moto':name]
  const {fabric,side,seam,cuff}=colours
  jacket(a,moto,colours)
  const sleevePaint=(_angle,t)=>cuff && t>.61 ? cuff : fabric
  const shoulderY=moto?1.20:1.153, shoulderZ=moto?-.002:-.134
  const headY=moto?1.411:1.313, headZ=moto?-.135:-.277
  const handX=moto?.306:.207, handY=moto?.968:.92, handZ=moto?-.429:-.53
  for (const sign of [-1,1]) {
    const shoulder=[sign*.185,shoulderY,shoulderZ], elbow=[sign*(moto?.299:.256),moto?1.025:1.009,moto?-.13:-.201]
    const hand=[sign*handX,handY,handZ]
    const sleeve=v(shoulder).lerp(v(elbow),moto?.89:.61).toArray()
    const inner=[shoulder[0]-sign*.052,shoulder[1]+.006,shoulder[2]+.011]
    limb(a,inner,sleeve,[[0,.048,.058],[.20,.073,.078],[.43,.073,.076],[.67,.066,.070],[1,.054,.058]],sleevePaint,moto?hide:cloth)
    limb(a,sleeve,elbow,[[0,.054,.058],[.44,.05,.055],[1,.051,.049]],moto?side:skin,moto?hide:cloth)
    a.oval(elbow,[.053,.05,.051],moto?side:skin)
    limb(a,elbow,hand,[[0,.05,.05],[.28,.052,.053],[.55,.043,.045],[.83,.033,.032],[1,.032,.028]],moto?fabric:skin,moto?hide:cloth)
    if(moto) {
      a.oval([elbow[0]+sign*.032,elbow[1]+.022,elbow[2]+.02],[.026,.064,.05],side,[-.35,0,0],hide)
      a.tube([sign*.24,shoulderY+.026,shoulderZ],[sign*.291,elbow[1]+.046,elbow[2]+.028],.0025,.0025,seam,5)
    }
    a.oval(hand,[.039,.032,.053],moto?'#171b21':'#323439',[-.12,0,0],hide)
    for(let j=0;j<3;j++) a.oval([hand[0]+sign*.012,hand[1]-.022,hand[2]-.028+j*.02],[.025,.017,.012],moto?graphite:skin)
  }
  a.tube([0,headY-.18,headZ+.115],[0,headY-.056,headZ+.018],.075,.059,moto?'#282931':skin)
  a.oval([0,headY-.165,headZ+.095],[.085,.05,.084],fabric,[-.47,0,0],moto?hide:cloth)
  if (moto) {
    // A full-face shell includes the flared lower edge, curved chin and rear spoiler.
    const shell='#203048'
    loft(a,[[-.122,.073,.082,-.009],[-.087,.105,.118,-.019],[-.028,.125,.145,-.016],
      [.044,.133,.144,.004],[.106,.118,.124,.004],[.148,.080,.084],[.165,.012,.025]], [0,headY,headZ],[-.10,0,0],shell,lacquer)
    a.oval([0,headY+.022,headZ-.061],[.13,.062,.101],'#283f50',[-.16,0,0],glass)
    a.oval([0,headY+.063,headZ+.092],[.108,.020,.066],'#293a50',[-.1,0,0],lacquer)
    for(const sign of [-1,1]){
      a.oval([sign*.118,headY+.012,headZ-.023],[.012,.025,.029],graphite)
      a.oval([sign*.072,headY+.062,headZ+.118],[.030,.009,.011],'#121b25')
      a.tube([sign*.037,headY-.057,headZ+.121],[sign*.078,headY-.046,headZ+.109],.003,.002,'#9babb6',5)
    }
    a.oval([0,headY-.059,headZ+.121],[.028,.006,.004],'#a8a69a')
  } else {
    loft(a,[[-.127,.022,.039,-.036],[-.101,.058,.063,-.027],[-.070,.077,.074,-.012],
      [-.025,.089,.084], [.028,.09,.092,.008],[.085,.069,.075,.01],[.102,.024,.036]],
      [0,headY,headZ],[-.17,0,0],skin,cloth)
    a.oval([0,headY-.038,headZ-.087],[.019,.026,.025],skin,[-.23,0,0])
    a.oval([0,headY+.005,headZ+.045],[.086,.083,.067],'#423126',[-.13,0,0])
    a.oval([0,headY+.065,headZ+.012],[.108,.086,.146],'#202a32',[-.19,0,0])
    for (const sign of [-1,1]) {
      a.oval([sign*.026,headY+.078,headZ+.006],[.023,.079,.149],'#dedbd1',[-.2,0,sign*.09],lacquer)
      a.oval([sign*.073,headY+.064,headZ+.007],[.022,.065,.134],'#f0eee1',[-.2,0,sign*.22],lacquer)
      a.tube([sign*.089,headY+.027,headZ+.051],[sign*.081,headY-.080,headZ+.005],.005,.005,graphite,5)
      a.tube([sign*.081,headY-.080,headZ+.005],[sign*.085,headY+.025,headZ-.067],.005,.005,graphite,5)
      a.oval([sign*.086,headY-.013,headZ+.006],[.012,.027,.018],skin)
    }
    a.oval([0,headY+.007,headZ-.063],[.096,.033,.061],'#253d4c',[-.23,0,0],glass)
  }
  return a.mesh()
}

function legParts(moto) {
  const thigh = assembly(), shin = assembly(), shoe = assembly()
  // Profiles follow hip, quadriceps, patella, calf, then Achilles; the pose
  // animation scales only their longitudinal axis to place the joints.
  const pants = moto?'#2d394e':'#292c33'
  const thighPaint=(angle,t)=>!moto && t>.78 ? skin : !moto && t>.735 ? '#36393d' : pants
  loft(thigh,[[0,.093,.10],[.16,.099,.106],[.46,.086,.094],[.67,.074,.083],[.81,.063,.068],[1,.055,.056]],
    [0,0,0],[0,0,0],thighPaint,moto?hide:cloth)
  const lowerPaint=(angle,t)=>moto ? t>.5?'#282729':pants : t>.69?cream:skin
  shin.oval([0,.018,0],[.056,.16,.055],moto?pants:skin)
  thigh.oval([0,.018,0],[.093,.15,.096],pants)
  loft(shin,[[0,.055,.057],[.16,.054,.064],[.30,.059,.073],[.48,.054,.063],[.7,.040,.048],[.86,.033,.037],[1,.034,.035]],
    [0,0,0],[0,0,0],lowerPaint,moto?hide:cloth)
  shoe.oval([0,-.005,-.044],[.054,.045,.112],moto?'#25252a':'#d6d2c7',[-.09,0,0],hide)
  shoe.oval([0,-.036,-.044],[.052,.016,.11],rubber)
  shoe.oval([0,.007,.026],[.043,.056,.039],moto?leather:'#bfc1b9')
  for (let i=0;i<2;i++) shoe.oval([0,.026-i*.009,-.042-i*.028],[.044,.007,.014],moto?graphite:'#5b5c59')
  return [thigh.mesh(),shin.mesh(),shoe.mesh()]
}

const shadowColors = new Uint8Array(32*32*4)
for(let y=0;y<32;y++) for(let x=0;x<32;x++) {
  const i=(y*32+x)*4, r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5)
  shadowColors.set([4,6,9,Math.round(160*Math.pow(Math.max(0,1-r*r),2))],i)
}
const shadowMap = new T.DataTexture(shadowColors,32,32,T.RGBAFormat)
shadowMap.colorSpace=T.SRGBColorSpace
shadowMap.magFilter=T.LinearFilter
shadowMap.minFilter=T.LinearFilter
shadowMap.needsUpdate=true
const shadowMaterial = new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})

// The sun projects the live pose onto a small road-conforming decal. Both tyre
// rings remain hollow, so the cast shadow shows spokes and gaps in the frame.
function silhouette(group, moto, radius, wheelBase, legs) {
  const size=320, span=7.6, scale=size/span
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=size
  const ctx=canvas.getContext('2d')
  const texture=new T.CanvasTexture(canvas)
  texture.colorSpace=T.SRGBColorSpace
  texture.generateMipmaps=false
  texture.minFilter=T.LinearFilter
  const floor=new T.PlaneGeometry(span,span,4,4).rotateX(-Math.PI/2)
  const points=floor.attributes.position, resting=points.array.slice()
  const mesh=new T.Mesh(floor,new T.MeshBasicMaterial({
    map:texture, transparent:true, opacity:.68, depthWrite:false,
    polygonOffset:true, polygonOffsetFactor:-2, toneMapped:false,
  }))
  mesh.renderOrder=2
  group.add(mesh)
  let sun=new T.Vector3(-.8,.8,-.49), road
  let nextPaint=0, oldYaw=Infinity, oldTilt=Infinity
  const inverse=new T.Quaternion(), dir=new T.Vector3()
  function update(dt, tilt, bob, force=false) {
    const c=Math.cos(tilt), q=Math.sin(tilt)
    const yaw=group.rotation.y, cy=Math.cos(yaw), sy=Math.sin(yaw)
    // Compensate pitch and the suspension bounce independently of the lighting.
    // The mesh itself stays in the chassis coordinate system.
    if(road) {
      const cp=Math.cos(group.rotation.x), sp=Math.sin(group.rotation.x)
      for(let i=0;i<points.count;i++) {
        const localX=resting[i*3], localZ=resting[i*3+2]
        const worldZ=group.position.z-localX*sy+localZ*cp*cy
        const elevation=road(-worldZ).y + .024
        points.setY(i,(elevation-group.position.y+localZ*sp)/cp)
      }
      points.needsUpdate=true
    } else mesh.position.y=.021
    nextPaint-=dt
    if (!force && nextPaint>0 && Math.abs(tilt-oldTilt)<.03 && Math.abs(yaw-oldYaw)<.03) return
    nextPaint=1/13
    oldYaw=yaw;oldTilt=tilt
    inverse.copy(group.quaternion).invert()
    dir.copy(sun).normalize().applyQuaternion(inverse)
    const sx=dir.x/Math.max(.24,dir.y), sz=dir.z/Math.max(.24,dir.y)
    function point(x,y,z) {
      const xx=x*c-y*q, yy=x*q+y*c
      return [(xx-yy*sx)*scale+size/2,(z-yy*sz)*scale+size/2]
    }
    function line(from,to,width) {
      const [x,y]=point(...from), [u,v]=point(...to)
      ctx.beginPath(); ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.lineWidth=width*scale;ctx.stroke()
    }
    function oval(x,y,z,rx,ry,rz) {
      const [u,v]=point(x,y,z)
      const ax=rx*(c-q*sx), ay=-rx*q*sz, bx=ry*(-q-c*sx), by=-ry*c*sz
      const a=ax*ax+bx*bx, b=ax*ay+bx*by, d=ay*ay+by*by+rz*rz
      const delta=Math.hypot(a-d,2*b)
      ctx.beginPath()
      ctx.ellipse(u,v,scale*Math.sqrt((a+d+delta)/2),scale*Math.sqrt(Math.max(.00001,(a+d-delta)/2)),.5*Math.atan2(2*b,a-d),0,Math.PI*2)
      ctx.fill()
    }
    ctx.clearRect(0,0,size,size)
    ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=ctx.fillStyle='#060d1b'
    for(const end of [-1,1]){
      const z=wheelBase*end, tire=moto?.097:.032
      ctx.beginPath()
      for(let i=0;i<=44;i++) {
        const t=i*Math.PI/22, [px,py]=point(0,radius+(radius-tire/2)*Math.sin(t),z+(radius-tire/2)*Math.cos(t))
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py)
      }
      ctx.lineWidth=tire*scale;ctx.stroke()
      for(let i=0;i<(moto?5:9);i++) {
        const t=i*Math.PI/(moto?5:9)
        line([0,radius+.29*Math.sin(t),z+.29*Math.cos(t)],[0,radius-.29*Math.sin(t),z-.29*Math.cos(t)],moto?.019:.009)
      }
    }
    const seat=[0,moto?.78:.86,.16], crank=[0,moto?.48:.305,.04], head=[0,.80,-.38]
    for(const [from,to] of [[seat,crank],[crank,head],[head,seat],[crank,[0,radius,wheelBase]],[seat,[0,radius,wheelBase]],[head,[0,radius,-wheelBase]]]) line(from,to,moto?.08:.036)
    if(moto) {
      oval(0,.65,0,.17,.19,.40);oval(0,.78,.43,.17,.085,.32)
      line([0,.33,.27],[.18,.52,.69],.08)
    }
    const chest=[0,moto?1.16:1.10,moto?.015:-.11], hip=[0,moto?.90:.94,.16]
    line(hip,chest,.31)
    oval(0,chest[1]+bob,chest[2],.208,.15,.13)
    oval(0,moto?1.425:1.36,moto?-.14:-.28,.122,.145,.14)
    for(let i=0;i<2;i++){
      const sign=i?1:-1, [,shin,shoe]=legs[i]
      const knee=shin.position.toArray(), ankle=shoe.position.toArray()
      line([sign*.096,hip[1],hip[2]],knee,.147);line(knee,ankle,.089)
      oval(...ankle,.05,.049,.115)
      const elbow=[sign*(moto?.30:.256),1.02,moto?-.13:-.2]
      line([sign*.18,chest[1],chest[2]],elbow,.112)
      line(elbow,[sign*(moto?.30:.207),moto?.97:.92,moto?-.43:-.53],.075)
    }
    texture.needsUpdate=true
  }
  return {
    update,
    setLighting(position,roadFn) { if(position) sun=position;road=roadFn;nextPaint=0 },
  }
}

export function createRider(type) {
  const moto = type === 'moto'
  const group = new T.Group(), pivot = new T.Group()
  const contact = new T.Mesh(new T.PlaneGeometry(moto?1.15:.91,moto?2.35:2.1),shadowMaterial)
  contact.rotation.x=-Math.PI/2
  contact.position.y=.012
  group.add(contact,pivot)
  const frame = assembly()
  if (moto) {
    motoFrame(frame)
    pivot.add(registrationPlate())
  } else cycleFrame(frame)
  pivot.add(frame.mesh())
  const radius=moto?.322:.345, wheelBase=moto?.68:.56
  const wheels=[wheel(moto,false),wheel(moto,true)]
  wheels.forEach((w,i)=>{
    w.position.set(0,radius,(i?1:-1)*wheelBase)
    pivot.add(w)
  })
  let upper=buildUpper(moto)
  const kits=new Map([['ivory',upper]]), hips=assembly()
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
  const cast=silhouette(group,moto,radius,wheelBase,legs)
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
      shoe.rotation.x=moto ? -.08 : -.10+.17*Math.sin(phase+(side<0?Math.PI:0))
    })
    cast.update(dt,tilt,bob)
  }
  function setKit(name) {
    if(moto || !['ivory','red','blue'].includes(name)) return
    if(!kits.has(name)) kits.set(name,buildUpper(false,name))
    if(upper!==kits.get(name)) {
      pivot.remove(upper)
      upper=kits.get(name)
      pivot.add(upper)
    }
  }
  update(0,0,0,0)
  return {group,update,setKit,setLighting:cast.setLighting}
}
