import * as THREE from 'three'
import { marineLight } from './coast-sky.js'

const url = new URL('./assets/coast/harbour.webp',import.meta.url).href
const waterline = 1-672/724
const faceHeight = 214
const span = 696
const firstPeak = 98
const edgeOfPlate = .975

// The coast folds away from the rider. Sample the same station and elevation for its water image.
export const reflectedShore = `
  uniform sampler2D shorePlate;
  uniform float shoreReady;
  float bayEdge(float s){return 427.+84.*sin(s/167.+.65)+30.*sin(s/66.)+9.1*sin(s/17.);}
  float shoreHeight(float s){return .96+.069*sin(s/241.-.4)+.052*cos(s/113.);}
  float shoreU(float s){return ${edgeOfPlate}*abs(fract((s-${firstPeak}.)/${2*span}.)*2.-1.);}
  vec4 cliffReflection(vec3 wave,vec3 ray) {
    if(ray.x<.07 || shoreReady<.5)return vec4(0.);
    float depth=(bayEdge(-wave.z)-wave.x)/ray.x;
    float s=-wave.z-depth*ray.z;
    depth=(bayEdge(s)+min(23.,max(0.,ray.y*depth)*.13)-wave.x)/ray.x;
    if(depth<0.||depth>1250.)return vec4(0.);
    s=-wave.z-depth*ray.z;
    float v=${waterline}+max(0.,ray.y*depth)/(${faceHeight}.*shoreHeight(s));
    if(v>=1.)return vec4(0.);
    vec4 sampleColor=texture2D(shorePlate,vec2(shoreU(s),v));
    sampleColor.a*=1.-smoothstep(560.,1250.,depth);
    return sampleColor;
  }`

function heightScale(s) {
  return .96+.069*Math.sin(s/241.-.4)+.052*Math.cos(s/113.)
}

export function makeHarbour(parent,scene,coast,seaLevel,sky) {
  const uniforms={...sky.uniforms,shorePlate:{value:null},shoreReady:{value:0},
    harbourTime:{value:0},nearAir:{value:scene.fog.near},farAir:{value:scene.fog.far},
    mistColor:{value:scene.fog.color}}
  const material=new THREE.ShaderMaterial({
    uniforms,side:THREE.DoubleSide,
    vertexShader:`attribute float openPlateau; varying float clearRidge; varying vec2 landUV; varying vec3 ray; varying float distanceInAir;
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);
        vec4 view=viewMatrix*world;
        distanceInAir=-view.z; ray=world.xyz-cameraPosition;landUV=uv;clearRidge=openPlateau;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`varying float clearRidge; varying vec2 landUV; varying vec3 ray; varying float distanceInAir;
      uniform sampler2D shorePlate; uniform float harbourTime; uniform float nearAir; uniform float farAir;
      uniform vec3 mistColor;
      ${marineLight}
      void main(){
        vec4 albedo=texture2D(shorePlate,landUV);
        if(albedo.a<.38)discard;
        // Only one sanctuary on the upper promontory, just beyond the aqueduct.
        if(clearRidge>.5 && landUV.x>.897 && landUV.x<.951 && landUV.y>.905)discard;
        float v=landUV.y;
        float streamX=.21+(v-.26)*.060;
        float spray=(1.-smoothstep(.004,.020,abs(landUV.x-streamX)))*smoothstep(.18,.31,v)*(1.-smoothstep(.64,.71,v));
        albedo.rgb+=spray*smoothstep(.16,.7,albedo.r)*vec3(.038,.047,.056)*(.5+.5*sin(v*172.-harbourTime*3.2));
        // Sea air softly separates more distant headlands. The vanishing skyline shares the sky colour.
        float haze=smoothstep(nearAir,farAir,distanceInAir);
        vec3 air=mix(mistColor,marineLight(normalize(ray)),smoothstep(520.,1190.,distanceInAir));
        gl_FragColor=vec4(mix(albedo.rgb,air,haze*haze),1.);
        #include <colorspace_fragment>
      }`,
  })
  const coastGroup=new THREE.Group()
  coastGroup.name='Harbour, limestone terraces and high waterfalls'
  coastGroup.visible=false
  parent.add(coastGroup)
  // Each digitised elevation follows a different depth across waterfront, town terraces and escarpment.
  // Riders see actual parallax while turning. The transparent rock skyline reveals the separate moving sky.
  const rows=[0,.06,.08,.12,.17,.23,.30,.38,.45,.51,.6,.72,.84,1]
  const slices=104
  for (let tile=-2;tile<5;tile++) {
    const positions=[],uv=[],openPlateau=[],indices=[]
    for (let i=0;i<=slices;i++) {
      const along=i/slices
      const s=firstPeak+(tile+along)*span
      const u=(tile%2===0?1-along:along)*edgeOfPlate
      const waterX=coast(s)
      for(let j=0;j<rows.length;j++){
        const v=rows[j], h=(v-waterline)*faceHeight*heightScale(s)
        const terraces=6*THREE.MathUtils.smoothstep(h,-2,55)+4*THREE.MathUtils.smoothstep(h,52,90)
        const buttress=Math.sin(s/21)*5.3+Math.sin(s/61)*7.2+Math.sin(s/9.8)*1.1
        const crags=(10+buttress*.58)*THREE.MathUtils.smoothstep(h,71,155)
        positions.push(waterX+terraces+crags,seaLevel+h,-s)
        uv.push(u,v)
        openPlateau.push(tile%2===0?0:1)
        if(i&&j){
          const k=i*rows.length+j
          indices.push(k-rows.length-1,k-1,k,k-rows.length-1,k,k-rows.length)
        }
      }
    }
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    geometry.setAttribute('openPlateau',new THREE.Float32BufferAttribute(openPlateau,1))
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    coastGroup.add(new THREE.Mesh(geometry,material))
  }
  const ready=new THREE.TextureLoader().loadAsync(url).then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace
    texture.anisotropy=8
    uniforms.shorePlate.value=texture
    uniforms.shoreReady.value=1
    coastGroup.visible=true
    scene.dispatchEvent({type:'skychange'})
  }).catch(e=>console.warn('Coastal harbour relief could not be loaded',e))
  return {uniforms,ready,update(t){uniforms.harbourTime.value=t}}
}
