import * as THREE from 'three';
import { roadAt, createWorld } from './world.js';
import { coastAt, createCoast } from './coast.js';
import { createRider } from './rider.js';
import { createGates, COURSE_LENGTH, GATE_HALF_WIDTH } from './gates.js';
import { createAudio } from './audio.js';

const get = id => document.getElementById(id);
const routes = {
  alpine: { name: '松冠山道', title: 'ALPINE <br>DESCENT', road: roadAt, create: createWorld },
  coast: { name: '翡翠海岸', title: 'COASTAL <br>SPRINT', road: coastAt, create: createCoast }
};
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const startLine = 0;
const input = new Set();
const keys = new Map(Object.entries({
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'boost', KeyW: 'boost', ArrowDown: 'brake', KeyS: 'brake'
}));
const audio = createAudio();
function load(key) {
  try { return localStorage.getItem('ridgeline.' + key); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem('ridgeline.' + key, value); } catch { /* Private browsing is playable. */ }
}
function clock(seconds) {
  const hundredths = Math.floor(seconds * 100 + 0.00001);
  const pair = value => String(value).padStart(2, '0');
  return pair(Math.floor(hundredths / 6000)) + ':' + pair(Math.floor(hundredths / 100) % 60)
    + '.' + pair(hundredths % 100);
}

