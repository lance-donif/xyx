const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));
const turnRange = speed => speed * 1.4 + 2;
const jumpDuration = 1.12;

export function createRun(course, best = 0) {
  const state = {
    phase: 'ready', distance: 0, speed: 12, coins: 0, best, offset: 0,
    jump: 0, tuck: 0, threat: 'near', wolfGap: 2.4, hint: '', reason: '', biome: 'forest',
    clock: 0, endingTime: 0, loss: '', steer: 0
  };
  const collected = new Set();
  let handled = -Infinity, chosenTurn, jumpTime = 0, tuckTime = 0, penalty = 0, clean = 0;
  let lateralTarget = 0;

  function finish(loss, reason) {
    state.phase = 'ending';
    state.loss = loss;
    state.reason = reason;
    state.best = Math.max(state.best, Math.floor(state.distance));
  }
  function action(action) {
    if (state.phase !== 'playing') return;
    if (action === 'jump' && jumpTime <= 0 && tuckTime <= 0) jumpTime = jumpDuration;
    if (action === 'duck' && jumpTime <= 0) tuckTime = 1.05;
    if (action === 'left' || action === 'right') {
      const next = course.events.find(e => e.at > handled && e.type === 'turn');
      if (next && next.at - state.distance <= turnRange(state.speed)) {
        chosenTurn = {id: next.id, direction: action === 'left' ? -1 : 1};
      }
    }
  }
  function clearObstacle() {
    if (++clean >= 2) state.threat = 'far';
  }
  function scrape() {
    if (state.threat === 'near') return finish('caught', '山狼追上了你');
    clean = 0;
    state.threat = 'near';
    penalty = 2.2;
    state.speed *= .72;
  }
  function step(dt, steer = 0) {
    if (state.phase === 'ending') {
      state.endingTime += dt;
      if (state.endingTime >= 1) state.phase = 'over';
      return;
    }
    if (state.phase !== 'playing') return;
    state.clock += dt;
    penalty = Math.max(0, penalty - dt);
    const cruise = Math.min(22, 12 + state.distance * .005);
    state.speed += ((penalty ? cruise * .72 : cruise) - state.speed) * (1 - Math.exp(-3 * dt));
    state.distance += dt * state.speed;
    course.update(state.distance);
    if (steer) lateralTarget = clamp(lateralTarget + steer * dt * 6.5, -2.55, 2.55);
    const delta = lateralTarget - state.offset;
    state.steer = clamp(delta * 1.8 + steer * .35, -1, 1);
    state.offset += delta * (1 - Math.exp(-14 * dt));
    jumpTime = Math.max(0, jumpTime - dt);
    tuckTime = Math.max(0, tuckTime - dt);
    const f = jumpTime / jumpDuration;
    state.jump = 7.2 * f * (1 - f);
    state.tuck += ((tuckTime > 0 ? 1 : 0) - state.tuck) * (1 - Math.exp(-20 * dt));

    for (const e of course.events) {
      if (e.at <= handled) continue;
      if (e.type === 'gap' && Math.abs(state.distance - e.at) <= 2 && state.jump < .22)
        return finish('fall', '没能越过断桥');
      if (state.distance < e.at + (e.type === 'gap' ? 2 : 0)) break;
      handled = e.at;
      if (e.type === 'turn') {
        if (chosenTurn?.id !== e.id || chosenTurn.direction !== e.direction)
          return finish('miss', '冲出了桥面');
        chosenTurn = undefined;
        if (e.at === 45) state.threat = 'far';
        clearObstacle();
      } else if (e.type === 'branch' && state.tuck < .64) {
        scrape();
      } else if (e.type === 'log' && Math.abs(state.offset - e.side * 1.8) < 1.03 && state.jump < .55) {
        scrape();
      } else clearObstacle();
      if (state.phase !== 'playing') return;
    }
    for (const c of course.coins) {
      if (c.at < state.distance - 10) { collected.delete(c.id); continue; }
      if (c.at > state.distance + 1) break;
      if (!collected.has(c.id) && Math.abs(c.at - state.distance) < 1 &&
          Math.abs(c.offset - state.offset) < .72 && Math.abs(c.height - state.jump - .85) < .95) {
        collected.add(c.id);
        state.coins++;
      }
    }
    state.biome = course.segments.find(s => s.start <= state.distance && s.end > state.distance)?.biome ?? 'forest';
    state.wolfGap += ((state.threat === 'near' ? 2.45 : 8.4) - state.wolfGap) * (1 - Math.exp(-2.2 * dt));
    const e = course.events.find(e => e.at > handled);
    state.hint = '';
    if (e && e.at - state.distance < (e.type === 'turn' ? turnRange(state.speed) : state.speed * 1.8)) {
      if (e.type === 'turn') state.hint = e.direction < 0 ? '← 左转上桥' : '右转上桥 →';
      else if (e.type === 'gap') state.hint = e.at - state.distance <= state.speed * .75 ? '↑ 现在起跳' : '前方断桥';
      else if (e.type === 'branch') state.hint = e.at - state.distance <= state.speed * .75 ? '↓ 现在俯身' : '前方低枝';
      else state.hint = e.side < 0 ? '向右避开倒木' : '向左避开倒木';
    }
  }
  return {state, collected, action, step, shift(value) { lateralTarget = clamp(value, -2.55, 2.55); }};
}
