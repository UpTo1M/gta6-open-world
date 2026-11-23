// Screenshot scenes for SOLMARA. The page reads ?shot=<name>&seed=<n> and
// this module puts the world into that exact state, so screenshots/ are
// real renders of the game's own code — the same scenes shots.json lists.

import { PLACES } from './config.js';
import { beginMission } from './missions.js';
import { playerCar } from './world.js';

// Each scene returns the camera centre the renderer should frame.
export function setupShot(w, name) {
  const p = w.player;
  switch (name) {
    case 'start':
      // Title screen over the living city.
      w.ui.title = true;
      return { x: 1160, y: 960 };
    case 'drive': {
      // Kai in a Comet GT, mid-drive down an avenue.
      w.ui.title = false;
      const car = w.cars.find((c) => c.type === 'comet' && c.driver === 'parked')
        || w.cars.find((c) => c.driver === 'parked');
      if (car) {
        car.driver = 'player';
        car.x = 1120;
        car.y = 900;
        car.angle = -Math.PI / 2;
        car.speed = 200;
        p.carId = car.id;
        p.onFoot = false;
      }
      p.money = 2450;
      p.jobsDone = 3;
      return { x: 1120, y: 800 };
    }
    case 'chase': {
      // Wanted 4: helicopter overhead, roadblocks ahead, cruisers closing in.
      w.ui.title = false;
      const car = w.cars.find((c) => c.type === 'muscle' && c.driver === 'parked')
        || w.cars.find((c) => c.driver === 'parked');
      if (car) {
        car.driver = 'player';
        car.x = 1120;
        car.y = 1000;
        car.angle = -Math.PI / 2;
        car.speed = 240;
        p.carId = car.id;
        p.onFoot = false;
      }
      p.heat = 72;
      p.lastCrimeAt = w.time;
      p.money = 5300;
      p.jobsDone = 6;
      p.weapon = 'shotgun';
      p.drawn = true;
      // A cruiser right behind, a roadblock ahead.
      const chase = w.cars.find((c) => c.driver === 'police' && c.type === 'cruiser');
      if (chase) {
        chase.x = 1120;
        chase.y = 1150;
        chase.angle = -Math.PI / 2;
        chase.speed = 220;
      }
      return { x: 1120, y: 960 };
    }
    case 'mission': {
      // Mid-job: The Ambush, crew ahead, objective marker on the alley.
      w.ui.title = false;
      beginMission(w, 2);
      w.ui.card = null;
      w.mission.started = true;
      p.x = 1120;
      p.y = 1300;
      p.angle = -Math.PI / 2;
      p.onFoot = true;
      p.drawn = true;
      p.money = 1250;
      p.jobsDone = 2;
      // Spawn the ambush crew in view.
      for (let i = 0; i < 3; i++) {
        w.enemies.push({
          x: 1060 + i * 60, y: 1420, angle: Math.PI / 2, hp: 100,
          state: 'combat', fireT: 1, mission: true, speed: 125, flash: 0,
        });
      }
      return { x: 1120, y: 1380 };
    }
    default:
      w.ui.title = false;
      return { x: p.x, y: p.y };
  }
}

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];
