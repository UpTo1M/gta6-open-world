// All sound in SOLMARA is synthesised with WebAudio: engine hum, sirens,
// gunshots, jingles and three radio stations. No audio files, no network.
// In a headless or silent environment the whole module degrades to no-ops.

import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioNodes = null;
  let radioTimer = null;
  let muted = false;
  let station = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    engineOsc.connect(f);
    f.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  const scale = [0, 3, 5, 7, 10, 12, 15, 17];

  function radioStep(step) {
    if (!ctx || muted || radioNodes === null) return;
    const st = RADIO[station];
    const root = 55;
    const bassNote = st.bass[step % st.bass.length];
    const bassFreq = root * Math.pow(2, bassNote / 12);
    const leadNote = scale[(step * 3 + 2) % scale.length];
    const leadFreq = root * 4 * Math.pow(2, leadNote / 12);
    tone(bassFreq, 0.24, st.wave, 0.10);
    if (step % 2 === 0) tone(leadFreq, 0.16, 'square', 0.045);
    if (step % 4 === 0) noise(0.05, 0.05, 6000);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shot(weapon) {
      if (weapon === 'shotgun') noise(0.22, 0.5, 1400);
      else if (weapon === 'smg') noise(0.07, 0.28, 2600);
      else noise(0.12, 0.35, 2000);
      tone(weapon === 'shotgun' ? 90 : 160, 0.1, 'square', 0.12, 0, 50);
    },
    enemyShot() {
      noise(0.09, 0.16, 1800);
    },
    hit() {
      tone(220, 0.08, 'square', 0.1, 0, 110);
    },
    hurt() {
      tone(140, 0.25, 'sawtooth', 0.2, 0, 70);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.18);
      tone(880, 0.12, 'sine', 0.18, 0.09);
    },
    jingle() {
      tone(523, 0.14, 'sine', 0.2);
      tone(659, 0.14, 'sine', 0.2, 0.13);
      tone(784, 0.22, 'sine', 0.22, 0.26);
    },
    fail() {
      tone(330, 0.2, 'sawtooth', 0.16, 0, 220);
      tone(220, 0.3, 'sawtooth', 0.16, 0.18, 150);
    },
    crash() {
      noise(0.3, 0.4, 900);
    },
    engine(speed01, driving) {
      if (!ensure()) return;
      startEngine();
      if (muted) {
        engineGain.gain.value = 0;
        return;
      }
      engineGain.gain.value = driving ? 0.05 + speed01 * 0.06 : 0.02;
      engineOsc.frequency.value = 50 + speed01 * 130;
    },
    siren(on, t) {
      if (!ensure()) return;
      if (on) {
        startSiren();
        if (!muted) {
          sirenGain.gain.value = 0.045;
          sirenOsc.frequency.value = 650 + Math.sin(t * 4.5) * 220;
        } else sirenGain.gain.value = 0;
      } else if (sirenGain) {
        sirenGain.gain.value = 0;
      }
    },
    setStation(i) {
      station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
      this.stopRadio();
      this.startRadio();
      return station;
    },
    station() {
      return station;
    },
    startRadio() {
      if (!ensure() || radioTimer !== null) return;
      radioNodes = [];
      let step = 0;
      const st = RADIO[station];
      const interval = 60 / st.tempo / 2;
      radioTimer = setInterval(() => {
        if (muted) return;
        radioStep(step);
        step += 1;
      }, interval * 1000);
    },
    stopRadio() {
      if (radioTimer !== null) {
        clearInterval(radioTimer);
        radioTimer = null;
      }
      radioNodes = null;
    },
  };
}
