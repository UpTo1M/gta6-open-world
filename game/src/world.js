// The simulation for SOLMARA: player, cars, traffic, pedestrians, police,
// helicopter, roadblocks, racers, enemies, bullets, wanted heat and the
// garage. Pure logic — no canvas, no DOM — so the Node sim drives the same
// code the browser plays. The story engine (missions.js) runs inside the
// tick and manipulates the same entity arrays.
//
// Entity shapes (missions.js builds the same shapes):
//   car:    {id,type,x,y,angle,speed,hp,maxHp,driver,target,flash}
//   enemy:  {x,y,angle,hp,state,fireT,mission,speed,flash}
//   racer:  {x,y,angle,speed,cp,finished,name,color,type}
//   pickup: {x,y,kind,amount,t}
//   bullet: {x,y,vx,vy,life,damage,from}
//   ped:    {x,y,angle,speed,target,flee,down,downT}

import {
  WORLD, VEHICLES, WEAPONS, GARAGE, WANTED, PLACES, RANKS,
  STANDING_NAMES, SAVE_KEY, MISSIONS,
} from './config.js';
import { buildCity, collideCircle, nearestRoadPoint, nearestIntersection, randomRoadPoint, districtAt } from './city.js';
import { createRng, clamp, dist, angleTo, angleDiff } from './random.js';
import { updateMissions, createMissionState, failMission } from './missions.js';

let nextCarId = 1;

export function createWorld(seed = 1, opts = {}) {
  const rng = createRng(seed);
  const city = buildCity(seed);
  const w = {
    seed, rng, city, time: 0,
    storage: opts.storage || null,
    events: [],
    player: {
      x: PLACES.garage.x, y: PLACES.garage.y + 90, angle: -Math.PI / 2,
      onFoot: true, carId: null, health: 100, money: 120,
      heat: 0, lastCrimeAt: -99, bustT: 0, hurtFlash: 0, lastDamageAt: -99, ePrev: false,
      weapon: 'pistol', drawn: false,
      ammo: { pistol: 12, smg: 30, shotgun: 6 },
      fireT: 0, reloadT: 0, punchT: 0,
      jobsDone: 0, standing: { harbor: 0, stmara: 0, docks: 0 },
      upgrades: { armor: 0, engine: 0, nitro: 0 },
      radio: 0, nitroT: 0, nitroCd: 0,
      carrying: null, aimAngle: 0, moving: false,
    },
    cars: [], peds: [], cops: [], enemies: [], racers: [],
    bullets: [], particles: [], pickups: [],
    heli: null, roadblocks: [],
    mission: createMissionState(),
    ui: {
      title: true, paused: false, shopOpen: false, wheelOpen: false,
      card: null, toast: '', toastT: 0, gameOver: null, muted: false,
      objective: '',
    },
    stats: { earned: 0 },
    race: null,
  };

  // Traffic: 20 cars on the roads.
  const types = ['taxi', 'sedan', 'coupe', 'van', 'truck', 'pickup', 'muscle'];
  for (let i = 0; i < 20; i++) {
    const p = randomRoadPoint(rng);
    w.cars.push(makeCar(rng.pick(types), p.x, p.y, rng.range(0, Math.PI * 2), 'traffic'));
  }
  // Parked cars near the garage and the plaza.
  for (const [type, x, y] of [
    ['sedan', 480, 560], ['coupe', 560, 480], ['van', 400, 480],
    ['taxi', 1440, 880], ['pickup', 1520, 800],
  ]) {
    w.cars.push(makeCar(type, x, y, rng.range(0, Math.PI * 2), 'parked'));
  }
  // Pedestrians on the sidewalks.
  for (let i = 0; i < 34; i++) {
    const p = randomRoadPoint(rng);
    w.peds.push({
      x: p.x + rng.range(-50, 50), y: p.y + rng.range(-50, 50),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
      target: nearestIntersection(p.x, p.y), flee: 0, down: 0, downT: 0,
    });
  }
  // A couple of health/ammo pickups around town.
  w.pickups.push({ x: 480, y: 560, kind: 'health', amount: 40, t: 0 });
  w.pickups.push({ x: 1440, y: 880, kind: 'ammo', amount: 0, t: 0 });
  w.pickups.push({ x: 2080, y: 1440, kind: 'money', amount: 150, t: 0 });
  return w;
}

export function makeCar(type, x, y, angle, driver) {
  const def = VEHICLES[type] || VEHICLES.sedan;
  return {
    id: nextCarId++, type, x, y, angle, speed: 0,
    hp: def.hp, maxHp: def.hp, driver,
    target: null, flash: 0, dead: false,
  };
}

export function playerCar(w) {
  if (!w.player.carId) return null;
  return w.cars.find((c) => c.id === w.player.carId) || null;
}

export function starsOf(w) {
  const h = w.player.heat;
  let s = 0;
  for (let i = 0; i < WANTED.thresholds.length; i++) {
    if (h >= WANTED.thresholds[i]) s = i;
  }
  return s;
}

export function addHeat(w, amount) {
  w.player.heat = clamp(w.player.heat + amount, 0, 100);
  w.player.lastCrimeAt = w.time;
}

