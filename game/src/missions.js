// The story engine for SOLMARA: walks the ten jobs in config.js, one step
// at a time. It is deliberately independent of world.js (no import cycle):
// it reads and writes the same world object — player, cars, enemies,
// racers, heat, money — using the entity shapes documented in world.js.

import { MISSIONS, RACE_CHECKPOINTS, WANTED, WEAPONS } from './config.js';
import { dist, clamp } from './random.js';

export function createMissionState() {
  return {
    index: 0, step: 0, stepState: {}, timer: 0,
    kills: 0, started: false, failed: false, failReason: '',
    done: false, missionCarId: null,
  };
}

export function currentMission(m) {
  return MISSIONS[m.index] || null;
}

export function missionObjective(w) {
  const m = w.mission;
  const def = currentMission(m);
  if (!def || m.done) return '';
  const step = def.steps[m.step];
  if (!step) return '';
  if (step.type === 'race' && w.race) {
    return `${step.label} — checkpoint ${w.race.playerCp + 1}/${w.race.checkpoints.length} · ${Math.ceil(w.race.timeLeft)}s`;
  }
  if (step.type === 'timed') {
    return `${step.label} — ${Math.ceil(m.timer)}s left`;
  }
  if (step.type === 'kill') {
    return `${step.label} — ${m.kills || 0}/${step.count}`;
  }
  return step.label;
}

// The same fail path world.js uses for busted/wasted/race losses, kept
// here so both modules stay in sync: mark failed, clear mission entities,
// show the fail card.
export function failMission(w, reason) {
  const m = w.mission;
  if (m.index >= MISSIONS.length) return;
  m.failed = true;
  m.failReason = reason;
  w.enemies = w.enemies.filter((e) => !e.mission);
  w.racers = [];
  w.race = null;
  w.player.carrying = null;
  w.ui.card = { kind: 'fail', title: 'Job failed', text: reason, reward: 0 };
  w.events.push({ type: 'fail' });
}

function spawnStepEnemies(w, x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = w.rng.range(0, Math.PI * 2);
    const r = w.rng.range(60, 170);
    w.enemies.push({
      x: clamp(x + Math.cos(a) * r, 40, 2560 - 40),
      y: clamp(y + Math.sin(a) * r, 40, 1920 - 40),
      angle: 0, hp: 100, state: 'combat', fireT: w.rng.range(0.4, 1.4),
      mission: true, speed: 125, flash: 0,
    });
  }
}

function spawnStepCar(w, type, x, y) {
  const def = { hp: 120 };
  const car = {
    id: (w.cars.reduce((m, c) => Math.max(m, c.id), 0) + 1),
    type, x, y, angle: 0, speed: 0,
    hp: def.hp, maxHp: def.hp, driver: 'mission',
    target: null, flash: 0, dead: false,
  };
  w.cars.push(car);
  return car;
}

function startRace(w, step) {
  w.race = {
    checkpoints: RACE_CHECKPOINTS.map((c) => ({ ...c })),
    timeLeft: step.time, playerCp: 0, playerFinished: false,
  };
  w.racers = [
    { name: 'Rico', color: '#e11d48', type: 'comet', speed: 175, x: 800, y: 190, angle: 0, cp: 0, finished: false },
    { name: 'Dante', color: '#f97316', type: 'muscle', speed: 160, x: 800, y: 130, angle: 0, cp: 0, finished: false },
  ];
  w.ui.card = null;
  w.events.push({ type: 'toast', text: 'Race! Beat Rico to the Strip' });
}

function startStep(w) {
  const m = w.mission;
  const def = currentMission(m);
  if (!def) return;
  const step = def.steps[m.step];
  if (!step) return;
  m.stepState = {};
  m.kills = 0;
  if (step.type === 'kill') {
    spawnStepEnemies(w, step.x, step.y, step.count);
  } else if (step.type === 'car') {
    const car = spawnStepCar(w, 'comet', step.x, step.y + 40);
    m.missionCarId = car.id;
  } else if (step.type === 'race') {
    // A race car waits at the lineup so the player can actually race.
    const car = spawnStepCar(w, 'comet', 800, 220);
    m.missionCarId = car.id;
    // The player starts the race already in the race car, like a real
    // street-race lineup — no scramble to steal it while the clock runs
    // and the rivals pull away. (A human would waste the same seconds.)
    const p = w.player;
    if (p.carId && p.carId !== car.id) {
      const old = w.cars.find((c) => c.id === p.carId);
      if (old) { old.driver = 'parked'; old.speed = 0; }
    }
    p.carId = car.id;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    car.driver = 'player';
    startRace(w, step);
  } else if (step.type === 'timed') {
    m.timer = step.time;
  } else if (step.type === 'escape') {
    // Pin the heat at the escape's star level for the whole step.
    const threshold = WANTED.thresholds[step.stars] || 48;
    w.player.heat = Math.max(w.player.heat, threshold + 2);
    w.player.lastCrimeAt = w.time;
    m.stepState.escapeStars = step.stars;
  }
  m.started = true;
}

