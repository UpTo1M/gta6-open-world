// SOLMARA — sound, all synthesized with WebAudio. No audio files, no network:
// an engine hum that follows speed, a two-tone police siren, gunshots,
// punches, pickups, mission jingles and a quiet city hum. Everything runs
// through one master gain so M can mute it all.
import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let sirenTimer = 0;
  let muted = false;
  let unlocked = false;
  // Radio: three switchable synth stations, driven by an 8th-note step
  // sequencer. Each station is an 8-step bass line and lead line.
  let station = 0;
  let radioStep = 0;
  let radioTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // A one-second noise buffer, reused by every percussive sound.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      // Engine: a sawtooth through a lowpass, pitch and loudness follow speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a square wave that alternates between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // City hum: filtered noise, very quiet, always on once unlocked.
      const hum = ctx.createBufferSource();
      hum.buffer = noiseBuf;
      hum.loop = true;
      const humFilter = ctx.createBiquadFilter();
      humFilter.type = 'lowpass';
      humFilter.frequency.value = 220;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.018;
      hum.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(master);
      hum.start();
      unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  /** Call from any user gesture: browsers only allow audio after one. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, when) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, type) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  return {
    unlock,
    get muted() { return muted; },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    /** Engine hum follows the car's speed (0 when on foot). */
    engine(speed01, on) {
      if (!ctx || muted) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(280 + speed01 * 900, ctx.currentTime, 0.1);
    },
    /** The siren wails while any police car is near; call every frame. */
    siren(on, dt) {
      if (!ctx || muted) return;
      if (!on) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenPhase = 1 - sirenPhase;
        sirenOsc.frequency.value = sirenPhase ? 950 : 700;
      }
      sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.05);
    },
    shot() { noise(0.12, 0.5, 2600, 'highpass'); tone(140, 0.1, 'sine', 0.35); },
    punch() { noise(0.08, 0.3, 500); },
    pickup() { tone(660, 0.1, 'sine', 0.22); tone(880, 0.16, 'sine', 0.22, 0.09); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, i * 0.11)); },
    click() { tone(920, 0.05, 'square', 0.12); },
    explode() { noise(0.9, 0.7, 420); tone(70, 0.7, 'sine', 0.5); },
    hurt() { tone(180, 0.18, 'sawtooth', 0.2); },
    steal() { tone(440, 0.08, 'square', 0.15); tone(587, 0.12, 'square', 0.15, 0.08); },
    busted() { tone(392, 0.3, 'triangle', 0.25); tone(311, 0.5, 'triangle', 0.25, 0.28); },
    /** The radio plays while driving. Call every frame with dt. */
    radioTick(dt, driving) {
      if (!ctx || muted || !driving) { radioTimer = 0; return; }
      const st = RADIO_STATIONS[station] || RADIO_STATIONS[0];
      const stepDur = 60 / st.bpm / 2; // 8th notes
      radioTimer += dt;
      while (radioTimer >= stepDur) {
        radioTimer -= stepDur;
        const bass = st.bass[radioStep % st.bass.length];
        const lead = st.lead[radioStep % st.lead.length];
        if (bass) tone(bass, 0.22, 'triangle', 0.13);
        if (lead) tone(lead, 0.16, st.wave, 0.055);
        radioStep = (radioStep + 1) % 8;
      }
    },
    cycleStation() {
      station = (station + 1) % RADIO_STATIONS.length;
      radioStep = 0;
      radioTimer = 0;
      return RADIO_STATIONS[station].name;
    },
    stationName() { return RADIO_STATIONS[station].name; },
    get unlocked() { return unlocked; },
  };
}