export function rankOf(jobsDone) {
  let r = RANKS[0].name;
  for (const rank of RANKS) if (jobsDone >= rank.jobs) r = rank.name;
  return r;
}

export function standingName(level) {
  return STANDING_NAMES[clamp(level, 0, 3)];
}

export function playerPos(w) {
  const car = playerCar(w);
  if (car) return { x: car.x, y: car.y };
  return { x: w.player.x, y: w.player.y };
}

function addParticles(w, x, y, n, color, speed = 120, life = 0.6, size = 3) {
  for (let i = 0; i < n; i++) {
    if (w.particles.length > 420) return;
    const a = w.rng.range(0, Math.PI * 2);
    const s = w.rng.range(speed * 0.3, speed);
    w.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: w.rng.range(life * 0.5, life), maxLife: life, color, size,
    });
  }
}

function spawnEnemies(w, x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = w.rng.range(0, Math.PI * 2);
    const r = w.rng.range(60, 170);
    w.enemies.push({
      x: clamp(x + Math.cos(a) * r, 40, WORLD.w - 40),
      y: clamp(y + Math.sin(a) * r, 40, WORLD.h - 40),
      angle: 0, hp: 100, state: 'combat', fireT: w.rng.range(0.4, 1.4),
      mission: true, speed: 125, flash: 0,
    });
  }
}

function spawnMissionCar(w, type, x, y) {
  const car = makeCar(type, x, y, 0, 'mission');
  w.cars.push(car);
  return car;
}

function spawnRacers(w) {
  const defs = [
    { name: 'Rico', color: '#e11d48', type: 'comet', speed: 175, x: 800, y: 190 },
    { name: 'Dante', color: '#f97316', type: 'muscle', speed: 160, x: 800, y: 130 },
  ];
  w.racers = defs.map((d) => ({
    ...d, angle: 0, cp: 0, finished: false, lapT: 0,
  }));
}

function spawnCop(w) {
  const p = playerPos(w);
  const a = w.rng.range(0, Math.PI * 2);
  const r = w.rng.range(260, 420);
  w.cops.push({
    x: clamp(p.x + Math.cos(a) * r, 40, WORLD.w - 40),
    y: clamp(p.y + Math.sin(a) * r, 40, WORLD.h - 40),
    angle: 0, state: 'chase', bustT: 0, fireT: w.rng.range(0.6, 1.6),
    hp: 100, flash: 0,
  });
}

function spawnPoliceCar(w) {
  const p = playerPos(w);
  const rp = nearestRoadPoint(p.x + w.rng.range(-300, 300), p.y + w.rng.range(-300, 300));
  const car = makeCar('cruiser', rp.x, rp.y, 0, 'police');
  w.cars.push(car);
  return car;
}

function spawnRoadblocks(w) {
  const p = playerPos(w);
  w.roadblocks = [];
  for (let i = 0; i < 2; i++) {
    const rp = nearestRoadPoint(p.x + (i === 0 ? 260 : -260), p.y + w.rng.range(-160, 160));
    const car = makeCar('cruiser', rp.x, rp.y, w.rng.range(0, Math.PI * 2), 'police');
    car.speed = 0;
    w.cars.push(car);
    w.roadblocks.push({ carId: car.id, x: rp.x, y: rp.y });
  }
  w.events.push({ type: 'toast', text: 'Roadblocks ahead — the PD sealed the streets' });
}

function damagePlayer(w, dmg, from) {
  if (w.player.health <= 0) return;
  w.player.health -= dmg;
  w.player.hurtFlash = 0.35;
  w.player.lastDamageAt = w.time;
  w.events.push({ type: 'hurt' });
  if (w.player.health <= 0) {
    w.player.health = 0;
    wastePlayer(w);
  }
}

function wastePlayer(w) {
  w.player.money = Math.max(0, w.player.money - 100);
  w.ui.gameOver = 'wasted';
  w.events.push({ type: 'wasted' });
  failMission(w, 'You got wasted');
}

function bustPlayer(w) {
  w.player.money = Math.max(0, w.player.money - 100);
  w.player.heat = 0;
  w.ui.gameOver = 'busted';
  w.events.push({ type: 'busted' });
  failMission(w, 'Busted by the PD');
}

export function respawnPlayer(w) {
  const car = playerCar(w);
  if (car) {
    car.driver = 'parked';
    w.player.carId = null;
  }
  w.player.onFoot = true;
  w.player.x = PLACES.garage.x;
  w.player.y = PLACES.garage.y + 90;
  w.player.angle = -Math.PI / 2;
  w.player.health = 100;
  w.player.heat = 0;
  w.player.bustT = 0;
  w.cops = [];
  w.heli = null;
  w.roadblocks = [];
  w.ui.gameOver = null;
  w.ui.card = null;
  // Restart the current mission from its first step.
  w.mission.step = 0;
  w.mission.stepState = {};
  w.mission.failed = false;
  w.mission.timer = 0;
  w.mission.started = false;
}

