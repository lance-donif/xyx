import * as THREE from 'three'

const vistaURL = new URL('./assets/sky/ember-valley.webp', import.meta.url).href

// A curved matte beyond the far ridge. It is anchored in the course's world frame
// so a changing heading and the 1,200 m descent give it a little parallax.
export function mountDuskVista(scene) {
  const segments = 68
  const radius = 4600
  const span = THREE.MathUtils.degToRad(143)
  const points = [], uvs = [], indices = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const angle = (u - 0.5) * span - 0.055
    const x = radius * Math.sin(angle)
    const z = -590 - radius * Math.cos(angle)
    for (const v of [0, 1]) {
      // The skyline sits at 44% of this image measured from the bottom.
      points.push(x, 37 + (v - 0.44) * radius * span / 3, z)
      uvs.push(u, v)
    }
    if (i > 0) {
      const j = i * 2
      indices.push(j-2, j, j-1, j, j+1, j-1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  const plate = new THREE.TextureLoader().load(vistaURL, () => {
    mesh.visible = true
    scene.dispatchEvent({ type: 'skychange' })
  })
  plate.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.ShaderMaterial({
    uniforms: { plate: { value: plate } },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 projected = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Keep the real terrain's near/far precision while placing the matte at infinity.
        gl_Position = vec4(projected.xy, projected.w * 0.9999999, projected.w);
      }`,
    fragmentShader: `
      uniform sampler2D plate;
      varying vec2 vUv;
      void main() {
        float sides = smoothstep(0., .075, min(vUv.x, 1. - vUv.x));
        float edges = smoothstep(0., .09, vUv.y) * smoothstep(0., .11, 1. - vUv.y);
        gl_FragColor = vec4(texture2D(plate, vUv).rgb, sides * edges);
        #include <colorspace_fragment>
      }`
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'Distant illuminated valley'
  mesh.frustumCulled = false
  mesh.renderOrder = -100
  mesh.visible = false
  scene.add(mesh)
  return mesh
}
