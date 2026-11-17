// SOLMARA — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between screens: title, play, paused, busted, wasted and done.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import {
  createWorld,
  EVENT_BUSTED,
  EVENT_EXPLODE,
  EVENT_HIT,
  EVENT_KILL,
  EVENT_MISSION,
  EVENT_PICKUP,
  EVENT_PUNCH,
  EVENT_SHOT,
  EVENT_STEAL,
  EVENT_WANTED,
  EVENT_WASTED,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_ENTER,
  ACTION_MUTE,
  ACTION_NEW,
  ACTION_PAUSE,
  ACTION_PUNCH,
  ACTION_RELOAD,
  ACTION_SAVE,
  ACTION_WEAPON,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_BUSTED,
  SCREEN_DONE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = buildCity(random);
const world = createWorld(random, city);
const renderer = createRenderer(canvas, city);
const audio = createAudio();
// A handle for automated play-tests (and curious players): the live world.
window.__solmara = { world, city, seed, renderer };

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    const save = world.serialize();
    save.seed = seed;
    save.at = Date.now();
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best fortune then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { hasSave: false, best: 0, prompt: null, mouse: null }, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  // A handle for automated play-tests: the live input as well as the world.
  window.__solmara.input = input;
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let ui = { hasSave: !!save, best, prompt: null, mouse: null };

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fromSave) {
    world.reset();
    if (fromSave && save) {
      world.deserialize(save);
      announce('Continuing your story.');
    } else {
      announce('Playing. Drive to the yellow marker.');
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_STEAL) audio.steal();
    if (events & EVENT_EXPLODE) audio.explode();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_KILL) announce('Rival down.');
    if (events & EVENT_WANTED) announce(`Wanted level ${world.state.wanted}. The police are coming.`);
    if (events & EVENT_MISSION) {
      audio.mission();
      writeSave();
      const money = world.state.money;
      if (money > best) {
        best = money;
        saveBest(best);
        ui.best = best;
      }
      announce(`Job done. $${world.state.money} in the bank.`);
      if (world.state.mission.done) {
        screen = SCREEN_DONE;
        announce('Story complete. King of Solmara.');
      }
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_BUSTED;
      announce('Busted. The police took $150.');
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      screen = SCREEN_WASTED;
      announce('Wasted. Vera patched you up.');
    }
  }

  function buildCtl(actions) {
    const held = input.held;
    const aim = renderer.screenToWorld(world.state, input.mouse.x, input.mouse.y);
    return {
      up: held.up,
      down: held.down,
      left: held.left,
      right: held.right,
      run: held.run,
      handbrake: held.handbrake,
      enterPressed: !!(actions & ACTION_ENTER),
      punchPressed: !!(actions & ACTION_PUNCH),
      fireHeld: input.mouse.down,
      reloadPressed: !!(actions & ACTION_RELOAD),
      toggleWeapon: !!(actions & ACTION_WEAPON),
      aimX: aim.x,
      aimY: aim.y,
    };
  }

  function nearestCarPrompt() {
    const p = world.state.player;
    if (p.car) return 'E — Get out';
    const car = world.nearestCar(52);
    if (car) return car.driver === 'traffic' ? 'E — Steal this car' : 'E — Get in';
    return null;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Muted.' : 'Sound on.');
    }
    // Audio only starts after a real gesture; asking every frame just logs
    // the browser's autoplay warning over and over.
    if (actions !== 0 || input.mouse.down) audio.unlock();
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (screen === SCREEN_TITLE) {
      world.step(STEP, {
        up: false, down: false, left: false, right: false, run: false, handbrake: false,
        enterPressed: false, punchPressed: false, fireHeld: false, reloadPressed: false,
        toggleWeapon: false, aimX: 0, aimY: 0,
      });
      if (actions & ACTION_NEW) startGame(false);
      else if (actions & ACTION_CONFIRM) startGame(!!save);
      ui.hasSave = !!save;
      ui.best = best;
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        const ctl = buildCtl(actions);
        const events = world.step(STEP, ctl);
        handleEvents(events);
        // Engine and siren follow the world.
        const p = world.state.player;
        audio.engine(p.car ? Math.abs(p.car.vf) / 520 : 0, !!p.car);
        const policeNear = world.state.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 500);
        audio.siren(policeNear || world.state.wanted > 0, STEP);
        ui.prompt = nearestCarPrompt();
        ui.mouse = { x: input.mouse.x, y: input.mouse.y };
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_SAVE) {
        if (writeSave()) {
          save = readSave();
          ui.hasSave = true;
          announce('Progress saved.');
        } else {
          announce('Could not save in this browser.');
        }
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        world.respawn();
        screen = SCREEN_PLAY;
        announce('Back on the street.');
      }
    } else if (screen === SCREEN_DONE) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Free roam. Solmara is yours.');
      }
    }

    renderer.draw(world.state, screen, ui, now / 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmara. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