export function buyUpgrade(w, kind) {
  const def = GARAGE[kind];
  if (!def) return false;
  const level = w.player.upgrades[kind];
  if (level >= def.max) return false;
  if (w.player.money < def.price) return false;
  w.player.money -= def.price;
  w.player.upgrades[kind] = level + 1;
  if (kind === 'armor') {
    const car = playerCar(w);
    if (car) {
      car.maxHp += 60;
      car.hp = car.maxHp;
    }
  }
  w.events.push({ type: 'pickup' });
  w.events.push({ type: 'toast', text: `${def.name} fitted` });
  return true;
}

function fireWeapon(w, inp) {
  const p = w.player;
  const def = WEAPONS[p.weapon];
  if (p.reloadT > 0 || p.fireT > 0) return;
  if (p.ammo[p.weapon] <= 0) {
    p.reloadT = 1.1;
    return;
  }
  p.fireT = def.rate;
  p.ammo[p.weapon] -= 1;
  const origin = playerPos(w);
  const aim = p.aimAngle;
  for (let i = 0; i < def.pellets; i++) {
    const spread = (w.rng.next() - 0.5) * 2 * def.spread;
    const a = aim + spread;
    const speed = 900;
    w.bullets.push({
      x: origin.x + Math.cos(a) * 18, y: origin.y + Math.sin(a) * 18,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      life: def.range / speed, damage: def.damage, from: 'player',
    });
  }
  addParticles(w, origin.x + Math.cos(aim) * 22, origin.y + Math.sin(aim) * 22, 3, '#fbbf24', 90, 0.18, 2);
  w.events.push({ type: 'shot', weapon: p.weapon });
}

