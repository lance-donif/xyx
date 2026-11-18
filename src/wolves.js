import * as THREE from 'three'

const tau = Math.PI * 2
const { sin, cos, atan2, hypot, sqrt, max, min } = Math
const lerp = THREE.MathUtils.lerp
const grey = [
  { saddle:'#444449', guard:'#666566', flank:'#92908a', buff:'#a89c84', pale:'#d9d2c2' },
  { saddle:'#534942', guard:'#74675b', flank:'#9c8d79', buff:'#b4a084', pale:'#dfd5bd' },
  { saddle:'#494d54', guard:'#676c71', flank:'#969a98', buff:'#afa793', pale:'#dddccf' },
]
const hide = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94})
// The coat pattern is bound to the rest pose so it follows the muscles during a stride.
hide.onBeforeCompile = shader => {
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
    '#include <common>\nvarying vec3 furPosition;').replace('#include <begin_vertex>',
    '#include <begin_vertex>\nfurPosition=position;')
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
    `#include <common>
    varying vec3 furPosition;
    float furHash(vec3 p){p=fract(p*vec3(.1031,.11369,.13787));p+=dot(p,p.yxz+19.19);return fract((p.x+p.y)*p.z);}
    float furNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(furHash(i),furHash(i+vec3(1,0,0)),f.x),mix(furHash(i+vec3(0,1,0)),furHash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(furHash(i+vec3(0,0,1)),furHash(i+vec3(1,0,1)),f.x),mix(furHash(i+vec3(0,1,1)),furHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
    .replace('#include <color_fragment>',`#include <color_fragment>
    vec3 fur=vec3(furPosition.x,furPosition.y+furPosition.z*.23,furPosition.z);
    float guard=furNoise(fur*vec3(69.,86.,17.));
    float stripe=furNoise(fur*vec3(205.,245.,35.));
    float visible=1.-smoothstep(.003,.021,max(fwidth(fur.x),fwidth(fur.y)));
    diffuseColor.rgb*=.82+.36*guard+.26*visible*(stripe-.5);`)
}

const shadowMat = new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
  vertexShader:`varying vec2 at;void main(){at=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 at;void main(){float r=dot(at,at)*4.;
    gl_FragColor=vec4(.027,.033,.046,.34*pow(max(0.,1.-r),2.));
    #include <colorspace_fragment>
  }`,
})

function makeAnimal(index) {
  const coat=grey[index%grey.length]
  const rootBone=new THREE.Bone()
  const bones=[rootBone], positions=[], colors=[], normals=[], indices=[], skinIndex=[], weights=[]
  const rgb=new THREE.Color()
  function joint(point) {
    const bone=new THREE.Bone()
    bone.position.set(...point)
    rootBone.add(bone)
    bone.userData.slot=bones.length
    bones.push(bone)
    return bone
  }
  function add(shape, bone, pigment) {
    const offset=positions.length/3
    const p=shape.attributes.position, n=shape.attributes.normal
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i)
      positions.push(x,y,z)
      normals.push(n.getX(i),n.getY(i),n.getZ(i))
      rgb.set(typeof pigment==='function'?pigment(x,y,z):pigment)
      colors.push(rgb.r,rgb.g,rgb.b)
      skinIndex.push(bone.userData.slot,0,0,0);weights.push(1,0,0,0)
    }
    if(shape.index) for(const idx of shape.index.array) indices.push(offset+idx)
    else for(let i=0;i<p.count;i++) indices.push(offset+i)
    shape.dispose()
  }
  function oval(p,r,bone,color,angles=[0,0,0]) {
    const g=new THREE.SphereGeometry(1,12,8).scale(...r)
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...angles)))
    g.translate(...p)
    add(g,bone,color)
  }
  function rings(rows,sides,bone,pigment) {
    const pts=[], ids=[]
    for(let i=0;i<rows.length;i++) {
      for(let j=0;j<sides;j++) {
        pts.push(...rows[i](j*tau/sides))
        if(i) {
          const k=i*sides+j,n=i*sides+(j+1)%sides
          ids.push(k-sides,n-sides,n,k-sides,n,k)
        }
      }
    }
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(pts,3))
    geometry.setIndex(ids);geometry.computeVertexNormals()
    add(geometry,bone,pigment)
  }
  // Elliptical, asymmetrical cross-sections form the ribcage, neck, wedge skull and brush.
  function lengthwise(profile,bone,pigment,sides=24) {
    const path=profile.map(([z,y,w,above,below=above])=>angle=>[
      cos(angle)*w, y+sin(angle)*(sin(angle)>0?above:below),z,
    ])
    rings(path,sides,bone,pigment)
  }
  const body=joint([0,.63,.04]), head=joint([0,.75,-.39])
  lengthwise([
    [-.57,.72,.015,.025],[-.52,.73,.111,.114],[-.43,.71,.160,.165,.180],
    [-.33,.68,.187,.203,.226],[-.20,.65,.174,.207,.222],[-.04,.655,.157,.158,.177],
    [.12,.657,.125,.125,.102],[.24,.65,.145,.145,.107],[.36,.64,.167,.153,.147],
    [.46,.62,.13,.121,.127],[.52,.605,.063,.075],[.55,.60,.012,.012],
  ],body,(x,y,z)=>{
    const hood=z<-.23 ? .045 : 0
    const broken=.021*sin(z*23.+x*28.)+.014*cos(z*46.-x*31.)
    if(y>.707+hood+broken+Math.abs(x)*.24) return coat.saddle
    if(y>.645+hood+broken) return coat.guard
    return y<.53+broken?coat.pale:coat.flank
  })
  lengthwise([
    [-.737,.805,.073,.091],[-.64,.8,.124,.135],[-.54,.763,.166,.182,.148],
    [-.46,.731,.184,.181,.174],[-.374,.706,.161,.154,.177],[-.319,.708,.096,.084],
  ],head,(x,y,z)=>{
    if(y>.84 && Math.abs(x)<.115) return coat.guard
    return y<.716||Math.abs(x)>.128?coat.pale:coat.flank
  })
  lengthwise([
    [-.953,.797,.026,.022],[-.932,.797,.046,.033,.024],[-.862,.8,.059,.049,.035],
    [-.796,.811,.079,.08,.058],[-.75,.828,.102,.104,.075],[-.69,.835,.122,.107,.094],
    [-.62,.828,.121,.107,.099],[-.564,.807,.072,.076],[-.54,.797,.015,.020],
  ],head,(x,y,z)=>y<.798?coat.pale : z<-.79?coat.flank : y>.882?coat.guard:coat.buff)
  // A dark open lip line separates the short lower jaw and the longer nasal bridge.
  oval([0,.772,-.866],[.052,.024,.086],head,'#30282a',[-.04,0,0])
  oval([0,.755,-.859],[.048,.019,.079],head,coat.buff,[-.06,0,0])
  oval([0,.80,-.949],[.039,.025,.024],head,'#24272a')
  for(const side of [-1,1]) {
    oval([side*.020,.806,-.967],[.008,.005,.003],head,'#101217')
    oval([side*.077,.852,-.800],[.020,.022,.037],head,'#313135',[.23,side*.31,0])
    oval([side*.089,.851,-.806],[.013,.012,.019],head,'#bc8c44',[.12,side*.31,0])
    oval([side*.097,.851,-.812],[.007,.010,.009],head,'#1d2021')
    oval([side*.099,.855,-.814],[.004,.004,.004],head,'#f2e6c7')
    oval([side*.078,.882,-.777],[.027,.011,.037],head,coat.pale,[.18,side*.19,side*.12])

    const bottom=side*.086
    const levels=[
      [.893,.039,.046,-.635],[.94,.051,.039,-.634],[1.00,.036,.025,-.633],
      [1.046,.018,.012,-.637],[1.074,.003,.004,-.64],
    ]
    // Wind-flattened pointed ears with pale outer fringe and a shaded warm inner cup.
    rings(levels.map(([y,w,d,z],i)=>a=>[bottom+side*i*.006+w*cos(a),y,z-d*sin(a)]),
      14,head,(x,y,z)=>z<-.651&&y>.932&&y<1.04?'#785e55':y>1.021?coat.saddle:coat.buff)
  }

  // Small overlapping ruff points follow the backward growth of the coat at neck and elbows.
  for(const sign of [-1,1]) {
    for(let i=0;i<13;i++) {
      const t=i/12
      const x=sign*(.094+.064*sin(t*Math.PI))
      const y=.87-.19*t
      const z=-.642+t*.117
      const tuft=[
        [x-sign*.030,y+.041,z-.06],[x+sign*.020,y+.027,z-.055],
        [x+sign*.023,y-.028,z-.019],[x-sign*.026,y-.035,z-.015],
        [x+sign*(.023+.018*sin(i*5.7)),y-.023-.026*cos(i*3.8),z+.118+.024*sin(i*3.1)],
      ]
      const geom=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(tuft.flat(),3))
      const faces=[0,1,4,1,2,4,2,3,4,3,0,4]
      if(sign===1)faces.reverse()
      geom.setIndex(faces);geom.computeVertexNormals();add(geom,head,t>.46?coat.pale:coat.flank)
    }
  }

  const tail=joint([0,.654,.406]), brush=joint([0,.515,.706])
  lengthwise([
    [.407,.656,.047,.048],[.46,.632,.075,.07],[.55,.588,.091,.083],
    [.64,.545,.094,.084],[.713,.514,.091,.081],[.74,.497,.083,.069],
  ],tail,(x,y,z)=>y>.62-(z-.4)*.50?coat.guard:coat.buff)
  lengthwise([
    [.688,.523,.083,.073],[.73,.502,.086,.075],[.80,.479,.081,.069],
    [.87,.464,.069,.059],[.93,.457,.052,.041],[.99,.458,.028,.025],[1.03,.466,.003,.004],
  ],brush,(x,y,z)=>z>.90?coat.saddle:y>.51?coat.guard:coat.buff)

  function limb(from,to,profile,bone,pigment) {
    const dy=to[1]-from[1], dz=to[2]-from[2], length=hypot(dy,dz)
    // The ring normal follows the leg, including the heel which slopes backwards.
    rings(profile.map(([t,width,depth])=>a=>[
      lerp(from[0],to[0],t)+width*cos(a),
      lerp(from[1],to[1],t)+dz/length*depth*sin(a),
      lerp(from[2],to[2],t)-dy/length*depth*sin(a),
    ]),14,bone,pigment)
  }
  const legs=[]
  for(const front of [true,false]) for(const sign of [-1,1]) {
    const x=sign*(front?.129:.121)
    const hip=[x,front?.70:.68,front?-.311:.348]
    const knee=[x,front?.438:.446,front?-.214:.171]
    const heel=[x,front?.127:.207,front?-.352:.443]
    const foot=[x,.049,front?-.381:.384]
    const joints=[hip,knee,heel,foot].map(joint)
    const limbAngles=[hip,knee,heel].map((p,i)=> {
      const end=[knee,heel,foot][i]
      return atan2(end[2]-p[2],end[1]-p[1])
    })
    const dark=front?coat.flank:coat.guard
    limb(hip,knee,[[-.18,.056,.058],[.05,.083,.100],[.33,.082,.087],[.72,.058,.071],[1.06,.049,.046]],joints[0],dark)
    limb(knee,heel,[[-.12,.047,.045],[.10,.051,.054],[.37,.046,.051],[.77,.029,.034],[1.09,.026,.031]],joints[1],coat.buff)
    limb(heel,foot,[[-.12,.025,.031],[.08,.034,.034],[.40,.024,.027],[1.04,.023,.023]],joints[2],coat.buff)
    oval([x,.046,foot[2]-.014],[.041,.031,.058],joints[3],coat.flank)
    for(let toe=0;toe<3;toe++) {
      oval([x+.021*(toe-1),.028,foot[2]-.054-Math.sin(toe*Math.PI/2)*.009],
        [.015,.019,.029],joints[3],coat.buff)
    }
    legs.push({front,sign,x,hip,knee,heel,foot,joints,limbAngles})
  }

  const geo=new THREE.BufferGeometry()
  geo.setIndex(indices)
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3))
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4))
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4))
  const mesh=new THREE.SkinnedMesh(geo,hide)
  mesh.add(rootBone);mesh.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton(bones))
  mesh.frustumCulled=false
  mesh.receiveShadow=true
  return {mesh,body,head,tail,brush,legs}
}

export function createWolf(index=0) {
  const {mesh,body,head,tail,brush,legs}=makeAnimal(index)
  const group=new THREE.Group()
  const scale=[1,.92,1.04,.97][index%4]
  mesh.scale.setScalar(scale)
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(.70*scale,1.54*scale),shadowMat)
  contact.rotation.x=-Math.PI/2;contact.position.y=.013
  group.add(contact,mesh)
  const lead=index%2?1:-1, seed=index*1.91
  let previous,beat=seed

  function update(time,speed) {
    const drive=THREE.MathUtils.smoothstep(Math.abs(speed),0,4)
    const dt=previous===undefined?0:Math.min(.2,Math.max(0,time-previous))
    previous=time
    beat+=dt*min(3.32,1.65+Math.abs(speed)*.060)*tau
    const bound=drive*(.035*sin(beat+.7)+.012*cos(2*beat))
    const pitch=drive*(.077*sin(beat-.45))
    body.position.y=.63+bound;body.rotation.x=pitch
    head.position.y=.75+bound*.65+pitch*.28
    head.rotation.set(pitch*.37+.018*cos(beat),.043*sin(time*1.6+seed),.019*cos(beat))
    tail.position.y=.654+bound-pitch*.37
    tail.rotation.set(pitch*1.2+.059*cos(beat-.4),.11*sin(beat*.5+seed),0)
    const rootToBrush=.30
    brush.position.set(rootToBrush*sin(tail.rotation.y),tail.position.y-.137-rootToBrush*sin(tail.rotation.x),.406+rootToBrush*cos(tail.rotation.y))
    brush.rotation.set(tail.rotation.x+.07*sin(beat-.85),tail.rotation.y+.12*sin(beat*.5+seed-.6),0)
    for(const leg of legs) {
      const {front,sign,hip,knee,heel,foot,joints,limbAngles}=leg
      const cycle=(beat/tau+(front?.03:.53)+(sign===lead?.11:0))%1
      const grounded=cycle<.40
      const f=grounded?cycle/.40:(cycle-.40)/.60
      const flight=grounded?0:sin(f*Math.PI)
      const reach=front?.52:.66
      const stroke=grounded?f-.5:.50*cos(Math.PI*f)
      const pawY=foot[1]+drive*flight*(front?.18:.21)
      const pawZ=foot[2]+drive*(stroke*reach-.025)
      const heelY=pawY+(heel[1]-foot[1])-drive*flight*(front?.008:.032)
      const heelZ=pawZ+(heel[2]-foot[2])+drive*flight*(front?.070:.12)
      const hipY=hip[1]+bound-pitch*(hip[2]-.04)
      const dz=heelZ-hip[2],dy=heelY-hipY,span=hypot(dy,dz)||1
      const thigh=front?.292:.312,shin=front?.371:.365
      const along=Math.min(span,(thigh*thigh-shin*shin+span*span)/(2*span))
      const bend=sqrt(max(0,thigh*thigh-along*along))*(front?-1:1)
      const kneeY=hipY+(dy*along-dz*bend)/span
      const kneeZ=hip[2]+(dz*along+dy*bend)/span
      place(0,hip[2],hipY,kneeZ,kneeY)
      place(1,kneeZ,kneeY,heelZ,heelY)
      place(2,heelZ,heelY,pawZ,pawY)
      joints[3].position.set(leg.x,pawY,pawZ)
      joints[3].rotation.x=drive*(flight*-.57+.16*sin(tau*cycle))
      function place(i,z,y,endZ,endY) {
        const bone=joints[i], restFrom=[hip,knee,heel][i], restTo=[knee,heel,foot][i]
        const angle=atan2(endZ-z,endY-y)
        bone.position.set(leg.x,y,z)
        bone.rotation.x=angle-limbAngles[i]
        // Scale along local Y only for overextended strides; keep muscle width stable.
        const lengthRatio=hypot(endZ-z,endY-y)/hypot(restTo[2]-restFrom[2],restTo[1]-restFrom[1])
        bone.scale.set(1,lengthRatio,1)
      }
    }
  }
  update(0,0)
  return {group,update}
}
