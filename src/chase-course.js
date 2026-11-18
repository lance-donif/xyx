// Each block takes a sideways detour and returns to the forward axis. Its four
// quarter circles and paired lateral straights always advance the same distance
// down the valley. This lets a seed reconstruct any kilometre without a history.
const blockLength = 840;
const turnRadius = 9;
const arcLength = Math.PI * turnRadius / 2;
const sideRun = 194;
const forwardAdvance = blockLength - 2 * sideRun - 2 * arcLength + 4 * turnRadius;

function hash(seed, value) {
  let bits = (seed ^ Math.imul(value + 1, 0x9e3779b1)) >>> 0;
  bits = Math.imul(bits ^ (bits >>> 16), 0x21f0aaad);
  bits = Math.imul(bits ^ (bits >>> 15), 0x735a2d97);
  return (bits ^ (bits >>> 15)) >>> 0;
}

function numericSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let result = 2166136261;
  for (const character of String(seed ?? 'ridge')) {
    result = Math.imul(result ^ character.codePointAt(0), 16777619);
  }
  return result >>> 0;
}

function height(s) {
  return 1.8 * Math.sin(s / 85) + .95 * Math.sin(s / 46) + .33 * Math.sin(s / 27);
}

function project(piece, s) {
  const step = s - piece.start;
  const yaw = piece.yaw + step * piece.bend;
  if (piece.bend === 0) {
    return {x: piece.x - Math.sin(yaw) * step, z: piece.z - Math.cos(yaw) * step, yaw};
  }
  return {
    x: piece.x + (Math.cos(yaw) - Math.cos(piece.yaw)) / piece.bend,
    z: piece.z + (Math.sin(piece.yaw) - Math.sin(yaw)) / piece.bend,
    yaw
  };
}

function buildBlock(seed, index) {
  const blockSeed = hash(seed, index);
  let draw = 0;
  const random = () => hash(blockSeed, draw++) / 0x100000000;
  const base = index * blockLength;
  const first = index === 0 ? 45 : 43 + Math.floor(random() * 47);
  const third = first + sideRun + 195 + Math.floor(random() * 57);
  const turnAt = [first, first + sideRun, third, third + sideRun];
  const side = index === 0 || random() < .5 ? -1 : 1;
  const directions = [side, -side, -side, side];
  const pieces = [], events = [], segments = [], coins = [];
  let pose = {x: 0, z: -index * forwardAdvance, yaw: 0};
  let start = base;
  function piece(end, bend = 0) {
    const next = {...pose, start, end, bend};
    pieces.push(next);
    pose = project(next, end);
    start = end;
  }
  function event(type, at, side, dimensions = {}) {
    events.push({type, at: base + at, side, direction: side, ...dimensions});
  }
  function direction() { return random() < .5 ? -1 : 1; }

  for (let i = 0; i < turnAt.length; i++) {
    const at = turnAt[i];
    piece(base + at);
    event('turn', at, directions[i], {radius: turnRadius});
    piece(base + at + arcLength, -directions[i] / turnRadius);
  }
  piece(base + blockLength);
  // Change biome on straights. The first coastal stretch comes just after the
  // second corner, with a full bridge segment to establish the coastal vista.
  const coastStart = turnAt[1] + arcLength;
  const coastEnd = turnAt[3] + arcLength;
  for (const part of pieces) {
    const count = Math.ceil((part.end - part.start) / 76);
    const length = (part.end - part.start) / count;
    const biome = part.start >= base + coastStart && part.start < base + coastEnd ? 'coast' : 'forest';
    for (let i = 0; i < count; i++) {
      segments.push({
        id: index * 100 + segments.length + 1,
        start: part.start + i * length, end: i + 1 === count ? part.end : part.start + (i + 1) * length,
        biome
      });
    }
  }

  for (let i = 0; i < 4; i++) {
    // Keep each stretch clear near its incoming and outgoing turn. The tail
    // also leaves space before the following block's first corner.
    const from = turnAt[i] + arcLength + 40;
    const to = i === 3 ? blockLength - 18 : turnAt[i + 1] - 40;
    if (index === 0 && i === 0) {
      event('gap', 108, 1, {width: 4});
      event('branch', 166, -1);
    } else if (index === 0 && i === 1) {
      event('log', 300, -1);
      event('log', 334, 1);
    } else {
      for (let at = from + random() * 12; at <= to; at += 43 + random() * 23) {
        const type = ['gap', 'branch', 'log'][Math.floor(random() * 3)];
        event(type, at, direction(), type === 'gap' ? {width: 4} : {});
      }
    }
  }
  events.sort((a, b) => a.at - b.at);
  events.forEach((entry, i) => { entry.id = index * 100 + i + 1; });

  // Short trails lead through the open side of a fallen log or over a gap.
  // Leave breaks between trails so that a turn is readable from a distance.
  for (let local = 9, i = 0; local < blockLength - 4; local += 4, i++) {
    const at = base + local;
    const nearby = events.find(e => Math.abs(at - e.at) < 13);
    if (!nearby && i % 16 > 7) continue;
    const offset = nearby?.type === 'log' ? -nearby.side * 1.65 : 0;
    let lift = 0;
    if (nearby?.type === 'gap') lift = 1.52 * Math.max(0, 1 - ((at - nearby.at) / 8) ** 2);
    coins.push({id: index * 1000 + i + 1, at, offset, height: .75 + lift});
  }
  return {pieces, segments, events, coins};
}

export function createCourse(seed) {
  const key = numericSeed(seed);
  const blocks = new Map();
  let lastSampleIndex = -1, lastSampleBlock;
  let segments = [], events = [], coins = [], currentWindow = -1;
  const approach = {id: 0, start: -65, end: 0, biome: 'forest'};
  function blockAt(index) {
    if (blocks.has(index)) return blocks.get(index);
    if (lastSampleIndex !== index) {
      lastSampleBlock = buildBlock(key, index);
      lastSampleIndex = index;
    }
    return lastSampleBlock;
  }
  function update(distance) {
    const windowIndex = Math.floor(Math.max(0, distance) / 24);
    if (windowIndex === currentWindow) return;
    currentWindow = windowIndex;
    const from = windowIndex * 24 - 96, to = windowIndex * 24 + 340;
    const first = Math.max(0, Math.floor(from / blockLength)), last = Math.floor(to / blockLength);
    for (const index of blocks.keys()) if (index < first || index > last) blocks.delete(index);
    segments = from <= 0 ? [approach] : [];
    events = [];
    coins = [];
    for (let i = first; i <= last; i++) {
      const block = blockAt(i);
      blocks.set(i, block);
      segments.push(...block.segments.filter(s => s.end > from && s.start <= to));
      events.push(...block.events.filter(e => e.at >= from && e.at <= to));
      coins.push(...block.coins.filter(c => c.at >= from && c.at <= to));
    }
  }
  function sample(distance) {
    if (distance < 0) return {x: 0, y: height(distance), z: -distance, yaw: 0};
    const block = blockAt(Math.floor(distance / blockLength));
    const part = block.pieces.find(p => distance < p.end) ?? block.pieces.at(-1);
    return {...project(part, distance), y: height(distance)};
  }
  update(0);
  return {sample, update, get segments() { return segments; }, get events() { return events; }, get coins() { return coins; }};
}