function updateBullets(w, dt) {
  for (const b of w.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < 0 || b.y < 0 || b.x > WORLD.w || b.y > WORLD.h) b.life = 0;
    if (b.life <= 0) continue;
    // Hit a building?
    let blocked = false;
    for (const bd of w.city.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { blocked = true; break; }
    }
    if (blocked) {
      b.life = 0;
      addParticles(w, b.x, b.y, 4, '#a8a29e', 70, 0.25, 2);
      continue;
    }
    if (b.from === 'player') {
      for (const e of w.enemies) {
        if (e.hp > 0 && dist(b.x, b.y, e.x, e.y) < 16) {
          e.hp -= b.damage;
          e.flash = 0.12;
          b.life = 0;
          w.events.push({ type: 'hit' });
          addParticles(w, e.x, e.y, 4, '#fca5a5', 90, 0.3, 2);
          if (e.hp <= 0) {
            addParticles(w, e.x, e.y, 14, '#ef4444', 160, 0.7, 3);
            if (e.mission) w.mission.kills = (w.mission.kills || 0) + 1;
            addHeat(w, WANTED.killCrewHeat);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const c of w.cops) {
        if (c.hp > 0 && dist(b.x, b.y, c.x, c.y) < 16) {
          c.hp -= b.damage;
          c.flash = 0.12;
          b.life = 0;
          w.events.push({ type: 'hit' });
          if (c.hp <= 0) {
            // Only killing a cop is a crime — a stray bullet that merely
            // wounds one must not spike the wanted level.
            addHeat(w, WANTED.killCopHeat);
            addParticles(w, c.x, c.y, 14, '#1e3a8a', 160, 0.7, 3);
            c.hp = 0;
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of w.cars) {
        if (car.driver === 'player' || car.dead) continue;
        if (dist(b.x, b.y, car.x, car.y) < 22) {
          car.hp -= b.damage;
          car.flash = 0.12;
          b.life = 0;
          if (car.hp <= 0) explodeCar(w, car);
          break;
        }
      }
    } else {
      // Enemy / cop bullet vs the player.
      const pp = playerPos(w);
      if (dist(b.x, b.y, pp.x, pp.y) < 15) {
        damagePlayer(w, b.damage, b.from);
        b.life = 0;
      }
      if (b.life <= 0) continue;
      const car = playerCar(w);
      if (car && dist(b.x, b.y, car.x, car.y) < 24) {
        car.hp -= b.damage;
        car.flash = 0.12;
        b.life = 0;
        if (car.hp <= 0) explodeCar(w, car);
      }
    }
  }
  w.bullets = w.bullets.filter((b) => b.life > 0);
}

function explodeCar(w, car) {
  if (car.dead) return;
  car.dead = true;
  car.hp = 0;
  addParticles(w, car.x, car.y, 26, '#f97316', 260, 0.9, 4);
  addParticles(w, car.x, car.y, 18, '#78350f', 140, 1.2, 5);
  w.events.push({ type: 'crash' });
  if (car.id === w.player.carId) {
    // The player's ride blew up: bail out on foot, hurt.
    w.player.carId = null;
    w.player.onFoot = true;
    w.player.x = car.x + 30;
    w.player.y = car.y;
    damagePlayer(w, 25, 'explosion');
  }
  if (w.race) {
    const rb = w.roadblocks.find((r) => r.carId === car.id);
    if (rb) w.roadblocks = w.roadblocks.filter((r) => r.carId !== car.id);
  }
}

function updatePlayer(w, inp, dt) {
  const p = w.player;
  p.fireT = Math.max(0, p.fireT - dt);
  p.punchT = Math.max(0, p.punchT - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.nitroCd = Math.max(0, p.nitroCd - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) p.ammo[p.weapon] = WEAPONS[p.weapon].mag;
  }

  // Aim follows the mouse (browser) or the sim's aim override.
  if (inp.mouseWorldX !== undefined && (inp.mouseWorldX !== 0 || inp.mouseWorldY !== 0)) {
    const pp = playerPos(w);
    p.aimAngle = angleTo(pp.x, pp.y, inp.mouseWorldX, inp.mouseWorldY);
  }

  // Weapon wheel: hold Q to open, 1/2/3 to pick (rank-gated).
  if (inp.qHold) w.ui.wheelOpen = true;
  else if (w.ui.wheelOpen) {
    w.ui.wheelOpen = false;
    if (inp.wheel) selectWeapon(w, inp.wheel);
  }
  if (inp.qTap && !inp.qHold) {
    p.drawn = !p.drawn;
  }
  if (inp.wheelPick && inp.wheel && !w.ui.wheelOpen) selectWeapon(w, inp.wheel);

  // Radio: C cycles while driving.
  if (inp.c) {
    p.radio = (p.radio + 1) % 3;
    w.events.push({ type: 'toast', text: `Radio: ${['SOL FM', 'GARAGE ROCK', 'DOCKS BASS'][p.radio]}` });
  }

  // Garage shop: G near the garage opens it; buy with inp.buy.
  const nearGarage = dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 130
    || (playerCar(w) && dist(playerCar(w).x, playerCar(w).y, PLACES.garage.x, PLACES.garage.y) < 130);
  if (inp.g && nearGarage) {
    w.ui.shopOpen = !w.ui.shopOpen;
  }
  if (inp.buy) buyUpgrade(w, inp.buy);

  // Reload.
  if (inp.r && p.ammo[p.weapon] < WEAPONS[p.weapon].mag && p.reloadT <= 0) p.reloadT = 1.1;

  // Punch.
  if (inp.f && p.punchT <= 0 && p.onFoot) {
    p.punchT = 0.45;
    const pp = playerPos(w);
    const range = 46;
    const tx = pp.x + Math.cos(p.aimAngle) * range;
    const ty = pp.y + Math.sin(p.aimAngle) * range;
    for (const e of w.enemies) {
      if (e.hp > 0 && dist(tx, ty, e.x, e.y) < 30) {
        e.hp -= 26;
        e.flash = 0.12;
        if (e.hp <= 0 && e.mission) w.mission.kills = (w.mission.kills || 0) + 1;
      }
    }
    for (const c of w.cops) {
      if (c.hp > 0 && dist(tx, ty, c.x, c.y) < 30) {
        c.hp -= 26;
        c.flash = 0.12;
        if (c.hp <= 0) {
          addHeat(w, WANTED.killCopHeat);
        }
      }
    }
  }

  // Fire.
  if (inp.mouseDown && p.drawn && p.onFoot) fireWeapon(w, inp);

  // Enter / exit a car. Edge-triggered: holding E must not toggle enter
  // and exit every tick (that also stacked steal heat per tick).
  if (inp.e && !p.ePrev) {
    if (p.onFoot) {
      let best = null;
      let bestD = 52;
      for (const car of w.cars) {
        if (car.dead) continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < bestD) { best = car; bestD = d; }
      }
      if (best) {
        if (best.driver === 'traffic' || best.driver === 'parked' || best.driver === 'mission') {
          if (best.driver !== 'mission') addHeat(w, WANTED.stealHeat);
          else if (w.mission.missionCarId === best.id) addHeat(w, 0);
          else addHeat(w, WANTED.stealHeat);
        }
        if (best.driver === 'police') addHeat(w, WANTED.stealHeat);
        best.driver = 'player';
        p.carId = best.id;
        p.onFoot = false;
        p.drawn = false;
        w.events.push({ type: 'pickup' });
      }
    } else {
      const car = playerCar(w);
      if (car) {
        car.driver = 'parked';
        car.speed = 0;
        p.carId = null;
        p.onFoot = true;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
        p.angle = car.angle;
      }
    }
  }
  p.ePrev = inp.e;

  // Movement.
  p.moving = false;
  if (p.onFoot) {
    const speed = inp.run ? 240 : 150;
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      p.moving = true;
      p.angle = Math.atan2(dy, dx);
      const pos = collideCircle(w.city, p.x, p.y, 14, p.x + dx * speed * dt, p.y + dy * speed * dt);
      p.x = pos.x;
      p.y = pos.y;
    }
  } else {
    const car = playerCar(w);
    if (car) {
      const def = VEHICLES[car.type];
      const top = def.top * (1 + 0.08 * p.upgrades.engine) + (p.nitroT > 0 ? 130 : 0);
      let accel = 0;
      if (inp.up) accel = def.accel;
      if (inp.down) accel = -def.accel * 0.7;
      if (inp.brake) accel = -Math.sign(car.speed) * 420;
      car.speed = clamp(car.speed + accel * dt, -90, top);
      if (!inp.up && !inp.down) car.speed -= car.speed * 0.9 * dt;
      if (Math.abs(car.speed) < 4 && !inp.up && !inp.down) car.speed = 0;
      const steer = ((inp.left ? 1 : 0) - (inp.right ? 1 : 0)) * def.grip * (car.speed >= 0 ? 1 : -1);
      car.angle += steer * Math.min(1, Math.abs(car.speed) / 120) * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      const pos = collideCircle(w.city, car.x, car.y, 16, nx, ny);
      const hitWall = Math.abs(pos.x - nx) > 0.5 || Math.abs(pos.y - ny) > 0.5;
      car.crashCd = Math.max(0, (car.crashCd || 0) - dt);
      if (hitWall && Math.abs(car.speed) > 140 && car.crashCd <= 0) {
        car.hp -= 6;
        car.crashCd = 0.6;
        w.events.push({ type: 'crash' });
        addParticles(w, car.x, car.y, 6, '#fbbf24', 120, 0.4, 2);
        if (car.hp <= 0) explodeCar(w, car);
      }
      car.x = pos.x;
      car.y = pos.y;
      p.moving = Math.abs(car.speed) > 10;
      if (inp.brake && Math.abs(car.speed) > 60) {
        addParticles(w, car.x, car.y, 1, '#1c1917', 20, 0.8, 3);
      }
      // Nitro: hold X while driving, 2s burn, 8s cooldown.
      if (inp.nitro && p.upgrades.nitro > 0 && p.nitroCd <= 0 && p.nitroT <= 0 && Math.abs(car.speed) > 40) {
        p.nitroT = 2;
        p.nitroCd = 8;
        w.events.push({ type: 'toast', text: 'NITRO!' });
      }
      if (p.nitroT > 0) {
        p.nitroT -= dt;
        addParticles(w, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 2, '#38bdf8', 160, 0.3, 3);
      }
      // Run over a pedestrian at speed: it hurts, and the PD notices.
      for (const ped of w.peds) {
        if (ped.down > 0) continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 22 && Math.abs(car.speed) > 60) {
          ped.down = 1;
          ped.downT = 4;
          addHeat(w, WANTED.hitPedHeat);
          addParticles(w, ped.x, ped.y, 8, '#fca5a5', 120, 0.5, 2);
        }
      }
      // Ram traffic cars (one hit per cooldown, not per tick of contact).
      for (const other of w.cars) {
        if (other === car || other.dead) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 30 && d > 0.01) {
          const push = (30 - d) / 2;
          const a = angleTo(other.x, other.y, car.x, car.y);
          car.x += Math.cos(a) * push;
          car.y += Math.sin(a) * push;
          other.x -= Math.cos(a) * push;
          other.y -= Math.sin(a) * push;
          if (Math.abs(car.speed) > 120 && car.crashCd <= 0) {
            car.crashCd = 0.6;
            other.hp -= 8;
            car.hp -= 4;
            if (other.hp <= 0) explodeCar(w, other);
            if (car.hp <= 0) explodeCar(w, car);
          }
        }
      }
    }
  }

  // Health regen out of combat.
  if (w.time - p.lastDamageAt > 5 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 3 * dt);
  }
}

