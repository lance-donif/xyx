import * as THREE from 'three';

// The scenery is static. Keep a sunlight depth map near the rider and reuse it
// between sections, so making the leaf shadows sharper doesn't add a pass per frame.
export function trackSunlight(scene, roadAt) {
  const light = scene.getObjectByProperty('isDirectionalLight', true);
  if (!light) return { follow() {}, reset() {} };
  const rig = new THREE.Group();
  light.parent.add(rig);
  rig.add(light, light.target);
  light.castShadow = true;
  const shadow = light.shadow;
  shadow.mapSize.set(1024, 1024);
  Object.assign(shadow.camera, { left: -47, right: 47, top: 47, bottom: -47, near: 1, far: 240 });
  shadow.camera.updateProjectionMatrix();
  shadow.autoUpdate = false;
  shadow.bias = -0.00025;
  shadow.normalBias = 0.055;
  shadow.intensity = 0.83;
  scene.traverse(object => {
    if (object.isMesh) object.receiveShadow = true;
  });
  let previousCell;
  return {
    reset() { previousCell = undefined; },
    follow(s) {
      const cell = Math.floor(s / 26);
      if (cell === previousCell) return;
      previousCell = cell;
      const focus = cell * 26 + 19;
      const { x, y } = roadAt(focus);
      rig.position.set(x, y + 1.6, -focus);
      shadow.needsUpdate = true;
    }
  };
}