let route = 'alpine', vehicle = 'moto', mode = 'menu', muted = load('muted') === 'true';
let scene, environment, gates, rider, renderer;
const scenes = new Map();
const riders = new Map();
const camera = new THREE.PerspectiveCamera(56, 1, 0.09, 365);
const cameraAim = new THREE.Vector3(), target = new THREE.Vector3(), eye = new THREE.Vector3();
let distance = startLine, speed = 0, offset = 0, lateralSpeed = 0, lean = 0;
let elapsed = 0, passed = 0, nextGate = 0, noticeFor = 0;
let last = 0, worldTime = 0, uiTime = 0, resolution = 1.5, slowSeconds = 0;
function selectScene() {
  if (rider) rider.group.removeFromParent();
  const def = routes[route];
  if (!scenes.has(route)) {
    const next = new THREE.Scene();
    scenes.set(route, { scene: next, environment: def.create(next), gates: createGates(next, def.road) });
  }
  ({scene, environment, gates} = scenes.get(route));
  environment.setTheme?.(vehicle === 'cycle' ? 'dusk' : 'day');
  if (!riders.has(vehicle)) riders.set(vehicle, createRider(vehicle));
  rider = riders.get(vehicle);
  scene.add(rider.group);
  for (const button of document.querySelectorAll('[data-vehicle]')) {
    button.setAttribute('aria-pressed', String(button.dataset.vehicle === vehicle));
  }
  for (const button of document.querySelectorAll('[data-route]')) {
    button.setAttribute('aria-pressed', String(button.dataset.route === route));
  }
  get('course-title').innerHTML = def.title;
  get('course-name').textContent = def.name;
  get('hud-course-name').textContent = def.name;
  setView(0, true);
  renderer.render(scene, camera);
}
function changeMode(next) {
  mode = next;
  document.body.dataset.state = next;
  input.clear();
  for (const b of document.querySelectorAll('[data-input]')) b.classList.remove('held');
  audio.update(!muted && mode === 'racing', vehicle, speed);
  last = performance.now();
}
function begin() {
  if (!muted) audio.unlock();
  distance = startLine;
  offset = lateralSpeed = lean = elapsed = passed = nextGate = noticeFor = 0;
  speed = vehicle === 'moto' ? 17 : 12;
  get('notice').textContent = '';
  changeMode('racing');
  setView(0, true);
  updateHUD();
}
function pause() {
  if (mode !== 'racing') return;
  changeMode('paused');
  get('resume').focus({preventScroll: true});
}
function resume() {
  if (mode !== 'paused') return;
  changeMode('racing');
}
function showMenu() {
  changeMode('menu');
  distance = startLine;
  offset = lean = speed = 0;
  setView(0, true);
  renderer.render(scene, camera);
  get('start').focus({preventScroll: true});
}
function finish() {
  const misses = gates.checkpoints.length - passed;
  const score = elapsed + misses * 3;
  const key = 'best.v1.' + route + '.' + vehicle;
  const previous = Number(load(key));
  const best = previous > 0 ? Math.min(previous, score) : score;
  save(key, String(best));
  get('result-time').textContent = clock(score);
  get('result-best').textContent = clock(best);
  get('result-gates').textContent = passed + ' / ' + gates.checkpoints.length;
  get('result-penalty').textContent = '+' + (misses * 3) + ' s';
  changeMode('results');
  if (!muted) audio.chime(true);
  get('replay').focus({preventScroll: true});
}
function updateHUD() {
  get('chrono').textContent = clock(elapsed);
  get('speed').textContent = String(Math.round(speed * 3.6)).padStart(2, '0');
  get('distance').textContent = (distance / 1000).toFixed(2) + ' / 1.20 km';
  get('progress').style.width = clamp(distance / COURSE_LENGTH * 100, 0, 100) + '%';
  get('gates').textContent = passed + ' / ' + gates.checkpoints.length;
}
function held(action) {
  for (const button of input) if (button.endsWith('/' + action)) return true;
  return false;
}
function step(dt, clockDelta) {
  const road = routes[route].road;
  const mid = road(distance);
  const near = road(distance - 3), far = road(distance + 3);
  const curvature = (far.x - 2 * mid.x + near.x) / 9;
  const braking = held('brake');
  const offroad = Math.abs(offset) > 3.65;
  const cruise = vehicle === 'moto' ? 23 : 17;
  const desired = braking ? 8 : offroad ? 13 : cruise + (held('boost') ? 13 : 0);
  speed = damp(speed, desired, braking ? 2.2 : 0.72, dt);
  const steer = Number(held('right')) - Number(held('left'));
  lateralSpeed = damp(lateralSpeed, steer * (4.3 + speed * 0.045)
    - clamp(curvature * speed * speed * 0.32, -3.1, 3.1), 5.8, dt);
  const oldOffset = offset;
  offset = clamp(offset + lateralSpeed * dt, -4.25, 4.25);
  lean = damp(lean, clamp(steer * 0.9 - curvature * speed * 0.75, -1, 1), 5, dt);
  const oldDistance = distance;
  const travel = speed * dt / Math.hypot(1, (far.x - near.x) / 6, (far.y - near.y) / 6);
  distance = Math.min(COURSE_LENGTH, distance + travel);
  elapsed += clockDelta * (distance - oldDistance) / travel;
  if (noticeFor > 0 && (noticeFor -= dt) <= 0) get('notice').textContent = '';
  const gate = gates.checkpoints[nextGate];
  if (gate && distance >= gate.s) {
    const fraction = (gate.s - oldDistance) / (distance - oldDistance);
    const success = Math.abs(THREE.MathUtils.lerp(oldOffset, offset, fraction) - gate.offset) <= GATE_HALF_WIDTH;
    if (success) passed++;
    nextGate++;
    get('notice').textContent = success ? '通过第 ' + nextGate + ' 道计时门' : '漏过计时门  +3 秒';
    noticeFor = 2;
    if (!muted) audio.chime(success);
  }
  if (distance >= COURSE_LENGTH) {
    updateHUD();
    finish();
  }
}
function setView(dt, snap = false) {
  const preview = mode === 'menu';
  const road = routes[route].road;
  const s = preview ? 7 : distance;
  const center = road(s), forward = road(s + 1);
  const yaw = Math.atan2(forward.x - center.x, 1);
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const slope = (forward.y - center.y) * cos;
  const bob = preview ? 0 : Math.sin(worldTime * 13) * 0.008 * (speed / 25);
  rider.group.position.set(center.x + offset, center.y + 0.035 + bob, -s);
  rider.group.rotation.order = 'YXZ';
  rider.group.rotation.y = -yaw - (preview ? 0 : 0.038 * lean);
  rider.group.rotation.x = Math.atan(slope);
  rider.update(dt, preview ? 0 : speed, preview ? 0 : lean, worldTime);
  const portrait = camera.aspect < 0.8;
  const camDist = preview ? (portrait ? 6.6 : 5.2) : (vehicle === 'cycle' ? 4.8 : 5.1);
  const side = preview && !portrait ? 1.65 + Math.sin(worldTime * 0.23) * 0.08 : 0;
  eye.set(center.x + offset * 0.83 - sin * camDist + cos * side,
    center.y - slope * camDist + (preview ? 2.62 : 2.35), -s + cos * camDist + sin * side);
  const lookAhead = preview ? 10 : 10 + speed * 0.09;
  const front = road(s + lookAhead);
  const composition = preview && !portrait ? -4.1 : 0;
  target.set(front.x + offset * 0.8 + composition * cos, front.y + (preview ? 1.6 : 1.32),
    -s - lookAhead + composition * sin);
  if (snap) { camera.position.copy(eye); cameraAim.copy(target); }
  else {
    const alpha = -Math.expm1(-12 * dt);
    camera.position.lerp(eye, alpha);
    cameraAim.lerp(target, alpha);
  }
  camera.lookAt(cameraAim);
  gates.update(s);
  environment.update(s);
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 68 : 56;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, resolution));
  renderer.setSize(w, h, false);
  if (scene) {
    setView(0, true);
    renderer.render(scene, camera);
  }
}
function frame(now) {
  const delta = Math.max(0, (now - last) / 1000);
  last = now;
  if (document.hidden) return;
  if (mode !== 'racing') return;
  const dt = Math.min(delta, 1);
  worldTime += dt;
  if (mode === 'racing' && dt > 0) {
    const steps = Math.ceil(dt / 0.025);
    for (let i = 0; i < steps && mode === 'racing'; i++) step(dt / steps, delta / steps);
    uiTime += dt;
    if (uiTime > 0.06) {
      updateHUD();
      audio.update(!muted && mode === 'racing', vehicle, speed);
      uiTime = 0;
    }
  }
  setView(dt);
  renderer.render(scene, camera);
  // Keep text sharp, reducing only the WebGL buffer when frames repeatedly overrun.
  slowSeconds = delta > 0.038 ? slowSeconds + Math.min(delta, 0.3) : Math.max(0, slowSeconds - 2 * delta);
  if (slowSeconds > 0.8 && renderer.getPixelRatio() > 0.5) {
    resolution = Math.max(0.5, renderer.getPixelRatio() * 0.78);
    renderer.setPixelRatio(resolution);
    slowSeconds = 0;
  }
}
function bindControls() {
  document.querySelectorAll('[data-route]').forEach(b => b.onclick = () => {
    route = b.dataset.route;
    selectScene();
  });
  document.querySelectorAll('[data-vehicle]').forEach(b => b.onclick = () => {
    vehicle = b.dataset.vehicle;
    selectScene();
  });
  get('start').onclick = get('restart').onclick = get('replay').onclick = begin;
  get('pause').onclick = pause;
  get('resume').onclick = resume;
  get('menu').onclick = showMenu;
  document.querySelectorAll('[data-menu]').forEach(b => b.onclick = showMenu);
  get('mute').setAttribute('aria-pressed', String(muted));
  get('mute').onclick = () => {
    muted = !muted;
    save('muted', String(muted));
    get('mute').setAttribute('aria-pressed', String(muted));
    if (!muted) audio.unlock();
    audio.update(!muted && mode === 'racing', vehicle, speed);
  };
  window.addEventListener('keydown', e => {
    if (mode === 'racing' && keys.has(e.code)) {
      e.preventDefault();
      input.add('key' + e.code + '/' + keys.get(e.code));
    }
    if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      if (mode === 'racing') pause(); else if (mode === 'paused') resume();
    }
  });
  window.addEventListener('keyup', e => input.delete('key' + e.code + '/' + keys.get(e.code)));
  document.querySelectorAll('[data-input]').forEach(b => {
    b.onpointerdown = e => {
      e.preventDefault();
      if (mode !== 'racing') return;
      b.setPointerCapture(e.pointerId);
      input.add('pointer' + e.pointerId + '/' + b.dataset.input);
      b.classList.add('held');
    };
    b.onlostpointercapture = e => {
      input.delete('pointer' + e.pointerId + '/' + b.dataset.input);
      b.classList.remove('held');
    };
  });
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
}
function init() {
  try {
    renderer = new THREE.WebGLRenderer({canvas: get('world'), antialias: true, powerPreference: 'high-performance'});
  } catch {
    get('start').disabled = true;
    get('start').textContent = '需要 WebGL 2 · 请开启硬件加速';
    return;
  }
  resize();
  selectScene();
  bindControls();
  window.addEventListener('resize', resize);
  last = performance.now();
  renderer.setAnimationLoop(frame);
}
init();