function selectWeapon(w, name) {
  const def = WEAPONS[name];
  if (!def) return;
  if (w.player.jobsDone < def.unlockJobs) {
    w.events.push({ type: 'toast', text: `${def.name} unlocks at ${def.unlockJobs === 3 ? 'Runner' : 'Wheelman'} rank` });
    return;
  }
  w.player.weapon = name;
  w.player.drawn = true;
  w.events.push({ type: 'toast', text: def.name });
}

function updateTraffic(w, dt) {
  const pp = playerPos(w);
  for (const car of w.cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    if (!car.target) {
      const inter = nearestIntersection(car.x, car.y);
      const options = [];
      for (const ax of [inter.x - 320, inter.x, inter.x + 320]) {
        if (ax >= 160 && ax <= 2400) options.push({ x: ax, y: inter.y });
      }
      for (const sy of [inter.y - 320, inter.y, inter.y + 320]) {
        if (sy >= 160 && sy <= 1760) options.push({ x: inter.x, y: sy });
      }
      car.target = w.rng.pick(options);
    }
    const t = car.target;
    const d = dist(car.x, car.y, t.x, t.y);
    if (d < 24) {
      car.target = null;
      continue;
    }
    const want = angleTo(car.x, car.y, t.x, t.y);
    car.angle += clamp(angleDiff(car.angle, want), -2.2 * dt, 2.2 * dt);
    // Slow for the car ahead.
    let slow = false;
    for (const other of w.cars) {
      if (other === car || other.dead) continue;
      const od = dist(car.x, car.y, other.x, other.y);
      if (od < 58 && Math.abs(angleDiff(car.angle, angleTo(car.x, car.y, other.x, other.y))) < 0.5) { slow = true; break; }
    }
    const targetSpeed = slow ? 0 : 135;
    car.speed += clamp(targetSpeed - car.speed, -260 * dt, 170 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const pos = collideCircle(w.city, car.x, car.y, 15, nx, ny);
    car.x = pos.x;
    car.y = pos.y;
    // Respawn near the player when it drifts too far away.
    if (dist(car.x, car.y, pp.x, pp.y) > 1000) {
      const rp = nearestRoadPoint(pp.x + w.rng.range(-500, 500), pp.y + w.rng.range(-500, 500));
      car.x = rp.x;
      car.y = rp.y;
      car.target = null;
      car.speed = 0;
    }
  }
}

function updatePeds(w, dt) {
  const pp = playerPos(w);
  for (const ped of w.peds) {
    if (ped.down > 0) {
      ped.downT -= dt;
      if (ped.downT <= 0) ped.down = 0;
      continue;
    }
    // Flee gunfire and fast cars. A ped flees sideways out of the car's
    // path (perpendicular to its heading), not straight away from it —
    // running along the car's line just gets run over.
    let fleeing = false;
    if (w.bullets.length && dist(ped.x, ped.y, pp.x, pp.y) < 220) fleeing = true;
    const car = playerCar(w);
    if (car && Math.abs(car.speed) > 20 && dist(ped.x, ped.y, car.x, car.y) < 300) fleeing = true;
    if (fleeing && ped.flee <= 0) {
      // Flee direction is sticky: pick it once when fleeing starts, so a
      // turning car does not make the ped zigzag back into its path.
      ped.flee = 1.2;
      if (car && Math.abs(car.speed) > 20) {
        // Side of the car's path the ped is on (cross product sign).
        const side = Math.sign(
          Math.cos(car.angle) * (ped.y - car.y) - Math.sin(car.angle) * (ped.x - car.x),
        ) || 1;
        ped.angle = car.angle + (side * Math.PI) / 2;
      } else {
        ped.angle = angleTo(pp.x, pp.y, ped.x, ped.y);
      }
    } else if (fleeing) {
      ped.flee = 1.2;
    } else if (ped.flee > 0) {
      ped.flee -= dt;
    }
    const speed = ped.flee > 0 ? 150 : ped.speed;
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 20) {
      ped.target = nearestIntersection(ped.x + w.rng.range(-320, 320), ped.y + w.rng.range(-320, 320));
    }
    if (ped.flee <= 0) {
      ped.angle += clamp(angleDiff(ped.angle, angleTo(ped.x, ped.y, ped.target.x, ped.target.y)), -2.5 * dt, 2.5 * dt);
    }
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const pos = collideCircle(w.city, ped.x, ped.y, 10, nx, ny);
    ped.x = pos.x;
    ped.y = pos.y;
  }
}

