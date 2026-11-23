// SOLMARA — the story. Ten jobs from Vera Solano, each a list of steps the
// player walks through. The engine owns the mission state (which job, which
// step, what has spawned) and tells the world what to show and spawn.
import { EVENT_FAIL, EVENT_MISSION, EVENT_STEP } from './config.js';
import { MISSIONS, PLACES } from './config.js';

// The district a job's real work happens in: the first race/kill/collect/
// steal step, or the last step if the job has none of those. Finishing the
// job raises your standing in that district.
export function missionDistrict(m) {
  const keyStep = m.steps.find((s) => ['race', 'kill', 'collect', 'steal'].includes(s.type));
  const loc = keyStep
    ? (keyStep.loc || (keyStep.checkpoints && keyStep.checkpoints[0]))
    : m.steps[m.steps.length - 1].loc;
  const place = PLACES[loc];
  if (!place) return 'docks';
  if (place.y < 640) return 'harbor';
  if (place.y < 1280) return 'mara';
  return 'docks';
}

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
    timeLeft: 0, // seconds left on a timed step
    race: null, // { checkpoints, idx, timeLeft } while a race step runs
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
    state.timeLeft = 0;
    hooks.setDialogue([...m.intro]);
    hooks.setBanner(`${m.name} — ${m.giver}`, 4);
    hooks.setCard(m.name, [
      `${m.giver} — $${m.reward} on completion`,
      ...m.steps.map((s, i) => `${i + 1}. ${s.text}`),
    ], 4.5);
  }

  function advanceStep(world, hooks) {
    const m = current();
    if (!m) return;
    // Leaving a race step clears the racers with it.
    if (state.race && hooks.clearRacers) hooks.clearRacers();
    state.race = null;
    state.step += 1;
    state.stepStarted = false;
    state.holdProgress = 0;
    state.timeLeft = 0;
    if (state.step >= m.steps.length) {
      // Mission complete.
      world.money += m.reward;
      world.player.money = world.money;
      world.earned = (world.earned || 0) + m.reward;
      state.completed.push(m.id);
      state.active = false;
      state.nextDelay = 4.5;
      // The job's district hears about it.
      if (hooks.addStanding) hooks.addStanding(missionDistrict(m), 1);
      // Vera patches the player up between jobs.
      if (hooks.healPlayer) hooks.healPlayer();
      hooks.setBanner(`MISSION COMPLETE — ${m.name}  +$${m.reward}`, 4);
      hooks.setDialogue([m.outro]);
      const next = MISSIONS[state.index + 1];
      hooks.setCard('MISSION COMPLETE', [
        `${m.name}  +$${m.reward}`,
        next ? `Next job: ${next.name} — $${next.reward}` : 'Every job done. King of Solmara.',
        'Vera patched you up — full health for the next job.',
      ], 4);
      if (state.index >= MISSIONS.length - 1) {
        state.done = true;
        hooks.setBanner('STORY COMPLETE — King of Solmara', 6);
      } else {
        state.index += 1;
      }
    }
  }

  // A timed step ran out: the job restarts from its first step.
  function failMission(world, hooks, reason) {
    const m = current();
    if (!m) return;
    hooks.clearEnemies();
    if (hooks.clearRacers) hooks.clearRacers();
    state.race = null;
    state.step = 0;
    state.stepStarted = false;
    state.holdProgress = 0;
    state.timeLeft = 0;
    state.enemiesSpawned = 0;
    const line = reason === 'rival' ? (m.failRival || m.fail || 'Vera: That one got away. We go again.') : (m.fail || 'Vera: That one got away. We go again.');
    hooks.setBanner(reason === 'rival' ? 'RICO WON THE RACE' : 'TOO SLOW — the deal moved on', 3.5);
    hooks.setDialogue([line]);
    hooks.setCard(m.name, [reason === 'rival' ? 'Rico beat you to the line — the job restarts.' : 'Too slow — the job restarts.', line], 3.5);
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
    // Race steps have checkpoints, not one place — no single distance.
    const place = step.loc ? placeOf(step) : null;
    const dist = place ? Math.hypot(p.x - place.x, p.y - place.y) : Infinity;
    if (!state.stepStarted) {
      state.stepStarted = true;
      if (step.type === 'kill') {
        const n = step.enemies || 3;
        for (let i = 0; i < n; i += 1) {
          hooks.spawnEnemy(place.x, place.y);
        }
        state.enemiesSpawned = n;
        // A crew fight is the crew's fight: the police lose the trail when
        // it starts, so the player is not fighting the crew and the whole
        // department at once. (A step that brings its own heat, like the
        // finale, adds it back right after this.)
        if (hooks.clearHeat) hooks.clearHeat();
      }
      // Any step can bring the heat: the vault job and the finale both do.
      if (step.wanted) hooks.addWanted(step.wanted, 'job');
      if (step.type === 'timed') state.timeLeft = step.timeLimit || 60;
      if (step.type === 'race') {
        state.race = { checkpoints: step.checkpoints || [], idx: 0, timeLeft: step.timeLimit || 80 };
        if (hooks.spawnRacers) hooks.spawnRacers(step.checkpoints || [], step.rivals || 2);
        hooks.setBanner('RACE — hit every checkpoint before Rico does', 3);
      }
    }

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
      case 'timed': {
        // Reach the marker before the clock runs out.
        state.timeLeft -= dt;
        if (dist < step.radius) {
          advanceStep(world, hooks);
          events |= EVENT_STEP;
        } else if (state.timeLeft <= 0) {
          failMission(world, hooks);
          events |= EVENT_FAIL;
        }
        break;
      }
      case 'race': {
        // Street race: drive through the checkpoints in order, before the
        // clock runs out — and before a rival finishes them all.
        const race = state.race;
        if (!race) break;
        race.timeLeft -= dt;
        const next = PLACES[race.checkpoints[race.idx]];
        if (next) {
          const cd = Math.hypot(p.x - next.x, p.y - next.y);
          if (cd < 70) {
            race.idx += 1;
            if (race.idx >= race.checkpoints.length) {
              if (hooks.addStanding) hooks.addStanding(missionDistrict(m), 1);
              advanceStep(world, hooks);
              events |= EVENT_STEP;
            } else {
              hooks.setBanner(`CHECKPOINT ${race.idx}/${race.checkpoints.length}`, 1.6);
            }
          }
        }
        if (race.timeLeft <= 0) {
          failMission(world, hooks);
          events |= EVENT_FAIL;
        } else if (world.raceLost) {
          failMission(world, hooks, 'rival');
          events |= EVENT_FAIL;
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
    state.timeLeft = 0;
    state.race = null;
  }

  // Keep a job from auto-starting (the chase screenshot uses this).
  function suppressAuto() {
    state.suppress = true;
  }

  function restartCurrent() {
    // Busted or wasted mid-job: the job starts over from its first step.
    // (The world clears the spawned enemies on respawn.)
    if (state.active) {
      state.step = 0;
      state.stepStarted = false;
      state.holdProgress = 0;
      state.timeLeft = 0;
      state.enemiesSpawned = 0;
      state.race = null;
    }
  }

  function load(index, step, completed) {
    state.index = index;
    state.step = step;
    state.completed = [...completed];
    state.active = true; // resume at the saved step, not from the job's start
    state.done = state.completed.length >= MISSIONS.length;
    state.nextDelay = 0;
    state.stepStarted = false;
    state.holdProgress = 0;
    state.timeLeft = 0;
    state.enemiesSpawned = 0;
    state.race = null;
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
    state.race = null;
  }

  return { state, current, currentStep, update, reset, restartCurrent, load, forceStart, suppressAuto };
}
