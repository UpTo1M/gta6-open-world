// SOLMARA — the story. Four jobs from Vera Solano, each a list of steps the
// player walks through. The engine owns the mission state (which job, which
// step, what has spawned) and tells the world what to show and spawn.
import { EVENT_MISSION, EVENT_STEP } from './config.js';
import { MISSIONS, PLACES } from './config.js';

export function createMissions(random) {
  const state = {
    index: 0,
    step: 0,
    completed: [],
    active: false,
    done: false,
    suppress: false, // the screenshot scenes set this to keep a job from auto-starting
    nextDelay: 0,
    stepStarted: false,
    holdProgress: 0,
    enemiesSpawned: 0,
  };

  function current() {
    return MISSIONS[state.index] || null;
  }

  function currentStep() {
    const m = current();
    return m ? m.steps[state.step] : null;
  }

  function placeOf(step) {
    return PLACES[step.loc];
  }

  function startMission(hooks) {
    const m = current();
    if (!m) return;
    state.active = true;
    state.step = 0;
    state.stepStarted = false;
    state.holdProgress = 0;
    state.enemiesSpawned = 0;
    hooks.setDialogue([...m.intro]);
    hooks.setBanner(`${m.name} — ${m.giver}`, 4);
  }

  function advanceStep(world, hooks) {
    const m = current();
    if (!m) return;
    state.step += 1;
    state.stepStarted = false;
    state.holdProgress = 0;
    if (state.step >= m.steps.length) {
      // Mission complete.
      world.money += m.reward;
      world.player.money = world.money;
      state.completed.push(m.id);
      state.active = false;
      state.nextDelay = 4.5;
      hooks.setBanner(`MISSION COMPLETE — ${m.name}  +$${m.reward}`, 4);
      hooks.setDialogue([m.outro]);
      if (state.index >= MISSIONS.length - 1) {
        state.done = true;
        hooks.setBanner('STORY COMPLETE — King of Solmara', 6);
      } else {
        state.index += 1;
      }
    }
  }

  function update(world, dt, ctl, hooks) {
    let events = 0;
    if (state.done || state.suppress) return events;
    const doneBefore = state.completed.length;
    if (!state.active) {
      if (state.nextDelay > 0) {
        state.nextDelay -= dt;
        if (state.nextDelay <= 0) startMission(hooks);
      } else if (state.index < MISSIONS.length && state.completed.length === 0 && state.step === 0 && world.time < 1) {
        // The first job starts shortly after the game begins.
        state.nextDelay = 2;
      } else if (state.index < MISSIONS.length) {
        startMission(hooks);
      }
      return events;
    }
    const m = current();
    const step = currentStep();
    if (!m || !step) return events;
    const p = world.player;
    const place = placeOf(step);

    // Run a step's one-time setup the first frame it is current.
    if (!state.stepStarted) {
      state.stepStarted = true;
      if (step.type === 'kill') {
        const n = step.enemies || 3;
        for (let i = 0; i < n; i += 1) {
          hooks.spawnEnemy(place.x, place.y);
        }
        state.enemiesSpawned = n;
      }
      if (step.type === 'collect') {
        // The vault job draws the whole department.
        if (step.wanted) hooks.addWanted(step.wanted, 'job');
      }
    }

    const dist = Math.hypot(p.x - place.x, p.y - place.y);
    switch (step.type) {
      case 'goto':
      case 'deliver':
      case 'escape': {
        if (dist < step.radius) {
          advanceStep(world, hooks);
          events |= EVENT_STEP;
        }
        break;
      }
      case 'pickup': {
        // Walk up to the marker and the package is yours.
        if (!p.car && dist < step.radius) {
          advanceStep(world, hooks);
          events |= EVENT_STEP;
        }
        break;
      }
      case 'steal': {
        const car = world.cars.find((c) => c.missionCar);
        if (p.car && car && p.car === car) {
          advanceStep(world, hooks);
          events |= EVENT_STEP;
        }
        break;
      }
      case 'deliverCar': {
        const car = world.cars.find((c) => c.missionCar);
        if (p.car && car && p.car === car && dist < step.radius) {
          advanceStep(world, hooks);
          events |= EVENT_STEP;
        }
        break;
      }
      case 'kill': {
        const alive = world.enemies.filter((e) => !e.dead).length;
        if (state.enemiesSpawned > 0 && alive === 0) {
          advanceStep(world, hooks);
          events |= EVENT_STEP;
        }
        break;
      }
      case 'collect': {
        if (!p.car && dist < step.radius) {
          state.holdProgress += dt;
          if (state.holdProgress >= (step.holdTime || 3)) {
            advanceStep(world, hooks);
            events |= EVENT_STEP;
          }
        } else {
          state.holdProgress = Math.max(0, state.holdProgress - dt * 2);
        }
        break;
      }
      default:
        break;
    }
    if (events & EVENT_STEP) {
      // A step done is worth a small chime and a fresh objective.
      if (current() && state.active) {
        // keep going
      }
    }
    // A job finishing is a mission event: jingle, save, and the next job.
    if (state.completed.length > doneBefore) events |= EVENT_MISSION;
    return events;
  }

  function reset() {
    state.index = 0;
    state.step = 0;
    state.completed = [];
    state.active = false;
    state.done = false;
    state.suppress = false;
    state.nextDelay = 0;
    state.stepStarted = false;
    state.holdProgress = 0;
    state.enemiesSpawned = 0;
  }

  // Keep a job from auto-starting (the chase screenshot uses this).
  function suppressAuto() {
    state.suppress = true;
  }

  function restartCurrent() {
    // Busted or wasted mid-job: the job starts over from its first step.
    if (state.active) {
      state.step = 0;
      state.stepStarted = false;
      state.holdProgress = 0;
      state.enemiesSpawned = 0;
      for (const e of []) { /* enemies are cleared by the world on respawn */ }
    }
  }

  function load(index, step, completed) {
    state.index = index;
    state.step = step;
    state.completed = [...completed];
    state.active = false;
    state.done = state.completed.length >= MISSIONS.length;
    state.nextDelay = 1.5;
    state.stepStarted = false;
    state.holdProgress = 0;
    state.enemiesSpawned = 0;
  }

  // Put a mission in play at once (the screenshot scenes use this).
  function forceStart(index, stepIndex) {
    state.index = index;
    state.step = stepIndex || 0;
    state.completed = MISSIONS.slice(0, index).map((m) => m.id);
    state.active = true;
    state.done = false;
    state.nextDelay = 0;
    state.stepStarted = false;
    state.holdProgress = 0;
    state.enemiesSpawned = 0;
  }

  return { state, current, currentStep, update, reset, restartCurrent, load, forceStart, suppressAuto };
}