function updateCops(w, dt) {
  const s = starsOf(w);
  const pp = playerPos(w);
  // Spawn pressure scales with stars — except during a shootout mission
  // step, where the crew is the fight and PD reinforcements would turn
  // it into an unwinnable two-front war. (Cops already on scene stay.)
  const step = w.mission && !w.mission.done ? (MISSIONS[w.mission.index]?.steps[w.mission.step] || null) : null;
  const shootout = step && (step.type === 'kill' || step.type === 'finale');
  const wantCops = shootout ? 0 : s === 0 ? 0 : s === 1 ? 2 : s === 2 ? 3 : s + 2;
  const liveCops = w.cops.filter((c) => c.hp > 0).length;
  if (liveCops < wantCops && w.rng.chance(dt * 1.2)) spawnCop(w);
  const wantCars = shootout ? 0 : s >= 2 ? Math.min(3, s - 1) : 0;
  const liveCars = w.cars.filter((c) => c.driver === 'police' && !c.dead && !w.roadblocks.some((r) => r.carId === c.id)).length;
  if (liveCars < wantCars && w.rng.chance(dt * 0.8)) spawnPoliceCar(w);

  for (const cop of w.cops) {
    if (cop.hp <= 0) continue;
    const d = dist(cop.x, cop.y, pp.x, pp.y);
    if (s === 0) {
      // Heat gone: cops walk off.
      cop.state = 'walk';
      cop.angle += dt * 0.5;
      const nx = cop.x + Math.cos(cop.angle) * 40 * dt;
      const ny = cop.y + Math.sin(cop.angle) * 40 * dt;
      const pos = collideCircle(w.city, cop.x, cop.y, 12, nx, ny);
      cop.x = pos.x;
      cop.y = pos.y;
      continue;
    }
    cop.state = 'chase';
    if (w.player.onFoot && d < 30) {
      // The cop grabs the player and holds on: no overshoot, no orbit.
      // A driver inside a car cannot be busted by a foot cop.
      cop.bustT += dt;
      if (cop.bustT > 1.4) {
        bustPlayer(w);
        return;
      }
    } else {
      cop.bustT = Math.max(0, cop.bustT - dt * 2);
      cop.angle += clamp(angleDiff(cop.angle, angleTo(cop.x, cop.y, pp.x, pp.y)), -3.5 * dt, 3.5 * dt);
      const speed = 165;
      const nx = cop.x + Math.cos(cop.angle) * speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * speed * dt;
      const pos = collideCircle(w.city, cop.x, cop.y, 12, nx, ny);
      cop.x = pos.x;
      cop.y = pos.y;
    }
    // Cops shoot at 3+ stars.
    if (s >= 3) {
      cop.fireT -= dt;
      if (cop.fireT <= 0 && d < 380) {
        cop.fireT = w.rng.range(1.1, 1.9);
        const a = angleTo(cop.x, cop.y, pp.x, pp.y) + (w.rng.next() - 0.5) * 0.22;
        w.bullets.push({
          x: cop.x, y: cop.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          life: 0.7, damage: 7, from: 'cop',
        });
        w.events.push({ type: 'enemyShot' });
      }
    }
  }
  w.cops = w.cops.filter((c) => c.hp > 0 || dist(c.x, c.y, pp.x, pp.y) < 700);

  // Police cars ram the player.
  for (const car of w.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    if (w.roadblocks.some((r) => r.carId === car.id)) continue; // roadblocks stay put
    if (s === 0) {
      car.driver = 'parked';
      car.speed = 0;
      continue;
    }
    const d = dist(car.x, car.y, pp.x, pp.y);
    const want = angleTo(car.x, car.y, pp.x, pp.y);
    car.angle += clamp(angleDiff(car.angle, want), -3.0 * dt, 3.0 * dt);
    car.speed = clamp(car.speed + 200 * dt, 0, 300);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const pos = collideCircle(w.city, car.x, car.y, 15, nx, ny);
    car.x = pos.x;
    car.y = pos.y;
    car.crashCd = Math.max(0, (car.crashCd || 0) - dt);
    if (d < 34) {
      const pcar = playerCar(w);
      if (pcar) {
        if (car.crashCd <= 0) {
          car.crashCd = 0.6;
          pcar.hp -= 5;
          if (pcar.hp <= 0) explodeCar(w, pcar);
        }
      } else if (car.crashCd <= 0) {
        car.crashCd = 0.6;
        damagePlayer(w, 6, 'ram');
      }
      car.speed *= 0.4;
    }
  }

  // Roadblocks at 3+ stars; helicopter at 4-5 stars.
  if (s >= 3 && w.roadblocks.length === 0) spawnRoadblocks(w);
  if (s < 3) w.roadblocks = w.roadblocks.filter((r) => w.cars.some((c) => c.id === r.carId && !c.dead));
  if (s >= 4 && !w.heli) {
    w.heli = { x: pp.x, y: pp.y - 200, angle: 0, searchA: 0 };
    w.events.push({ type: 'toast', text: 'Police helicopter overhead' });
  }
  if (s < 4) w.heli = null;
  if (w.heli) {
    const h = w.heli;
    h.x += (pp.x - h.x) * Math.min(1, dt * 0.8);
    h.y += (pp.y - h.y) * Math.min(1, dt * 0.8);
    h.searchA += dt * 0.7;
  }
}

