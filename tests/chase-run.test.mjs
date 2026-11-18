import assert from 'node:assert/strict';
import test from 'node:test';
import {createRun} from '../src/chase-run.js';

const turn = {type:'turn', id:1, at:45, direction:-1};
function setup(events) {
  const course = {update(){}, segments:[{start:0,end:500,biome:'forest'}], events, coins:[]};
  const run = createRun(course);
  run.state.phase = 'playing';
  function ride(to) {
    while (run.state.distance < to && run.state.phase === 'playing') run.step(1/120);
  }
  return {run, ride};
}

test('a deliberate left turn escapes the pack; leaning or turning right misses the bridge', () => {
  for (const direction of ['left', 'right', null]) {
    const {run, ride} = setup([turn]);
    ride(35);
    if (direction) run.action(direction);
    else run.shift(-2);
    ride(47);
    assert.equal(run.state.phase, direction === 'left' ? 'playing' : 'ending');
    if (direction === 'left') assert.equal(run.state.threat, 'far');
  }
});
test('scraping slows the rider; two clean obstacles restore separation and another early hit ends the chase', () => {
  const events = [turn, ...[66,90,114].map((at,i) => ({id:i+2,type:'log',side:-1,at}))];
  for (const recover of [true,false]) {
    const {run, ride} = setup(events);
    ride(36); run.action('left'); ride(48);
    run.shift(-1.8); ride(67);
    assert.equal(run.state.threat, 'near');
    assert.ok(run.state.speed < 11);
    if (recover) run.shift(1);
    ride(116);
    assert.equal(run.state.threat, recover ? 'far' : 'near');
    assert.equal(run.state.loss, recover ? '' : 'caught');
  }
});
test('the gap requires airtime across both edges', () => {
  const events = [{at:25, type:'gap', id:2}];
  for (const jump of [true,false]) {
    const {run,ride} = setup(events);
    ride(19);
    if (jump) run.action('jump');
    ride(30);
    assert.equal(run.state.loss, jump ? '' : 'fall');
  }
});
