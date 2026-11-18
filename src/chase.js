import * as THREE from 'three';
import {createRider} from './rider.js';
import {createWolf} from './wolves.js';
import {createCourse} from './chase-course.js';
import {createRun} from './chase-run.js';
import {createChaseWorld} from './chase-world.js';
import {createChaseProps} from './chase-props.js';
import {createChaseUI} from './chase-ui.js';

const canvas = document.getElementById('chase-canvas');
const BEST_KEY = 'ridgeline.escape.best.v1';
const clamp = THREE.MathUtils.clamp;
function readBest() {
  try { return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0); }
  catch { return 0; }
}
function boot() {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(54, 1, .12, 800);
  const world = createChaseWorld(scene);
  const rider = createRider('cycle');
  rider.setKit('red');
  rider.group.rotation.order = 'YXZ';
  scene.add(rider.group);
  const wolves = [createWolf(0), createWolf(1)];
  wolves.forEach(wolf => scene.add(wolf.group));
  const props = createChaseProps(scene);
  const keys = new Set();
  const aim = new THREE.Vector3();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let course, run, lastTime, gesture, cameraYaw = 0, best = readBest(), resolution = 1;
  let slowTime = 0;
  function reset() {
    const seed = new URLSearchParams(location.search).get('seed');
    if (course) world.update([], 0, [], course.sample);
    course = createCourse(seed === null ? Math.floor(Math.random() * 0xffffffff) : Number(seed));
    course.update(0);
    run = createRun(course, best);
    cameraYaw = course.sample(0).yaw;
    keys.clear();
    gesture = null;
  }
  reset();
  function pause() {
    if (run.state.phase !== 'playing') return;
    run.state.phase = 'paused';
    keys.clear();
    gesture = null;
    ui.update(run.state);
  }
  function resume() {
    if (run.state.phase !== 'paused') return;
    run.state.phase = 'playing';
    lastTime = undefined;
    ui.update(run.state);
  }
  function start() {
    if (run.state.phase !== 'ready') reset();
    run.state.phase = 'playing';
    lastTime = undefined;
    ui.update(run.state);
  }
  const ui = createChaseUI({start, pause, resume, restart: start});
  function draw(dt) {
    const s = run.state;
    world.update(course.segments, s.distance, course.events, course.sample);
    props.update(course.events, course.coins, run.collected, s.distance, course.sample, s.clock);
    const p = course.sample(s.distance);
    const ahead = course.sample(s.distance + .8);
    const turnRate = Math.atan2(Math.sin(ahead.yaw - p.yaw), Math.cos(ahead.yaw - p.yaw)) / .8;
    const ending = Math.min(1, s.endingTime);
    const dropping = s.loss === 'miss' || s.loss === 'fall';
    const travel = dropping ? ending * s.speed * .64 : 0;
    const forwardX = -Math.sin(p.yaw), forwardZ = -Math.cos(p.yaw);
    const sideX = Math.cos(p.yaw), sideZ = -Math.sin(p.yaw);
    const x = p.x + s.offset * sideX + travel * forwardX;
    const z = p.z + s.offset * sideZ + travel * forwardZ;
    rider.group.position.set(x, p.y + .035 + s.jump - (dropping ? 8 * ending * ending : 0), z);
    rider.group.rotation.y = p.yaw - s.steer * .055;
    rider.group.rotation.x = Math.atan2(ahead.y - p.y, .8) + s.jump * .045 - (dropping ? ending * .85 : 0);
    rider.update(dt, s.phase === 'ready' ? 0 : s.speed, clamp(s.steer - turnRate * 8, -1, 1), s.clock, s.tuck);
    wolves.forEach((w, i) => {
      const gap = s.loss === 'caught' ? Math.max(.15, s.wolfGap - ending * 3.5) : s.wolfGap;
      const pos = course.sample(s.distance - gap - i * .85);
      const side = (i ? -1 : 1) * (s.loss === 'caught' ? .48 : .91) + s.offset * .3;
      w.group.position.set(pos.x + Math.cos(pos.yaw) * side, pos.y + .02, pos.z - Math.sin(pos.yaw) * side);
      w.group.rotation.y = pos.yaw;
      w.update(s.clock + ending, s.phase === 'ready' ? 0 : s.speed);
    });
    const delta = Math.atan2(Math.sin(p.yaw - cameraYaw), Math.cos(p.yaw - cameraYaw));
    cameraYaw += delta * (1 - Math.exp(-9 * dt));
    const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
    const camDist = camera.aspect < .85 ? 8.15 : 8.35;
    const focusX = p.x + s.offset * sideX * .48, focusZ = p.z + s.offset * sideZ * .48;
    camera.position.set(focusX + sin * camDist, p.y + 3.55 + s.jump * .17, focusZ + cos * camDist);
    aim.set(focusX - sin * 6.75, p.y + .60 + s.jump * .1, focusZ - cos * 6.75);
    camera.up.set(reduced ? 0 : cos * turnRate * .20, 1, reduced ? 0 : -sin * turnRate * .20);
    camera.lookAt(aim);
    ui.update(s);
    renderer.render(scene, camera);
  }
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    resolution = Math.min(devicePixelRatio || 1, 1.35);
    renderer.setPixelRatio(resolution);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw(0);
  }
  resize();
  // The first preview frame can precede asynchronous texture decoding.
  THREE.DefaultLoadingManager.onLoad = () => { if (run.state.phase === 'ready') draw(0); };
  addEventListener('resize', resize);
  addEventListener('keydown', event => {
    if (document.getElementById('chase-help')?.open || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'escape' || key === 'p') {
      if (!event.repeat) run.state.phase === 'paused' ? resume() : pause();
      return;
    }
    if (run.state.phase !== 'playing') return;
    const actions = {arrowleft: 'left', arrowright: 'right', arrowup: 'jump', arrowdown: 'duck'};
    if (actions[key] || key === 'a' || key === 'd') {
      event.preventDefault();
      keys.add(key);
      if (!event.repeat && actions[key]) run.action(actions[key]);
    }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  canvas.addEventListener('pointerdown', e => {
    if (run.state.phase !== 'playing' || gesture || !e.isPrimary) return;
    canvas.setPointerCapture(e.pointerId);
    gesture = {id:e.pointerId, x:e.clientX, y:e.clientY, t:e.timeStamp, offset:run.state.offset, mode:'pending'};
  });
  function readGesture(e) {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture, dx = e.clientX - g.x, dy = e.clientY - g.y;
    const threshold = clamp(canvas.clientWidth * .07, 22, 44);
    if (g.mode === 'pending') {
      if (e.timeStamp - g.t < 210 && Math.max(Math.abs(dx), Math.abs(dy)) >= threshold) {
        g.mode = 'swipe';
        run.action(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'jump' : 'duck'));
      } else if (Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx)) {
        g.mode = 'swipe';
        run.action(dy < 0 ? 'jump' : 'duck');
      } else if (Math.abs(dx) >= 5 && Math.abs(dx) > Math.abs(dy) && e.timeStamp - g.t >= 210) {
        g.mode = 'drag';
      }
    }
    if (g.mode === 'drag') run.shift(g.offset + dx * 8 / canvas.clientWidth);
  }
  canvas.addEventListener('pointermove', readGesture);
  canvas.addEventListener('pointerup', e => {
    if (gesture?.id !== e.pointerId) return;
    readGesture(e);
    gesture = null;
  });
  canvas.addEventListener('pointercancel', () => { gesture = null; });
  renderer.setAnimationLoop(time => {
    const elapsed = lastTime === undefined ? 0 : Math.max(0, (time - lastTime) / 1000);
    lastTime = time;
    const s = run.state;
    if (s.phase !== 'playing' && s.phase !== 'ending') return;
    const dt = Math.min(elapsed, .10);
    const steps = Math.max(1, Math.ceil(dt * 100));
    const steer = Number(keys.has('d')) - Number(keys.has('a'));
    for (let i = 0; i < steps; i++) run.step(dt / steps, steer);
    if (best < s.best) {
      best = s.best = Math.max(readBest(), s.best);
      try { localStorage.setItem(BEST_KEY, String(best)); } catch {}
    }
    if (elapsed > .035) slowTime += Math.min(elapsed, .1);
    else slowTime = Math.max(0, slowTime - elapsed);
    if (slowTime > 1 && resolution > .66) {
      resolution = Math.max(.66, resolution * .82);
      renderer.setPixelRatio(resolution);
      slowTime = 0;
    }
    draw(dt);
  });
}
try { boot(); } catch (error) {
  console.error(error);
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.textContent = '三维场景加载失败。请在支持 WebGL 2 的浏览器中刷新重试。';
  Object.assign(notice.style, {position:'fixed', inset:'auto 1rem 1rem', zIndex:100, background:'#18251d', padding:'1rem', color:'#fff'});
  document.body.append(notice);
}