function updateEnemies(w, dt) {
  const pp = playerPos(w);
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, e.flash - dt);
    const d = dist(e.x, e.y, pp.x, pp.y);
    if (d < 430) {
      e.angle += clamp(angleDiff(e.angle, angleTo(e.x, e.y, pp.x, pp.y)), -4 * dt, 4 * dt);
      if (d > 210) {
        const nx = e.x + Math.cos(e.angle) * e.speed * dt;
        const ny = e.y + Math.sin(e.angle) * e.speed * dt;
        const pos = collideCircle(w.city, e.x, e.y, 12, nx, ny);
        e.x = pos.x;
        e.y = pos.y;
        // Anti-softlock: if the enemy is wedged on a building and has not
        // moved in 3s, it flanks to a road point near the player instead
        // of standing behind a wall forever while the mission waits.
        // (Measured over 1s windows: the enemy walks 125px/s, so a free
        // enemy covers ~125px per window; a wedged one covers ~0.)
        e.stuckCheckT = (e.stuckCheckT || 0) + dt;
        if (e.stuckX === undefined) { e.stuckX = e.x; e.stuckY = e.y; }
        if (e.stuckCheckT >= 1) {
          const moved = dist(e.x, e.y, e.stuckX, e.stuckY);
          e.stuckT = moved < 20 ? (e.stuckT || 0) + 1 : 0;
          e.stuckX = e.x;
          e.stuckY = e.y;
          e.stuckCheckT = 0;
          if (e.stuckT >= 3) {
            let bx = e.x, by = e.y;
            for (let i = 0; i < 8; i++) {
              const cand = randomRoadPoint(w.rng);
              if (dist(cand.x, cand.y, pp.x, pp.y) < 250) { bx = cand.x; by = cand.y; break; }
            }
            e.x = bx;
            e.y = by;
            e.stuckT = 0;
            e.stuckX = bx;
            e.stuckY = by;
          }
        }
      }
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = w.rng.range(1.3, 2.1);
        const a = angleTo(e.x, e.y, pp.x, pp.y) + (w.rng.next() - 0.5) * 0.3;
        w.bullets.push({
          x: e.x, y: e.y, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600,
          life: 0.8, damage: 4, from: 'crew',
        });
        w.events.push({ type: 'enemyShot' });
      }
    }
  }
  w.enemies = w.enemies.filter((e) => e.hp > 0 || !e.mission);
}

