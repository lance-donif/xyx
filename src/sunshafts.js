import * as THREE from 'three';

// Dust in the openings between crowns. Each ribbon follows the light from a canopy gap
// toward the opposite verge. The depth buffer lets trunks, houses and the rider occlude it.
export function addCanopyLight(scene, roadAt) {
  const vertices = [], uv = [], indices = [];
  const groves = [26, 96, 174, 244, 322, 754, 835, 911, 992];
  for (const [index, s] of groves.entries()) {
    const road = roadAt(s);
    for (let layer = 0; layer < 2; layer++) {
      const x = road.x - 5.8 + Math.sin(index * 5.3) * 4 + layer * 3;
      const z = -s + Math.cos(index * 1.8) * 3 + layer * 5.3;
      const first = vertices.length / 3;
      for (const height of [0, 1]) {
        const width = height ? 3.9 : 5.7;
        const y = road.y + 0.3 + height * 23;
        for (const side of [-1, 1]) {
          vertices.push(x + side * width + height * 18, y, z + side * 1.1 - height * 20);
          uv.push((side + 1) / 2, height);
        }
      }
      indices.push(first, first+1, first+3, first, first+3, first+2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { tint: {value: new THREE.Color('#ffecb1')}, strength: {value: 0.14} },
    vertexShader: `
      varying vec2 vUv;
      varying float depth;
      void main() {
        vUv = uv;
        vec4 p = modelViewMatrix * vec4(position, 1.);
        depth = -p.z;
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying float depth;
      uniform vec3 tint;
      uniform float strength;
      void main() {
        float x = vUv.x;
        float band = exp(-95. * (x-.30)*(x-.30))
          + .66*exp(-400.*(x-.56)*(x-.56)) + .28*exp(-980.*(x-.71)*(x-.71));
        float ends = smoothstep(0.,.29,vUv.y) * smoothstep(0.,.18,1.-vUv.y);
        float distanceFade = smoothstep(3.,14.,depth) * (1.-smoothstep(65.,160.,depth));
        gl_FragColor = vec4(tint, band * ends * distanceFade * strength);
        #include <colorspace_fragment>
      }`
  });
  const shafts = new THREE.Mesh(geometry, material);
  shafts.renderOrder = 2;
  scene.add(shafts);
  return function setDusk(dusk) {
    material.uniforms.tint.value.set(dusk ? '#ffab63' : '#fff3ca');
    material.uniforms.strength.value = dusk ? 0.09 : 0.15;
  };
}
