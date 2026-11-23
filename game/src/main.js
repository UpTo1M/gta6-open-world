// Boot and game loop for SOLMARA. Wires the simulation (world.js), the
// renderer (render.js), the synth audio (audio.js) and the input (input.js)
// together, runs the title → play → pause → busted/wasted state machine,
// and owns the localStorage save under solmara.save.v3.

import { createWorld, updateWorld, saveWorld, loadWorld, hasSave, respawnPlayer, playerCar, playerPos, buyUpgrade } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { setupShot } from './shots.js';
import { beginMission } from './missions.js';
import { SAVE_KEY } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const storage = (() => {
  try {
    if (typeof window.localStorage !== 'undefined') return window.localStorage;
  } catch (e) { /* private mode */ }
  return null;
})();

const world = createWorld(seed, { storage });
const input = createInput();
const audio = createAudio();
input.attach(canvas);

let lastT = performance.now();
let view = { width: 0, height: 0, baseZoom: 1 };
let shotCam = null;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  view.width = window.innerWidth;
  view.height = window.innerHeight;
  view.baseZoom = dpr;
}
window.addEventListener('resize', resize);
resize();

// Save on load if one exists.
if (hasSave(storage)) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw && loadWorld(world, raw)) {
      world.ui.title = false;
    }
  } catch (e) { /* corrupted save: start fresh */ }
}

if (shotName) {
  shotCam = setupShot(world, shotName);
  world.ui.title = shotName === 'start';
  if (shotName !== 'start') world.ui.title = false;
}

function startGame() {
  audio.unlock();
  if (world.ui.title) {
    world.ui.title = false;
    if (world.mission.index === 0 && !world.mission.started) {
      beginMission(world, 0);
    }
  }
}

canvas.addEventListener('mousedown', () => {
  if (world.ui.title) startGame();
  audio.unlock();
});

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const inp = input.read();

  // Mouse position in world coordinates (for aiming).
  const cam = currentCamera();
  inp.mouseWorldX = cam.x + (inp.mouseX - view.width / 2) / cam.zoom;
  inp.mouseWorldY = cam.y + (inp.mouseY - view.height / 2) / cam.zoom;

  if (inp.m) {
    audio.setMuted(!audio.isMuted());
    world.ui.muted = audio.isMuted();
  }
  if (inp.p && !world.ui.title) {
    world.ui.paused = !world.ui.paused;
  }
  if (world.ui.paused && inp.enter) {
    world.ui.paused = false;
  }

  // Title screen.
  if (world.ui.title) {
    if (inp.enter || inp.mouseDown) startGame();
  } else if (world.ui.gameOver) {
    if (inp.enter) {
      respawnPlayer(world);
      beginMission(world, world.mission.index);
    }
  } else if (world.ui.card) {
    if (inp.enter) {
      if (world.ui.card.kind === 'fail') {
        respawnPlayer(world);
        beginMission(world, world.mission.index);
      } else if (world.ui.card.kind === 'payout') {
        world.ui.card = null;
        const next = world.mission.index;
        if (next < 10 && !world.mission.done) beginMission(world, next);
      } else {
        // Brief card: the mission is already begun (beginMission showed
        // the card); just dismiss it — updateMissions starts the first
        // step on the next tick. Calling beginMission again here would
        // re-show the brief and the card could never be dismissed.
        world.ui.card = null;
      }
    }
  } else if (!world.ui.paused) {
    const events = updateWorld(world, inp, dt);
    for (const e of events) {
      if (e.type === 'shot') audio.shot(e.weapon);
      else if (e.type === 'enemyShot') audio.enemyShot();
      else if (e.type === 'hit') audio.hit();
      else if (e.type === 'hurt') audio.hurt();
      else if (e.type === 'pickup') audio.pickup();
      else if (e.type === 'jingle') audio.jingle();
      else if (e.type === 'fail') audio.fail();
      else if (e.type === 'crash') audio.crash();
      else if (e.type === 'save') saveWorld(world);
    }
    // Engine hum + siren + radio follow the world state.
    const car = playerCar(world);
    audio.engine(car ? Math.abs(car.speed) / 330 : 0, !!car);
    const wanted = world.player.heat >= 12;
    audio.siren(wanted, world.time);
    if (car && !world.ui.muted) audio.startRadio();
    else audio.stopRadio();
  }

  // Shop number keys: 1 armor, 2 engine, 3 nitro (while the shop is open).
  if (world.ui.shopOpen && inp.wheelPick && inp.wheel) {
    const map = { pistol: 'armor', smg: 'engine', shotgun: 'nitro' };
    if (map[inp.wheel]) buyUpgrade(world, map[inp.wheel]);
  }

  render(ctx, world, view);
  requestAnimationFrame(frame);
}

function currentCamera() {
  const pp = playerPos(world);
  const car = playerCar(world);
  const speed01 = car ? Math.min(1, Math.abs(car.speed) / 330) : 0;
  const zoom = Math.max(0.7, Math.min(1.05, 1.05 - speed01 * 0.35)) * (view.baseZoom || 1);
  if (shotCam) {
    return { x: shotCam.x, y: shotCam.y, zoom };
  }
  return {
    x: pp.x,
    y: pp.y,
    zoom,
  };
}

// Test hook: headless runs drive the game through this handle.
window.__solmara = { world, input, audio, startGame, respawnPlayer };

requestAnimationFrame(frame);
