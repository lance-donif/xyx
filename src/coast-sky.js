import * as THREE from 'three'

const cloudFile = new URL('./assets/coast/cumulus.webp', import.meta.url).href

// The coastal light plate spans the seaward arc. The reverse arc closes it around the headland.
// Use exactly the same direction mapping on the water so the cloud towers have reflections.
export const marineLight = `
  uniform sampler2D marineSky;
  uniform float plateReady;
  vec3 marineLight(vec3 d){
    const float circle=6.2831853;
    float a=mod(atan(d.x,-d.z)+.07+circle,circle);
    float u=a<1.55 ? a/1.55 : 1.-(a-1.55)/(circle-1.55);
    float h=asin(clamp(d.y,-1.,1.));
    float v=clamp(.081+h*2.12,.087,.998);
    vec3 plate=texture2D(marineSky,vec2(u,v)).rgb;
    vec3 blue=mix(vec3(.24,.48,.82),vec3(.016,.075,.36),smoothstep(0.,.40,h));
    vec3 sky=mix(blue,plate,plateReady);
    sky=mix(sky,vec3(.014,.065,.32),smoothstep(.36,.88,h));
    float solar=max(dot(d,normalize(vec3(-.03,.34,-.94))),0.);
    sky=mix(sky,vec3(1.,.96,.89),.20*pow(solar,15.)+.42*pow(solar,75.));
    vec3 mist=mix(vec3(.36,.45,.65),vec3(.78,.72,.67),pow(1.-u,5.));
    return mix(sky,mist,(1.-smoothstep(-.085,.026,h))*.88);
  }`

export function addMarineSky(root,scene) {
  const uniforms={marineSky:{value:null},plateReady:{value:0}}
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1,42,24), new THREE.ShaderMaterial({
    uniforms,side:THREE.BackSide,depthWrite:false,depthTest:false,
    vertexShader:`varying vec3 ray;
      void main(){ray=position;vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=clip.xyww;}`,
    fragmentShader:`varying vec3 ray;
      ${marineLight}
      void main(){gl_FragColor=vec4(marineLight(normalize(ray)),1.);
        #include <colorspace_fragment>
      }`,
  }))
  dome.frustumCulled=false
  dome.renderOrder=-1000
  root.add(dome)
  const ready=new THREE.TextureLoader().loadAsync(cloudFile).then(map=>{
    map.colorSpace=THREE.SRGBColorSpace
    uniforms.marineSky.value=map
    uniforms.plateReady.value=1
    scene.dispatchEvent({type:'skychange'})
  }).catch(e=>console.warn('Coastal cloud plate could not be loaded',e))
  return {uniforms,ready}
}

// Fade the last headland into the light behind it rather than a flat, opaque fog silhouette.
export function mistOnHorizon(root,sky) {
  const seen=new Set()
  root.traverse(mesh=>{
    const material=mesh.material
    if(!material?.isMeshStandardMaterial || seen.has(material)) return
    seen.add(material)
    const prior=material.onBeforeCompile
    const programKey=material.customProgramCacheKey()
    material.customProgramCacheKey=()=>programKey+'-coastal-air'
    material.onBeforeCompile=(shader,renderer)=>{
      prior.call(material,shader,renderer)
      Object.assign(shader.uniforms,sky.uniforms)
      shader.vertexShader=shader.vertexShader
        .replace('#include <common>','#include <common>\nvarying vec3 coastRay;')
        .replace('#include <fog_vertex>','#include <fog_vertex>\ncoastRay=(vec4(mvPosition.xyz,0.)*viewMatrix).xyz;')
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>','#include <common>\nvarying vec3 coastRay;\n'+marineLight)
        .replace('#include <fog_fragment>',`
          #ifdef USE_FOG
          float air=smoothstep(fogNear,fogFar,vFogDepth);
          vec3 haze=fogColor;
          if(vFogDepth>560.) {
            vec3 sky=sRGBTransferOETF(vec4(marineLight(normalize(coastRay)),1.)).rgb;
            haze=mix(haze,sky,smoothstep(560.,1180.,vFogDepth));
          }
          gl_FragColor.rgb=mix(gl_FragColor.rgb,haze,air);
          #endif`)
    }
  })
}
