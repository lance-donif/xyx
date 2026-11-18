// Generate a quiet rolling tone locally so rides have no audio download or autoplay dependency.
export function createAudio() {
  let context, gain, engine, filter, airGain;
  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      engine = context.createOscillator();
      engine.type = 'triangle';
      filter = context.createBiquadFilter();
      filter.frequency.value = 190;
      engine.connect(filter).connect(gain);
      engine.start();
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const air = context.createBufferSource();
      const windFilter = context.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 880;
      airGain = context.createGain();
      air.buffer = buffer;
      air.loop = true;
      airGain.gain.value = 0;
      air.connect(windFilter).connect(airGain).connect(context.destination);
      air.start();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
  }
  return {
    unlock,
    update(active, vehicle, speed) {
      if (!context) return;
      const t = context.currentTime;
      engine.frequency.setTargetAtTime(31 + speed * 1.45, t, 0.09);
      gain.gain.setTargetAtTime(active && vehicle === 'moto' ? 0.045 : 0, t, 0.05);
      airGain.gain.setTargetAtTime(active ? speed * 0.0016 : 0, t, 0.09);
    },
    chime(high) {
      if (!context) return;
      const t = context.currentTime;
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.frequency.setValueAtTime(high ? 700 : 220, t);
      tone.frequency.exponentialRampToValueAtTime(high ? 1050 : 125, t + 0.13);
      volume.gain.setValueAtTime(0.055, t);
      volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      tone.connect(volume).connect(context.destination);
      tone.onended = () => { tone.disconnect(); volume.disconnect(); };
      tone.start(t);
      tone.stop(t + 0.23);
    }
  };
}
