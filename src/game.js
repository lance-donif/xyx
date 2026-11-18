import * as THREE from 'three';
import { roadAt, createWorld } from './world.js';
import { coastAt, createCoast } from './coast.js';
import { createRider } from './rider.js';
import { createDusk, duskAt, duskLaneScale } from './dusk.js';
import { createGates, COURSE_LENGTH, GATE_HALF_WIDTH } from './gates.js';
import { createAudio } from './audio.js';
import { addCanopyLight } from './sunshafts.js';
import { trackSunlight } from './sunshadow.js';

const get = id => document.getElementById(id);
const routes = {
  alpine: { name: '松冠山道', title: 'ALPINE <br>DESCENT', road: roadAt, create: createWorld },
  dusk: { name: '松冠山道 · 暮色山城', title: 'EMBER <br>DESCENT', road: duskAt, laneScale: duskLaneScale, create: createDusk },
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
let scene, course = routes.alpine, environment, gates, rider, renderer, sunlight;
const scenes = new Map();
const riders = new Map();
const camera = new THREE.PerspectiveCamera(56, 1, 0.09, 365);
const cameraAim = new THREE.Vector3(), target = new THREE.Vector3(), eye = new THREE.Vector3();
let distance = startLine, speed = 0, offset = 0, lateralSpeed = 0, lean = 0;
let elapsed = 0, passed = 0, nextGate = 0, noticeFor = 0;
const lastAnchor = new THREE.Vector3(), anchor = new THREE.Vector3(), pathDelta = new THREE.Vector3();
let cameraBank = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let last = 0, worldTime = 0, uiTime = 0, resolution = 1.5, slowSeconds = 0;
let previewFrame = 0;
function refreshPreview() {
  if (mode === 'racing' || previewFrame) return;
  previewFrame = requestAnimationFrame(() => {
    previewFrame = 0;
    if (scene && mode !== 'racing') renderer.render(scene, camera);
  });
}
function selectScene() {
  if (rider) rider.group.removeFromParent();
  const dusk = route === 'alpine' && vehicle === 'cycle';
  const sceneKey = dusk ? 'dusk' : route;
  course = routes[sceneKey];
  if (!scenes.has(sceneKey)) {
    const next = new THREE.Scene();
    next.addEventListener('skychange', () => { if (scene === next) refreshPreview(); });
    const landscape = course.create(next);
    scenes.set(sceneKey, {
      scene: next, environment: landscape, gates: createGates(next, course.road, course.laneScale),
      sunlight: trackSunlight(next, course.road),
      setDusk: sceneKey === 'alpine' ? addCanopyLight(next, course.road) : null
    });
  }
  const view = scenes.get(sceneKey);
  ({scene, environment, gates, sunlight} = view);
  environment.setTheme?.(dusk ? 'dusk' : 'day');
  view.setDusk?.(dusk);
  sunlight.reset();
  camera.far = route === 'coast' ? 1300 : 900;
  camera.updateProjectionMatrix();
  if (!riders.has(vehicle)) riders.set(vehicle, createRider(vehicle));
  rider = riders.get(vehicle);
  scene.add(rider.group);
  // The moving rider has its own ground projection, so a cached map only contains scenery.
  rider.group.traverse(object => {
    if (object.isMesh) { object.castShadow = false; object.receiveShadow = true; }
  });
  const sun = scene.getObjectByProperty('isDirectionalLight', true);
  rider.setLighting?.(sun?.position, course.road);
  rider.setKit?.(dusk ? 'red' : 'ivory');
  for (const button of document.querySelectorAll('[data-vehicle]')) {
    button.setAttribute('aria-pressed', String(button.dataset.vehicle === vehicle));
  }
  for (const button of document.querySelectorAll('[data-route]')) {
    button.setAttribute('aria-pressed', String(button.dataset.route === route));
  }
  get('course-title').innerHTML = course.title;
  get('course-name').textContent = course.name;
  get('hud-course-name').textContent = course.name;
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
  const key = 'best.ridge2.' + route + '.' + vehicle;
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
  const road = course.road;
  const mid = road(distance);
  const near = road(distance - 3), far = road(distance + 3);
  const curvature = (far.x - 2 * mid.x + near.x) / 9;
  const braking = held('brake');
  const offroad = Math.abs(offset) > 3.65;
  const cruise = vehicle === 'moto' ? 23 : 17;
  const desired = braking ? 8 : offroad ? 13 : cruise + (held('boost') ? 13 : 0);
  speed = damp(speed, desired, braking ? 2.2 : 0.72, dt);
  const steer = Number(held('right')) - Number(held('left'));
  // The neutral line follows the bend. Steering can still place either wheel on the verge.
  const slip = clamp(curvature * speed * speed * 0.11, -0.70, 0.70);
  const correction = steer === 0 ? offset * 0.95 : 0;
  lateralSpeed = damp(lateralSpeed, steer * (4.3 + speed * 0.045) - slip - correction, 5.8, dt);
  const oldOffset = offset;
  offset = clamp(offset + lateralSpeed * dt, -4.25, 4.25);
  const roadCurve = curvature / Math.pow(1 + ((far.x - near.x) / 6) ** 2, 1.5);
  const cornerLean = Math.atan2(speed * speed * roadCurve, 9.81);
  lean = damp(lean, clamp(steer * 0.75 + cornerLean * 1.35, -1, 1), 5, dt);
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
  const road = course.road;
  const s = preview ? 7 : distance;
  const laneOffset = offset * (course.laneScale?.(s) ?? 1);
  const center = road(s), forward = road(s + 1);
  const yaw = Math.atan2(forward.x - center.x, 1);
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const slope = (forward.y - center.y) * cos;
  const bob = preview ? 0 : Math.sin(worldTime * 13) * 0.008 * (speed / 25);
  rider.group.position.set(center.x + laneOffset, center.y + 0.035 + bob, -s);
  rider.group.rotation.order = 'YXZ';
  rider.group.rotation.y = -yaw - (preview ? 0 : 0.038 * lean);
  rider.group.rotation.x = Math.atan(slope);
  rider.update(dt, preview ? 0 : speed, preview ? 0 : lean, worldTime);
  const portrait = camera.aspect < 0.8;
  const coast = route === 'coast';
  const biking = vehicle === 'cycle';
  const camDist = preview ? (portrait ? 6.25 : 5.65) : (coast && biking ? 3.95 : biking ? 4.35 : 4.9);
  // Start over the outside shoulder on the coast, looking across the trail toward the bay.
  // In a corner, the rider moves across the frame before the chase camera catches up.
  const side = preview ? (portrait ? -0.65 : coast ? -2 : 1.1)
    : (coast ? -0.85 : 0.10) - lean * 0.64;
  const height = preview ? (coast ? 2.9 : 3.15) : (coast ? 1.94 : 2.52);
  eye.set(center.x + laneOffset * 0.70 - sin * camDist + cos * side,
    center.y - slope * camDist * (coast ? 0.27 : 0.72) + height + bob * 0.35, -s + cos * camDist + sin * side);
  eye.y = Math.max(eye.y, road(-eye.z).y + 0.95);
  const lookAhead = preview ? 17 : 13 + speed * 0.12;
  const front = road(s + lookAhead);
  const composition = preview && !portrait ? (coast ? -2.8 : -4.4) : (coast ? 1.75 : 0.0);
  const aimX = THREE.MathUtils.lerp(center.x + (forward.x - center.x) * lookAhead, front.x, 0.65)
    + laneOffset * 0.72 + composition * cos;
  const aimZ = -s - lookAhead + composition * sin;
  // Frame the torso below centre so both tyres and the skyline survive a change in grade.
  const baseFov = portrait ? 63 : coast ? 52 : 54;
  const framing = preview ? (portrait ? 0.44 : 0.71) : 0.68;
  const subjectAngle = Math.atan2(eye.y - center.y - 0.88, Math.hypot(eye.x - center.x - laneOffset, eye.z + s));
  const pitch = clamp(subjectAngle - Math.atan((framing * 2 - 1) * Math.tan(baseFov * Math.PI / 360)), 0.04, coast && !preview ? 0.19 : 0.43);
  target.set(aimX, eye.y - Math.hypot(aimX - eye.x, aimZ - eye.z) * Math.tan(pitch), aimZ);
  const curve = (road(s + 8).x - 2 * center.x + road(s - 8).x) / 64;
  const bank = preview || reducedMotion.matches ? 0 : clamp(lean * 0.072 + curve * speed * 0.12, -0.10, 0.10);
  anchor.set(center.x, center.y, -s);
  const fov = baseFov + (preview || reducedMotion.matches ? 0 : clamp((speed - 15) * 0.20, 0, 4.5));
  if (snap) { camera.position.copy(eye); cameraAim.copy(target); cameraBank = bank; }
  else {
    // Smooth steering in the moving road frame. Speed must not pull the chase camera away.
    pathDelta.subVectors(anchor, lastAnchor);
    camera.position.add(pathDelta).lerp(eye, -Math.expm1(-12 * dt));
    cameraAim.add(pathDelta).lerp(target, -Math.expm1(-9 * dt));
    cameraBank = damp(cameraBank, bank, 4, dt);
  }
  lastAnchor.copy(anchor);
  const nextFov = snap ? fov : damp(camera.fov, fov, 3, dt);
  if (Math.abs(camera.fov - nextFov) > 0.003) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(cameraAim);
  camera.rotateZ(cameraBank);
  gates.update(s);
  environment.update(s);
  sunlight.follow(s);
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
  // Keep text sharp, reducing only the WebGL buffer when frames repeatedly overrun.
  slowSeconds = delta > 0.038 ? slowSeconds + Math.min(delta, 0.3) : Math.max(0, slowSeconds - 2 * delta);
  if (slowSeconds > 0.8 && renderer.getPixelRatio() > 0.5) {
    resolution = Math.max(0.5, renderer.getPixelRatio() * 0.78);
    renderer.setPixelRatio(resolution);
    slowSeconds = 0;
  }
  renderer.render(scene, camera);
}
function bindControls() {
  document.querySelectorAll('[data-route]').forEach(b => b.onclick = () => {
    if (route === b.dataset.route) return;
    route = b.dataset.route;
    selectScene();
  });
  document.querySelectorAll('[data-vehicle]').forEach(b => b.onclick = () => {
    if (vehicle === b.dataset.vehicle) return;
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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  // A newly loaded map may complete while the menu or pause screen is stationary.
  THREE.DefaultLoadingManager.onLoad = () => {
    for (const entry of scenes.values()) entry.sunlight.reset();
    if (scene) sunlight.follow(mode === 'menu' ? 7 : distance);
    refreshPreview();
  };
  resize();
  selectScene();
  bindControls();
  window.addEventListener('resize', resize);
  last = performance.now();
  renderer.setAnimationLoop(frame);
}
init();