function updateRacers(w, dt) {
  if (!w.race) return;
  const race = w.race;
  race.timeLeft -= dt;
  for (const r of w.racers) {
    if (r.finished) continue;
    const cp = race.checkpoints[r.cp];
    if (!cp) { r.finished = true; continue; }
    const d = dist(r.x, r.y, cp.x, cp.y);
    const want = angleTo(r.x, r.y, cp.x, cp.y);
    r.angle += clamp(angleDiff(r.angle, want), -2.6 * dt, 2.6 * dt);
    r.x += Math.cos(r.angle) * r.speed * dt;
    r.y += Math.sin(r.angle) * r.speed * dt;
    if (d < 70) {
      r.cp += 1;
      if (r.cp >= race.checkpoints.length) {
        r.finished = true;
        if (!race.playerFinished) {
          failMission(w, `${r.name} beat you to the finish`);
          return;
        }
      }
    }
  }
  // The player's own checkpoint progress.
  const pp = playerPos(w);
  const cp = race.checkpoints[race.playerCp];
  if (cp && dist(pp.x, pp.y, cp.x, cp.y) < 80) {
    race.playerCp += 1;
    w.events.push({ type: 'pickup' });
    if (race.playerCp >= race.checkpoints.length) {
      race.playerFinished = true;
    }
  }
  if (race.timeLeft <= 0 && !race.playerFinished) {
    failMission(w, 'Out of time — the race is lost');
  }
}

function updatePickups(w, dt) {
  const pp = playerPos(w);
  for (const pk of w.pickups) {
    pk.t += dt;
    if (dist(pp.x, pp.y, pk.x, pk.y) < 36) {
      if (pk.kind === 'health') w.player.health = Math.min(100, w.player.health + pk.amount);
      else if (pk.kind === 'ammo') {
        for (const k of Object.keys(w.player.ammo)) w.player.ammo[k] = WEAPONS[k].mag;
      } else if (pk.kind === 'money') {
        w.player.money += pk.amount;
        w.stats.earned += pk.amount;
      }
      w.events.push({ type: 'pickup' });
      pk.taken = true;
    }
  }
  w.pickups = w.pickups.filter((pk) => !pk.taken);
}

function updateParticles(w, dt) {
  for (const pt of w.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life -= dt;
  }
  w.particles = w.particles.filter((pt) => pt.life > 0);
}

export function updateWorld(w, inp, dt) {
  w.events = [];
  if (w.ui.title || w.ui.paused || w.ui.gameOver) return w.events;
  if (w.ui.card && w.ui.card.kind !== 'fail' && inp.enter) {
    w.ui.card = null;
  }
  w.time += dt;

  updatePlayer(w, inp, dt);
  if (w.ui.gameOver) return w.events;
  updateTraffic(w, dt);
  updatePeds(w, dt);
  updateCops(w, dt);
  if (w.ui.gameOver) return w.events;
  updateEnemies(w, dt);
  updateRacers(w, dt);
  if (w.mission.failed && w.ui.card && w.ui.card.kind === 'fail') {
    // Failed already; wait for the player to acknowledge (handled in main).
  }
  updateBullets(w, dt);
  updatePickups(w, dt);
  updateParticles(w, dt);

  // Wanted heat decays after a quiet stretch — unless the helicopter is
  // overhead, which pins it.
  const s = starsOf(w);
  if (s > 0 && !w.heli && w.time - w.player.lastCrimeAt > WANTED.quietTime) {
    w.player.heat = Math.max(0, w.player.heat - WANTED.decayPerSec * dt);
  }

  // The story engine walks the current mission's steps.
  updateMissions(w, dt);

  // Toasts fade.
  if (w.ui.toastT > 0) {
    w.ui.toastT -= dt;
    if (w.ui.toastT <= 0) w.ui.toast = '';
  }
  for (const e of w.events) {
    if (e.type === 'toast') {
      w.ui.toast = e.text;
      w.ui.toastT = 3;
    }
  }
  // Cars that blew up get towed away.
  w.cars = w.cars.filter((c) => !c.dead || c.driver === 'player');
  return w.events;
}

// --- save / load ---------------------------------------------------------

export function saveWorld(w) {
  const p = w.player;
  const data = {
    v: 3, money: p.money, jobsDone: p.jobsDone,
    mission: w.mission.index, step: w.mission.step,
    standing: p.standing, upgrades: p.upgrades, weapon: p.weapon,
    x: p.x, y: p.y, health: p.health, radio: p.radio,
    earned: w.stats.earned,
  };
  const json = JSON.stringify(data);
  if (w.storage) {
    try { w.storage.setItem(SAVE_KEY, json); } catch (e) { /* private mode */ }
  }
  return json;
}

export function loadWorld(w, json) {
  let data = null;
  try { data = JSON.parse(json); } catch (e) { return false; }
  if (!data || data.v !== 3) return false;
  const p = w.player;
  p.money = data.money;
  p.jobsDone = data.jobsDone;
  p.standing = data.standing;
  p.upgrades = data.upgrades;
  p.weapon = data.weapon || 'pistol';
  p.x = data.x;
  p.y = data.y;
  p.health = data.health;
  p.radio = data.radio || 0;
  w.stats.earned = data.earned || 0;
  w.mission.index = data.mission;
  w.mission.step = data.step;
  w.mission.stepState = {};
  w.mission.started = false;
  w.mission.failed = false;
  w.ui.title = false;
  return true;
}

export function hasSave(storage) {
  if (!storage) return false;
  try { return !!storage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export { spawnEnemies, spawnMissionCar, spawnRacers };
