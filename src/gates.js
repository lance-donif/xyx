import * as THREE from 'three';

export const COURSE_LENGTH = 1200;
export const GATE_HALF_WIDTH = 1.42;
const offsets = [-1.8, 1.35, 0.1, 1.95, -1.1, -2.05, 1.85, 0];
const positions = [95, 235, 372, 514, 647, 798, 958, 1102];

function banner(text, finish = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = finish ? '#101c21' : '#ff713b';
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = finish ? '#fff4db' : '#14242c';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * 18, (i % 2) * 18, 18, 18);
    ctx.fillRect(512 - (i + 1) * 18, (i % 2) * 18, 18, 18);
  }
  ctx.font = 'italic bold 57px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
}

export function createGates(scene, roadAt) {
  const pole = new THREE.CylinderGeometry(0.035, 0.05, 1, 7);
  const sleeve = new THREE.CylinderGeometry(0.072, 0.081, 0.8, 7);
  const ink = new THREE.MeshStandardMaterial({color: 0x203743});
  const safety = new THREE.MeshBasicMaterial({color: 0xff6638});
  const entries = [...positions, COURSE_LENGTH].map((s, index) => {
    const finish = index === positions.length;
    const half = finish ? 4.6 : GATE_HALF_WIDTH;
    const height = finish ? 4.5 : 3.1;
    const {x, y} = roadAt(s);
    const group = new THREE.Group();
    const offset = offsets[index] ?? 0;
    group.position.set(x + offset, y, -s);
    for (const side of [-1, 1]) {
      const stick = new THREE.Mesh(pole, ink);
      stick.scale.y = height;
      stick.position.set(side * half, height / 2, 0);
      const pad = new THREE.Mesh(sleeve, safety);
      pad.position.set(side * half, 0.46, 0);
      group.add(stick, pad);
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, finish ? 0.7 : 0.49),
      banner(finish ? 'FINISH' : 'GATE  ' + String(index + 1).padStart(2, '0'), finish));
    flag.position.y = height - 0.19;
    group.add(flag);
    scene.add(group);
    return {s, offset, group};
  });

  return {
    checkpoints: entries.slice(0, -1),
    update(s) {
      for (const item of entries) item.group.visible = item.s > s - 12 && item.s < s + 220;
    }
  };
}
