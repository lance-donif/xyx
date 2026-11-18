// Game state owns the ride; this module only presents it and dispatches controls.
export function createChaseUI({ start, pause, resume, restart }) {
  const byId = id => document.getElementById(id);
  const launch = byId('chase-launch');
  const topbar = byId('chase-topbar');
  const hud = byId('chase-hud');
  const paused = byId('chase-paused');
  const over = byId('chase-over');
  const ending = byId('chase-ending');
  const help = byId('chase-help');
  const startButton = byId('chase-start');
  const pauseButton = byId('chase-pause');
  const resumeButton = byId('chase-resume');
  const retryButton = byId('chase-retry');
  const threatBox = byId('chase-danger');
  const hintBox = byId('chase-hint');
  const canvas = byId('chase-canvas');
  const tipsButtons = [...document.querySelectorAll('[data-tips]')];
  const distanceText = byId('chase-distance');
  const coinsText = byId('chase-coins');
  const biomeText = byId('chase-biome');
  const threatText = byId('chase-threat');
  const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
  const tipsKey = 'ridgeline.chase.tips';
  let tips = true;
  let phase = '';
  let latestHint = '';
  let meters = -1;
  let coins = -1;

  try { tips = localStorage.getItem(tipsKey) !== 'off'; } catch { /* Local preferences are optional. */ }

  function text(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function updateTips() {
    const show = tips && phase === 'playing' && Boolean(latestHint);
    hintBox.hidden = !show;
    text(hintBox, show ? latestHint : '');
  }

  function syncSwitches() {
    for (const button of tipsButtons) button.setAttribute('aria-pressed', String(tips));
    updateTips();
  }

  for (const button of tipsButtons) button.addEventListener('click', () => {
    tips = !tips;
    try { localStorage.setItem(tipsKey, tips ? 'on' : 'off'); } catch { /* Keep the session preference. */ }
    syncSwitches();
  });
  syncSwitches();

  for (const button of document.querySelectorAll('[data-show-help]')) {
    button.addEventListener('click', () => help.showModal());
  }
  byId('chase-help-close').addEventListener('click', () => help.close());
  byId('chase-help-done').addEventListener('click', () => help.close());
  help.addEventListener('click', event => {
    if (event.target !== help) return;
    const bounds = help.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) help.close();
  });

  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', pause);
  resumeButton.addEventListener('click', resume);
  byId('chase-restart').addEventListener('click', restart);
  retryButton.addEventListener('click', restart);

  function showPhase(next) {
    phase = next;
    document.body.dataset.phase = phase;
    const modal = phase === 'paused' || phase === 'over';
    launch.hidden = phase !== 'ready';
    hud.hidden = phase !== 'playing' && phase !== 'ending';
    pauseButton.hidden = phase !== 'playing';
    paused.hidden = phase !== 'paused';
    over.hidden = phase !== 'over';
    topbar.inert = modal;
    canvas.inert = modal;
    if (help.open) help.close();
    if (phase === 'paused') resumeButton.focus({ preventScroll: true });
    if (phase === 'over') retryButton.focus({ preventScroll: true });
    if (phase === 'playing') canvas.focus({ preventScroll: true });
    updateTips();
  }

  function update(state) {
    if (phase !== state.phase) showPhase(state.phase);
    const nextMeters = Math.max(0, Math.floor(state.distance));
    if (meters !== nextMeters) {
      meters = nextMeters;
      text(distanceText, number.format(meters));
    }
    if (coins !== state.coins) {
      coins = state.coins;
      text(coinsText, number.format(coins));
    }
    text(biomeText, state.biome === 'coast' ? '海岸' : '林地');
    if (threatBox.dataset.level !== state.threat) threatBox.dataset.level = state.threat;
    text(threatText, state.threat === 'near' ? '山狼逼近' : '已拉开距离');

    const hint = state.hint || '';
    if (hint !== latestHint) {
      latestHint = hint;
      updateTips();
    }
    ending.hidden = phase !== 'ending' || !state.reason;
    if (!ending.hidden) text(ending, state.reason);
    if (phase === 'over') {
      text(byId('result-distance'), distanceText.textContent);
      text(byId('result-coins'), coinsText.textContent);
      text(byId('result-best'), number.format(Math.floor(state.best)));
      text(byId('chase-reason'), state.reason || '');
    }
  }

  return { update, ready() { startButton.disabled = false; } };
}