function advanceStep(w) {
  const m = w.mission;
  const def = currentMission(m);
  if (!def) return;
  m.step += 1;
  m.started = false;
  if (m.step >= def.steps.length) {
    completeMission(w, def);
  }
}

function completeMission(w, def) {
  const m = w.mission;
  const p = w.player;
  p.money += def.reward;
  w.stats.earned += def.reward;
  p.jobsDone += 1;
  p.standing[def.district] = Math.min(3, (p.standing[def.district] || 0) + 1);
  p.carrying = null;
  p.heat = 0;
  w.race = null;
  w.racers = [];
  m.index += 1;
  m.step = 0;
  m.started = false;
  m.failed = false;
  w.events.push({ type: 'jingle' });
  w.events.push({ type: 'save' });
  if (m.index >= MISSIONS.length) {
    m.done = true;
    w.ui.card = {
      kind: 'payout', title: 'Story complete',
      text: `All ten jobs done. $${w.stats.earned} earned in Solmara. The city is yours, King.`,
      reward: def.reward,
    };
  } else {
    const next = MISSIONS[m.index];
    w.ui.card = {
      kind: 'payout', title: `${def.title} — done`,
      text: `Paid $${def.reward}. Next job: ${next.title} ($${next.reward}).`,
      reward: def.reward,
    };
  }
}

export function beginMission(w, index) {
  const m = w.mission;
  m.index = index;
  m.step = 0;
  m.started = false;
  m.failed = false;
  m.done = false;
  m.missionCarId = null;
  const def = currentMission(m);
  if (def) {
    w.ui.card = { kind: 'brief', title: def.title, text: def.brief, reward: def.reward };
  }
}

function playerXY(w) {
  const car = w.cars.find((c) => c.id === w.player.carId);
  if (car) return { x: car.x, y: car.y };
  return { x: w.player.x, y: w.player.y };
}

export function updateMissions(w, dt) {
  const m = w.mission;
  if (m.done || m.index >= MISSIONS.length) return;
  if (w.ui.title || w.ui.paused || w.ui.gameOver) return;
  if (m.failed) return; // main.js restarts the mission after the fail card
  const def = currentMission(m);
  if (!def) return;
  if (!m.started) {
    startStep(w);
    return;
  }
  const step = def.steps[m.step];
  if (!step) return;
  const pp = playerXY(w);

  // A step that depends on the mission car fails if that car is destroyed
  // (except the race, which can be won in any car).
  if (step.type !== 'race' && m.missionCarId) {
    const mc = w.cars.find((c) => c.id === m.missionCarId);
    if (!mc || mc.dead) {
      failMission(w, 'The car was destroyed');
      return;
    }
  }

  // Escape steps keep the heat pinned while they run.
  if (step.type === 'escape') {
    const threshold = WANTED.thresholds[m.stepState.escapeStars || 3] || 48;
    if (w.player.heat < threshold) w.player.heat = threshold;
    w.player.lastCrimeAt = w.time;
  }

  switch (step.type) {
    case 'goto':
    case 'pickup': {
      if (dist(pp.x, pp.y, step.x, step.y) < step.r) {
        if (step.type === 'pickup') {
          w.events.push({ type: 'pickup' });
          w.player.carrying = def.id;
        }
        advanceStep(w);
      }
      break;
    }
    case 'car': {
      const car = w.cars.find((c) => c.id === m.missionCarId);
      if (!w.player.onFoot && w.player.carId === m.missionCarId && car) {
        advanceStep(w);
      }
      break;
    }
    case 'kill': {
      if ((m.kills || 0) >= step.count) advanceStep(w);
      break;
    }
    case 'race': {
      if (w.race && w.race.playerFinished) advanceStep(w);
      break;
    }
    case 'timed': {
      m.timer -= dt;
      if (dist(pp.x, pp.y, step.x, step.y) < step.r) {
        advanceStep(w);
      } else if (m.timer <= 0) {
        failMission(w, 'Out of time');
      }
      break;
    }
    case 'escape': {
      if (dist(pp.x, pp.y, step.x, step.y) < step.r) {
        w.player.heat = 0;
        advanceStep(w);
      }
      break;
    }
    default:
      break;
  }
}

// The weapon a rank unlocks, for the HUD and the wheel.
export function weaponUnlocked(w, name) {
  const def = WEAPONS[name];
  return w.player.jobsDone >= def.unlockJobs;
}
