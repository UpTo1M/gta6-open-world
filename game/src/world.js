// SOLMARA — the simulation. No drawing, no browser: the player on foot and in
// cars, traffic and pedestrians, the police and the wanted level, combat,
// particles and pickups. step() advances one fixed step and returns what
// happened as bit flags, so the caller can play sounds and announce it.
import { CAR, CAR_TYPES, EVENT_BUSTED, EVENT_EXPLODE, EVENT_HIT, EVENT_KILL, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL, EVENT_STEP, EVENT_WANTED, EVENT_WASTED, PEDS, PLAYER, PLACES, POLICE, ROADS, TRAFFIC, WANTED, WORLD } from './config.js';
import { isBlocked, isOnRoad, lineOfSight, nearestRoadPoint, randomRoadPoint, randomSidewalkPoint, resolveCircle } from './city.js';
import { pick, range } from './random.js';
import { createMissions } from './missions.js';

export { EVENT_BUSTED, EVENT_EXPLODE, EVENT_HIT, EVENT_KILL, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL, EVENT_STEP, EVENT_WANTED, EVENT_WASTED } from './config.js';

const TAU = Math.PI * 2;

function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

let nextCarId = 1;
let nextPedId = 1;

export function createWorld(random, city) {
  const missions = createMissions(random);
  const state = {
    time: 0,
    money: 120,
    wanted: 0,
    quietTime: 0,
    decayTimer: 0,
    player: null,
    cars: [],
    peds: [],
    enemies: [],
    cops: [],
    particles: [],
    pickups: [],
    skid: [],
    camera: { x: 0, y: 0, shake: 0, zoom: 1 },
    mission: missions.state,
    stats: { stolen: 0, kills: 0, busted: 0, wasted: 0 },
    over: null, // 'busted' | 'wasted' | 'done'
    banner: null,
    bannerTime: 0,
    dialogue: null,
    dialogueTime: 0,
  };

  function makeCar(type, x, y, angle, driver) {
    const t = CAR_TYPES[type] || CAR_TYPES.sedan;
    const car = {
      id: nextCarId += 1,
      type, x, y, angle,
      vf: 0, vr: 0, // velocity in the car's own frame
      color: t.color,
      maxSpeed: t.maxSpeed,
      accel: t.accel,
      health: CAR.health,
      driver, // 'player' | 'traffic' | 'police' | 'parked' | null
      kind: type,
      dir: 0, // traffic: 0 E, 1 S, 2 W, 3 N
      targetSpeed: TRAFFIC.speed + range(random, -TRAFFIC.speedJitter, TRAFFIC.speedJitter),
      lane: 0,
      lastTurn: '',
      brake: false,
      siren: false,
      smoke: 0,
      dead: false,
      explodeTimer: 0,
      hurtTimer: 0, // seconds until this car can take crash damage again
    };
    return car;
  }

  function makePed(x, y, kind) {
    return {
      id: nextPedId += 1,
      x, y, angle: range(random, 0, TAU),
      speed: 0,
      kind: kind || 'walker', // walker | cop | enemy
      color: kind === 'cop' ? '#2f6fd0' : pick(random, ['#e07b39', '#2fa8e0', '#58c96b', '#c96bd8', '#e8e4da', '#7a8a99']),
      health: kind === 'enemy' ? 70 : 40,
      state: 'walk',
      fleeX: 0, fleeY: 0, fleeTime: 0,
      dir: Math.floor(random() * 4),
      road: null,
      fireTimer: range(random, 0.5, 1.5),
      bustTimer: 0,
      dead: false,
      fade: 0,
    };
  }

  function spawnTrafficCar(nearX, nearY) {
    const p = randomRoadPoint(random);
    let x = p.x;
    let y = p.y;
    if (nearX !== undefined) {
      // Prefer a road near the player so traffic is always around.
      const q = nearestRoadPoint(nearX + range(random, -500, 500), nearY + range(random, -500, 500));
      x = q.x; y = q.y; p.vertical = q.vertical;
    }
    const dir = p.vertical ? (random() < 0.5 ? 1 : 3) : (random() < 0.5 ? 0 : 2);
    const type = pick(random, ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sport']);
    const car = makeCar(type, x, y, (dir * Math.PI) / 2, 'traffic');
    car.dir = dir;
    // Right-hand traffic: offset to the right of the direction of travel.
    if (p.vertical) car.x += dir === 1 ? 20 : -20;
    else car.y += dir === 0 ? 20 : -20;
    car.vf = car.targetSpeed;
    return car;
  }

  function spawnPed(nearX, nearY) {
    const p = randomSidewalkPoint(random);
    if (nearX !== undefined) {
      p.x = clamp(nearX + range(random, -420, 420), 40, WORLD.width - 60);
      p.y = clamp(nearY + range(random, -320, 320), 40, WORLD.height - 40);
    }
    const ped = makePed(p.x, p.y, 'walker');
    ped.road = p;
    return ped;
  }

  function spawnPoliceCar() {
    const p = state.player;
    const q = nearestRoadPoint(p.x + range(random, -380, 380), p.y + range(random, -380, 380));
    const dir = q.vertical ? (random() < 0.5 ? 1 : 3) : (random() < 0.5 ? 0 : 2);
    const car = makeCar('police', q.x, q.y, (dir * Math.PI) / 2, 'police');
    car.dir = dir;
    car.siren = true;
    car.targetSpeed = 300;
    if (q.vertical) car.x += dir === 1 ? 20 : -20;
    else car.y += dir === 0 ? 20 : -20;
    car.vf = 240;
    state.cars.push(car);
    return car;
  }

  function spawnCop() {
    const p = state.player;
    const a = range(random, 0, TAU);
    const cop = makePed(p.x + Math.cos(a) * 220, p.y + Math.sin(a) * 220, 'cop');
    cop.state = 'chase';
    state.cops.push(cop);
    return cop;
  }

  function spawnEnemy(x, y) {
    const e = makePed(x + range(random, -40, 40), y + range(random, -40, 40), 'enemy');
    e.state = 'fight';
    state.enemies.push(e);
    return e;
  }

  function addWanted(n, why) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.quietTime = 0;
    state.decayTimer = 0;
    if (state.wanted > before) return EVENT_WANTED;
    return 0;
  }

  function burst(x, y, color, n, speed, life, size) {
    for (let i = 0; i < n; i += 1) {
      const a = range(random, 0, TAU);
      const s = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: range(random, life * 0.5, life),
        maxLife: life,
        color, size: range(random, size * 0.6, size * 1.4),
      });
    }
  }

  function explode(x, y, big) {
    burst(x, y, '#f2a541', big ? 26 : 14, 260, 0.7, 7);
    burst(x, y, '#e0526b', big ? 16 : 8, 180, 0.5, 6);
    burst(x, y, '#5a6270', big ? 18 : 10, 90, 1.4, 9);
    state.camera.shake = Math.max(state.camera.shake, big ? 14 : 8);
  }

  function dropPickup(x, y, kind, amount) {
    state.pickups.push({ x, y, kind, amount, bob: range(random, 0, TAU) });
  }

  function reset() {
    nextCarId = 1;
    nextPedId = 1;
    state.time = 0;
    state.money = 120;
    state.wanted = 0;
    state.quietTime = 0;
    state.decayTimer = 0;
    state.cars = [];
    state.peds = [];
    state.enemies = [];
    state.cops = [];
    state.particles = [];
    state.pickups = [];
    state.skid = [];
    state.over = null;
    state.banner = null;
    state.bannerTime = 0;
    state.dialogue = null;
    state.dialogueTime = 0;
    state.stats = { stolen: 0, kills: 0, busted: 0, wasted: 0 };
    state.player = {
      x: PLACES.garage.x - 60, y: PLACES.garage.y + 30,
      angle: -Math.PI / 2, health: PLAYER.health, money: state.money,
      car: null, armed: false, ammo: PLAYER.pistolMag, mag: PLAYER.pistolMag,
      reloadTimer: 0, fireTimer: 0, punchTimer: 0, hurtTimer: 0, speed: 0,
      run: false, moving: false,
    };
    // Parked cars around the garage and the city, tucked at the kerb or in
    // alleys — never on an avenue's centre line, so a fast driver can pass.
    // Each one faces along the avenue it sits on, so a new driver pulls away
    // on the road instead of into a building.
    const parkedSpots = [
      { x: PLACES.garage.x + 30, y: PLACES.garage.y - 60, type: 'sedan', angle: -Math.PI / 2 },
      { x: PLACES.garage.x - 120, y: PLACES.garage.y + 90, type: 'van', angle: -Math.PI / 2 },
      { x: 845, y: 550, type: 'sedan', angle: Math.PI / 2 },
      { x: 1485, y: 1120 - 70, type: 'taxi', angle: -Math.PI / 2 },
      { x: 1805, y: 1440 + 70, type: 'sedan', angle: Math.PI / 2 },
      { x: 435, y: 800 - 70, type: 'truck', angle: -Math.PI / 2 },
    ];
    for (const s of parkedSpots) {
      const car = makeCar(s.type, s.x, s.y, s.angle, 'parked');
      car.color = pick(random, ['#c94f42', '#2fa8e0', '#58c96b', '#c96bd8', '#e8e4da']);
      state.cars.push(car);
    }
    // The mission's special car waits at the Marina for mission 2.
    const comet = makeCar('sport', PLACES.marina.x - 40, PLACES.marina.y + 70, Math.PI / 2, 'parked');
    comet.color = '#2fa8e0';
    comet.missionCar = true;
    state.cars.push(comet);
    for (let i = 0; i < TRAFFIC.count; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < PEDS.count; i += 1) state.peds.push(spawnPed());
    dropPickup(PLACES.hospital.x + 40, PLACES.hospital.y + 40, 'health', 50);
    dropPickup(PLACES.garage.x + 80, PLACES.garage.y + 60, 'ammo', 24);
    missions.reset();
    state.mission = missions.state;
  }

  // --- Player on foot -------------------------------------------------------
  function stepPlayerOnFoot(dt, ctl) {
    const p = state.player;
    let mx = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
    let my = (ctl.down ? 1 : 0) - (ctl.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    p.moving = len > 0;
    if (len > 0) {
      mx /= len; my /= len;
      const speed = ctl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      p.speed = speed;
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      if (!isBlocked(city, nx, p.y, PLAYER.radius)) p.x = nx;
      if (!isBlocked(city, p.x, ny, PLAYER.radius)) p.y = ny;
      resolveCircle(city, p, PLAYER.radius);
      if (!p.armed) p.angle = Math.atan2(my, mx);
    } else {
      p.speed = 0;
    }
    if (p.armed && ctl.aimX !== undefined) p.angle = Math.atan2(ctl.aimY - p.y, ctl.aimX - p.x);
    if (p.reloadTimer > 0) p.reloadTimer -= dt;
    if (p.fireTimer > 0) p.fireTimer -= dt;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    // Health slowly recovers out of combat.
    if (p.hurtTimer <= 0 && p.health > 0 && p.health < PLAYER.health) p.health = Math.min(PLAYER.health, p.health + 2 * dt);
  }

  // --- Driving --------------------------------------------------------------
  function driveCar(car, throttle, steer, handbrake, dt) {
    const type = CAR_TYPES[car.type] || CAR_TYPES.sedan;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const rx = -fy;
    const ry = fx;
    // Velocity in the car's frame.
    let vf = car.vf;
    let vr = car.vr;
    if (throttle > 0) vf += type.accel * throttle * dt;
    else if (throttle < 0) {
      if (vf > 12) vf -= CAR.brake * dt; // braking
      else vf -= CAR.reverseAccel * dt; // reversing
    }
    vf = clamp(vf, -CAR.maxReverse, type.maxSpeed);
    // Drag and rolling resistance.
    vf -= vf * 0.35 * dt;
    if (throttle === 0) vf -= vf * 0.9 * dt;
    // Lateral grip: the car slides sideways less when gripping.
    const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
    vr *= Math.exp(-grip * dt);
    // Steering scales with forward speed, but never vanishes: a slow car
    // can still turn out of a corner.
    const steerAuthority = clamp(Math.abs(vf) / 140, 0.3, 1);
    car.angle += steer * CAR.steer * steerAuthority * (vf >= 0 ? 1 : -1) * dt;
    // Recompute the frame after the turn.
    const nfx = Math.cos(car.angle);
    const nfy = Math.sin(car.angle);
    const nrx = -nfy;
    const nry = nfx;
    const vx = nfx * vf + nrx * vr;
    const vy = nfy * vf + nry * vr;
    car.vf = vf;
    car.vr = vr;
    car.x += vx * dt;
    car.y += vy * dt;
    car.brake = throttle < 0 && vf > 12;
    return { vx, vy };
  }

  function collideCarBuildings(car) {
    // Two circles: front and rear of the car.
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const s of [14, -14]) {
      const p = { x: car.x + fx * s, y: car.y + fy * s };
      if (isBlocked(city, p.x, p.y, 13)) {
        resolveCircle(city, p, 13);
        car.x = p.x - fx * s;
        car.y = p.y - fy * s;
        if (Math.abs(car.vf) > 90) {
          // One hard hit, then a short grace period so a scrape is not a pile-up.
          if (car.hurtTimer <= 0) {
            car.health -= Math.abs(car.vf) * 0.03;
            car.hurtTimer = 0.5;
          }
          burst(car.x + fx * s, car.y + fy * s, '#e8d44d', 6, 120, 0.4, 4);
          car.vf *= -0.25;
          state.camera.shake = Math.max(state.camera.shake, 4);
        } else {
          car.vf *= 0.4;
        }
      }
    }
  }

  function stepPlayerDriving(dt, ctl) {
    const p = state.player;
    const car = p.car;
    const throttle = (ctl.up ? 1 : 0) - (ctl.down ? 1 : 0);
    const steer = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
    driveCar(car, throttle, steer, ctl.handbrake, dt);
    collideCarBuildings(car);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Skid marks when turning hard or handbraking at speed.
    if ((ctl.handbrake || Math.abs(steer) > 0.7) && Math.abs(car.vf) > 180) {
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);
      for (const s of [-12, 12]) {
        const px = car.x - fx * 14 + -fy * s;
        const py = car.y - fy * 14 + fx * s;
        state.skid.push({ x: px, y: py, life: 2.2, maxLife: 2.2 });
      }
      if (state.skid.length > 220) state.skid.splice(0, state.skid.length - 220);
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      car.explodeTimer = 1.6;
    }
  }

  // --- Traffic --------------------------------------------------------------
  function stepTrafficCar(car, dt) {
    const speed = car.targetSpeed;
    const laneOff = 20; // right-hand traffic: drive on the right side of the road
    // Move forward.
    const sp = Math.min(speed, car.vf + 60 * dt);
    car.vf = sp;
    const dx = [1, 0, -1, 0][car.dir];
    const dy = [0, 1, 0, -1][car.dir];
    car.x += dx * sp * dt;
    car.y += dy * sp * dt;
    // Slow for the car ahead in the same lane.
    for (const other of state.cars) {
      if (other === car || other.driver !== 'traffic') continue;
      if (other.dir !== car.dir) continue;
      const ahead = (other.x - car.x) * dx + (other.y - car.y) * dy;
      const side = Math.abs((other.x - car.x) * dy - (other.y - car.y) * dx);
      if (ahead > 0 && ahead < 70 && side < 30) {
        car.vf = Math.min(car.vf, Math.max(0, other.vf - 20));
        break;
      }
    }
    // At an intersection, maybe turn.
    const nearAvenue = ROADS.avenues.find((a) => Math.abs(car.x - a) < 14);
    const nearStreet = ROADS.streets.find((s) => Math.abs(car.y - s) < 14);
    if (nearAvenue !== undefined && nearStreet !== undefined) {
      const key = `${nearAvenue},${nearStreet}`;
      if (car.lastTurn !== key) {
        car.lastTurn = key;
        const r = random();
        let newDir = car.dir;
        if (r < 0.22) newDir = (car.dir + 1) % 4; // right
        else if (r < 0.38) newDir = (car.dir + 3) % 4; // left
        if (newDir !== car.dir) {
          car.dir = newDir;
          car.angle = (newDir * Math.PI) / 2;
          // Snap to the new road's lane.
          if (newDir === 0 || newDir === 2) car.y = nearStreet + (newDir === 0 ? laneOff : -laneOff);
          else car.x = nearAvenue + (newDir === 1 ? laneOff : -laneOff);
        }
      }
    }
    // Wrap around the world edge instead of driving off it.
    if (car.x < 30) { car.x = 30; car.dir = 0; car.angle = 0; }
    if (car.x > WORLD.width - 130) { car.x = WORLD.width - 130; car.dir = 2; car.angle = Math.PI; }
    if (car.y < 30) { car.y = 30; car.dir = 1; car.angle = Math.PI / 2; }
    if (car.y > WORLD.height - 30) { car.y = WORLD.height - 30; car.dir = 3; car.angle = -Math.PI / 2; }
  }

  // --- Police ---------------------------------------------------------------
  function stepPoliceCar(car, dt) {
    const p = state.player;
    // Chase along the roads: at each intersection, turn toward the player.
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
    // Speed up when closing in, slow to corner.
    car.targetSpeed = dist < 260 ? 420 : 320;
    const sp = Math.min(car.targetSpeed, car.vf + 260 * dt);
    car.vf = sp;
    const mx = [1, 0, -1, 0][car.dir];
    const my = [0, 1, 0, -1][car.dir];
    car.x += mx * sp * dt;
    car.y += my * sp * dt;
    const nearAvenue = ROADS.avenues.find((a) => Math.abs(car.x - a) < 16);
    const nearStreet = ROADS.streets.find((s) => Math.abs(car.y - s) < 16);
    if (nearAvenue !== undefined && nearStreet !== undefined) {
      const key = `${nearAvenue},${nearStreet}`;
      if (car.lastTurn !== key) {
        car.lastTurn = key;
        // Turn toward the player when it helps; otherwise keep going.
        const options = [car.dir, wantDir, (car.dir + 1) % 4, (car.dir + 3) % 4];
        let best = car.dir;
        let bestScore = -Infinity;
        for (const d of options) {
          const nx = car.x + [1, 0, -1, 0][d] * 100;
          const ny = car.y + [0, 1, 0, -1][d] * 100;
          const score = -Math.hypot(p.x - nx, p.y - ny) + (d === car.dir ? 30 : 0);
          if (score > bestScore) { bestScore = score; best = d; }
        }
        if (best !== car.dir) {
          car.dir = best;
          car.angle = (best * Math.PI) / 2;
          if (best === 0 || best === 2) car.y = nearStreet + (best === 0 ? 20 : -20);
          else car.x = nearAvenue + (best === 1 ? 20 : -20);
        }
      }
    }
    // Ram the player when close and on the same stretch.
    if (dist < 70) {
      const pCar = p.car;
      if (pCar) {
        pCar.health -= POLICE.carRamDamage * dt * 2;
        pCar.vf *= 1 - 0.4 * dt;
        state.camera.shake = Math.max(state.camera.shake, 3);
      } else if (dist < 30) {
        // A police car nudging a pedestrian player: the cop gets out.
        const cop = makePed(car.x, car.y, 'cop');
        cop.state = 'chase';
        state.cops.push(cop);
        car.vf = 0;
      }
    }
    if (car.x < 30 || car.x > WORLD.width - 130 || car.y < 30 || car.y > WORLD.height - 30) {
      // Turn around at the edge.
      car.dir = (car.dir + 2) % 4;
      car.angle = (car.dir * Math.PI) / 2;
      car.x = clamp(car.x, 40, WORLD.width - 140);
      car.y = clamp(car.y, 40, WORLD.height - 40);
    }
  }

  function stepCop(cop, dt) {
    const p = state.player;
    if (cop.dead) return;
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 700) {
      // Lost the player: give up.
      cop.state = 'walk';
      return;
    }
    const speed = 205;
    cop.angle = Math.atan2(dy, dx);
    const nx = cop.x + Math.cos(cop.angle) * speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * speed * dt;
    if (!isBlocked(city, nx, cop.y, 12)) cop.x = nx;
    if (!isBlocked(city, cop.x, ny, 12)) cop.y = ny;
    if (dist < 30) {
      cop.bustTimer += dt;
      if (cop.bustTimer >= POLICE.bustTime) {
        state.over = 'busted';
        state.stats.busted += 1;
      }
    } else {
      cop.bustTimer = Math.max(0, cop.bustTimer - dt);
    }
    // Cops shoot at high wanted levels.
    if (state.wanted >= POLICE.shootAtStars && dist < 300 && dist > 60) {
      cop.fireTimer -= dt;
      if (cop.fireTimer <= 0 && lineOfSight(city, cop.x, cop.y, p.x, p.y)) {
        cop.fireTimer = range(random, 0.7, 1.3);
        if (random() < 0.45) damagePlayer(range(random, 7, 12));
        burst(cop.x + Math.cos(cop.angle) * 16, cop.y + Math.sin(cop.angle) * 16, '#ffd23f', 3, 90, 0.15, 3);
      }
    }
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.health <= 0) return;
    p.health -= amount;
    p.hurtTimer = 6;
    state.camera.shake = Math.max(state.camera.shake, 5);
    burst(p.x, p.y, '#e0526b', 5, 110, 0.35, 4);
    if (p.health <= 0) {
      p.health = 0;
      state.over = 'wasted';
      state.stats.wasted += 1;
    }
  }

  // --- Pedestrians ----------------------------------------------------------
  function stepPed(ped, dt) {
    if (ped.dead) {
      ped.fade += dt;
      return;
    }
    const p = state.player;
    const dx = p.x - ped.x;
    const dy = p.y - ped.y;
    const dist = Math.hypot(dx, dy);
    // Flee gunfire or a speeding car.
    if (ped.state === 'flee') {
      ped.fleeTime -= dt;
      const speed = PEDS.runSpeed;
      ped.angle = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      if (!isBlocked(city, nx, ped.y, 10)) ped.x = nx;
      if (!isBlocked(city, ped.x, ny, 10)) ped.y = ny;
      if (ped.fleeTime <= 0) ped.state = 'walk';
      return;
    }
    if (dist < 90 && ((p.car && Math.abs(p.car.vf) > 120) || state.time - (ped.lastShot || -99) < 1)) {
      ped.state = 'flee';
      ped.fleeX = p.x;
      ped.fleeY = p.y;
      ped.fleeTime = range(random, 1.5, 3);
      return;
    }
    // Wander along the sidewalks.
    const speed = PEDS.walkSpeed;
    const mx = [1, 0, -1, 0][ped.dir];
    const my = [0, 1, 0, -1][ped.dir];
    ped.angle = Math.atan2(my, mx);
    let nx = ped.x + mx * speed * dt;
    let ny = ped.y + my * speed * dt;
    // Turn at intersections sometimes; bounce off the world edge.
    const nearAvenue = ROADS.avenues.find((a) => Math.abs(ped.x - a) < 12);
    const nearStreet = ROADS.streets.find((s) => Math.abs(ped.y - s) < 12);
    if ((nearAvenue !== undefined || nearStreet !== undefined) && random() < 0.012) {
      ped.dir = Math.floor(random() * 4);
    }
    if (nx < 30 || nx > WORLD.width - 60 || ny < 30 || ny > WORLD.height - 30) {
      ped.dir = (ped.dir + 2) % 4;
      nx = ped.x; ny = ped.y;
    }
    if (!isBlocked(city, nx, ped.y, 10)) ped.x = nx;
    if (!isBlocked(city, ped.x, ny, 10)) ped.y = ny;
    // Far from the player: respawn near them so the streets stay alive.
    if (dist > 1000) {
      const np = spawnPed(p.x, p.y);
      ped.x = np.x; ped.y = np.y;
    }
  }

  // --- Enemies --------------------------------------------------------------
  function stepEnemy(e, dt) {
    if (e.dead) { e.fade += dt; return; }
    const p = state.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.angle = Math.atan2(dy, dx);
    if (dist > 200) {
      // Close the distance.
      const nx = e.x + Math.cos(e.angle) * 150 * dt;
      const ny = e.y + Math.sin(e.angle) * 150 * dt;
      if (!isBlocked(city, nx, e.y, 12)) e.x = nx;
      if (!isBlocked(city, e.x, ny, 12)) e.y = ny;
    } else if (dist > 60) {
      // Strafe.
      const sa = e.angle + Math.PI / 2;
      e.x += Math.cos(sa) * 40 * dt;
      e.y += Math.sin(sa) * 40 * dt;
    }
    if (dist < 320) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && lineOfSight(city, e.x, e.y, p.x, p.y)) {
        e.fireTimer = range(random, 0.6, 1.2);
        if (random() < 0.42) damagePlayer(range(random, 5, 9));
        burst(e.x + Math.cos(e.angle) * 16, e.y + Math.sin(e.angle) * 16, '#ffd23f', 3, 90, 0.15, 3);
      }
    }
  }

  // --- Combat ---------------------------------------------------------------
  function shootAt(x, y, angle) {
    const p = state.player;
    if (p.ammo <= 0) return EVENT_SHOT;
    p.ammo -= 1;
    p.fireTimer = PLAYER.pistolFireRate;
    const rangeMax = PLAYER.pistolRange;
    const targets = [];
    for (const e of state.enemies) if (!e.dead) targets.push({ x: e.x, y: e.y, kind: 'enemy', ref: e });
    for (const c of state.cops) if (!c.dead) targets.push({ x: c.x, y: c.y, kind: 'cop', ref: c });
    for (const w of state.peds) if (!w.dead) targets.push({ x: w.x, y: w.y, kind: 'ped', ref: w });
    for (const car of state.cars) {
      if (car.driver === 'player') continue;
      targets.push({ x: car.x, y: car.y, kind: 'car', ref: car, radius: 24 });
    }
    let best = null;
    let bestD = rangeMax;
    for (const t of targets) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d > rangeMax) continue;
      const a = Math.atan2(t.y - y, t.x - x);
      const spread = Math.abs(angDiff(a, angle));
      const radius = t.radius || 14;
      if (spread > Math.atan2(radius, d) + 0.02) continue;
      if (!lineOfSight(city, x, y, t.x, t.y)) continue;
      if (d < bestD) { bestD = d; best = t; }
    }
    const hx = x + Math.cos(angle) * (best ? bestD : rangeMax);
    const hy = y + Math.sin(angle) * (best ? bestD : rangeMax);
    state.particles.push({ x, y, vx: 0, vy: 0, life: 0.08, maxLife: 0.08, color: '#ffe9a8', size: 2, tracer: { x: hx, y: hy } });
    burst(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, '#ffd23f', 3, 120, 0.12, 4);
    let events = EVENT_SHOT;
    if (best) {
      burst(best.x, best.y, '#e0526b', 6, 130, 0.3, 4);
      if (best.kind === 'enemy' || best.kind === 'cop' || best.kind === 'ped') {
        const ref = best.ref;
        ref.health -= PLAYER.pistolDamage;
        ref.state = 'flee';
        ref.fleeX = x; ref.fleeY = y; ref.fleeTime = 2;
        if (ref.health <= 0) {
          ref.dead = true;
          ref.fade = 0;
          events |= EVENT_KILL;
          state.stats.kills += 1;
          dropPickup(ref.x, ref.y, 'cash', ref.kind === 'enemy' ? 60 : 25);
          if (best.kind === 'cop') events |= addWanted(WANTED.killCop, 'cop');
          else if (best.kind === 'ped') events |= addWanted(WANTED.killPed, 'ped');
        }
      } else if (best.kind === 'car') {
        const car = best.ref;
        car.health -= PLAYER.pistolDamage;
        if (car.health <= 0 && !car.dead) { car.dead = true; car.explodeTimer = 1.6; }
      }
    }
    return events;
  }

  function punch() {
    const p = state.player;
    p.punchTimer = 0.35;
    let events = EVENT_PUNCH;
    const targets = [];
    for (const e of state.enemies) if (!e.dead) targets.push({ x: e.x, y: e.y, ref: e, kind: 'enemy' });
    for (const c of state.cops) if (!c.dead) targets.push({ x: c.x, y: c.y, ref: c, kind: 'cop' });
    for (const w of state.peds) if (!w.dead) targets.push({ x: w.x, y: w.y, ref: w, kind: 'ped' });
    for (const t of targets) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > PLAYER.punchRange) continue;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      if (Math.abs(angDiff(a, p.angle)) > PLAYER.punchArc) continue;
      t.ref.health -= PLAYER.punchDamage;
      const ka = Math.atan2(t.y - p.y, t.x - p.x);
      t.ref.x += Math.cos(ka) * 14;
      t.ref.y += Math.sin(ka) * 14;
      burst(t.x, t.y, '#e8e4da', 4, 100, 0.25, 4);
      if (t.ref.health <= 0) {
        t.ref.dead = true;
        t.ref.fade = 0;
        events |= EVENT_KILL;
        state.stats.kills += 1;
        dropPickup(t.ref.x, t.ref.y, 'cash', t.kind === 'enemy' ? 60 : 25);
        if (t.kind === 'cop') events |= addWanted(WANTED.killCop, 'cop');
      }
      break;
    }
    return events;
  }

  function nearestCar(dist) {
    const p = state.player;
    let best = null;
    let bestD = dist;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar(car) {
    const p = state.player;
    let events = 0;
    if (car.driver === 'traffic') {
      // Pull the driver out: they run away, and it is a theft.
      const driver = makePed(car.x, car.y, 'walker');
      driver.state = 'flee';
      driver.fleeX = p.x; driver.fleeY = p.y; driver.fleeTime = 3;
      state.peds.push(driver);
      car.driver = 'player';
      events |= EVENT_STEAL;
      events |= addWanted(WANTED.stealCar, 'steal');
      state.stats.stolen += 1;
    } else if (car.driver === 'parked' || car.driver === 'police') {
      // A parked car, or even a police cruiser, is yours if you are quick.
      car.driver = 'player';
      events |= EVENT_STEAL;
      events |= addWanted(WANTED.stealCar, 'steal');
      state.stats.stolen += 1;
    }
    p.car = car;
    car.siren = false;
    return events;
  }

  function exitCar() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    p.x = car.x - fy * 30;
    p.y = car.y + fx * 30;
    resolveCircle(city, p, PLAYER.radius);
    car.driver = 'parked';
    car.vf = 0;
    car.vr = 0;
    p.car = null;
  }

  // --- Wanted & police ------------------------------------------------------
  function updateWanted(dt) {
    const p = state.player;
    // Are the police close?
    let policeNear = false;
    for (const car of state.cars) if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 380) policeNear = true;
    for (const cop of state.cops) if (!cop.dead && Math.hypot(cop.x - p.x, cop.y - p.y) < 300) policeNear = true;
    if (state.wanted > 0) {
      if (policeNear) {
        state.quietTime = 0;
        state.decayTimer = 0;
      } else {
        state.quietTime += dt;
        if (state.quietTime > POLICE.decayDelay) {
          state.decayTimer += dt;
          if (state.decayTimer >= POLICE.decayInterval) {
            state.decayTimer = 0;
            state.wanted = Math.max(0, state.wanted - 1);
          }
        }
      }
    }
    // Spawn police to match the wanted level.
    if (state.wanted > 0) {
      const wantCars = Math.min(POLICE.maxCars, state.wanted + 1);
      const haveCars = state.cars.filter((c) => c.driver === 'police' && !c.dead).length;
      if (haveCars < wantCars && random() < 0.02) spawnPoliceCar();
      if (!p.car) {
        const wantCops = Math.min(POLICE.maxOnFoot, state.wanted);
        const haveCops = state.cops.filter((c) => !c.dead).length;
        if (haveCops < wantCops && random() < 0.015) spawnCop();
      }
    }
  }

  // --- Missions hook ---------------------------------------------------------
  function missionEvents(dt, ctl) {
    return missions.update(state, dt, ctl, {
      spawnEnemy,
      addWanted,
      setBanner(text, time) { state.banner = text; state.bannerTime = time; },
      setDialogue(lines) { state.dialogue = lines; state.dialogueTime = 0; },
    });
  }

  // --- Main step ------------------------------------------------------------
  function step(dt, ctl) {
    let events = 0;
    state.time += dt;
    const p = state.player;
    if (state.over) return events;

    // Dialogue lines advance on their own timer.
    if (state.dialogue) {
      state.dialogueTime += dt;
      if (state.dialogueTime > 3.6) {
        state.dialogue.shift();
        state.dialogueTime = 0;
        if (state.dialogue.length === 0) state.dialogue = null;
      }
    }
    if (state.bannerTime > 0) {
      state.bannerTime -= dt;
      if (state.bannerTime <= 0) state.banner = null;
    }

    // Entering / leaving cars.
    if (ctl.enterPressed) {
      if (p.car) exitCar();
      else {
        const car = nearestCar(52);
        if (car) events |= enterCar(car);
      }
    }
    if (ctl.punchPressed && !p.car) events |= punch();
    if (ctl.fireHeld && !p.car && p.armed && p.fireTimer <= 0 && p.reloadTimer <= 0) {
      if (p.ammo > 0) {
        events |= shootAt(p.x, p.y, p.angle);
        for (const w of state.peds) if (!w.dead && Math.hypot(w.x - p.x, w.y - p.y) < 320) w.lastShot = state.time;
        // Firing a gun in public is noticed.
        if (state.wanted < 1 && random() < 0.5) events |= addWanted(WANTED.shoot, 'shoot');
      } else if (p.reloadTimer <= 0) {
        p.reloadTimer = PLAYER.reloadTime;
        p.ammo = PLAYER.pistolMag;
      }
    }
    if (ctl.reloadPressed && !p.car && p.reloadTimer <= 0 && p.ammo < PLAYER.pistolMag) {
      p.reloadTimer = PLAYER.reloadTime;
      p.ammo = PLAYER.pistolMag;
    }
    if (ctl.toggleWeapon && !p.car) p.armed = !p.armed;

    if (p.car) stepPlayerDriving(dt, ctl);
    else stepPlayerOnFoot(dt, ctl);

    // Cars: traffic, police, and the player's.
    for (const car of state.cars) {
      if (car.hurtTimer > 0) car.hurtTimer -= dt;
      if (car.dead) {
        if (car.explodeTimer > 0) {
          car.explodeTimer -= dt;
          burst(car.x, car.y, '#5a6270', 2, 60, 0.8, 6);
          if (car.explodeTimer <= 0) {
            explode(car.x, car.y, true);
            events |= EVENT_EXPLODE;
            // Damage things nearby.
            for (const e of state.enemies) if (!e.dead && Math.hypot(e.x - car.x, e.y - car.y) < 90) { e.health = 0; e.dead = true; }
            for (const c of state.cops) if (!c.dead && Math.hypot(c.x - car.x, c.y - car.y) < 90) { c.health = 0; c.dead = true; }
            if (p.car === car) {
              // The player's ride blew up: throw them clear, hurt.
              exitCar();
              damagePlayer(30);
            } else if (Math.hypot(p.x - car.x, p.y - car.y) < 90 && !p.car) {
              damagePlayer(30);
            }
            car.explodeTimer = -1;
          }
        }
        continue;
      }
      if (car.driver === 'traffic') stepTrafficCar(car, dt);
      else if (car.driver === 'police') stepPoliceCar(car, dt);
      else if (car.driver === 'parked') {
        // Parked cars sit still; smoke when damaged.
      }
      if (car.health < 45 && car.health > 0 && random() < 0.1) {
        burst(car.x, car.y - 8, '#5a6270', 1, 40, 0.9, 5);
      }
      if (car.health <= 0 && !car.dead) { car.dead = true; car.explodeTimer = 1.6; }
    }
    // Car vs car collisions (simple circle push).
    for (let i = 0; i < state.cars.length; i += 1) {
      const a = state.cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const b = state.cars[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 38) {
          const push = (38 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const impact = Math.abs(a.vf - b.vf);
          if (impact > 140) {
            if (a.hurtTimer <= 0) { a.health -= impact * 0.02; a.hurtTimer = 0.5; }
            if (b.hurtTimer <= 0) { b.health -= impact * 0.02; b.hurtTimer = 0.5; }
            burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#e8d44d', 5, 110, 0.3, 4);
            if (a.driver === 'traffic' && impact > 240) {
              const driver = makePed(a.x, a.y, 'walker');
              driver.state = 'flee'; driver.fleeX = p.x; driver.fleeY = p.y; driver.fleeTime = 3;
              state.peds.push(driver);
              a.driver = 'parked';
            }
            if (b.driver === 'traffic' && impact > 240) {
              const driver = makePed(b.x, b.y, 'walker');
              driver.state = 'flee'; driver.fleeX = p.x; driver.fleeY = p.y; driver.fleeTime = 3;
              state.peds.push(driver);
              b.driver = 'parked';
            }
          }
        }
      }
    }
    // Cars running over pedestrians.
    for (const car of state.cars) {
      if (car.dead || Math.abs(car.vf) < 50) continue;
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
          ped.dead = true;
          ped.fade = 0;
          burst(ped.x, ped.y, '#e0526b', 6, 130, 0.4, 4);
          if (car.driver === 'player') events |= addWanted(WANTED.runOverPed, 'ped');
        }
      }
      for (const cop of state.cops) {
        if (cop.dead) continue;
        if (Math.hypot(cop.x - car.x, cop.y - car.y) < 26 && car.driver === 'player') {
          cop.dead = true; cop.fade = 0;
          events |= EVENT_KILL;
          events |= addWanted(WANTED.killCop, 'cop');
        }
      }
    }

    for (const ped of state.peds) stepPed(ped, dt);
    for (const e of state.enemies) stepEnemy(e, dt);
    for (const cop of state.cops) stepCop(cop, dt);
    updateWanted(dt);
    events |= missionEvents(dt, ctl);

    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.bob += dt * 3;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 30) {
        if (pk.kind === 'cash') { state.money += pk.amount; p.money = state.money; }
        else if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + pk.amount);
        else if (pk.kind === 'ammo') p.ammo = Math.min(PLAYER.pistolMag * 4, p.ammo + pk.amount);
        events |= EVENT_PICKUP;
        state.pickups.splice(i, 1);
      }
    }
    // Respawn the garage/hospital pickups.
    if (!state.pickups.some((pk) => pk.kind === 'health') && random() < 0.002) {
      dropPickup(PLACES.hospital.x + 40, PLACES.hospital.y + 40, 'health', 50);
    }
    if (!state.pickups.some((pk) => pk.kind === 'ammo') && random() < 0.002) {
      dropPickup(PLACES.garage.x + 80, PLACES.garage.y + 60, 'ammo', 24);
    }

    // Particles and skid marks decay.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
    }
    for (let i = state.skid.length - 1; i >= 0; i -= 1) {
      state.skid[i].life -= dt;
      if (state.skid[i].life <= 0) state.skid.splice(i, 1);
    }
    // Dead bodies fade out.
    for (const list of [state.peds, state.enemies, state.cops]) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (list[i].dead && list[i].fade > 6) list.splice(i, 1);
      }
    }

    // Camera follows the player, zooming out a little at speed.
    const targetZoom = p.car ? 1 - Math.min(0.18, Math.abs(p.car.vf) / 2600) : 1;
    state.camera.zoom += (targetZoom - state.camera.zoom) * Math.min(1, 3 * dt);
    state.camera.x += (p.x - state.camera.x) * Math.min(1, 6 * dt);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, 6 * dt);
    if (state.camera.shake > 0) state.camera.shake = Math.max(0, state.camera.shake - 30 * dt);

    // Busted / wasted ends the run; the caller respawns the player.
    if (state.over === 'busted' || state.over === 'wasted') {
      events |= state.over === 'busted' ? EVENT_BUSTED : EVENT_WASTED;
    }
    return events;
  }

  function respawn() {
    const p = state.player;
    const lost = Math.min(state.money, 150);
    state.money -= lost;
    state.wanted = 0;
    state.cops = [];
    for (const car of state.cars) if (car.driver === 'police') car.driver = 'parked';
    p.health = PLAYER.health;
    p.ammo = PLAYER.pistolMag;
    p.car = null;
    p.x = PLACES.garage.x - 60;
    p.y = PLACES.garage.y + 30;
    p.angle = -Math.PI / 2;
    state.camera.x = p.x;
    state.camera.y = p.y;
    state.over = null;
    missions.restartCurrent();
  }

  function serialize() {
    return {
      money: state.money,
      missionIndex: state.mission.index,
      missionStep: state.mission.step,
      completed: state.mission.completed,
      x: state.player.x,
      y: state.player.y,
      health: state.player.health,
    };
  }

  function deserialize(save) {
    state.money = save.money || 0;
    state.player.money = state.money;
    state.player.x = save.x || PLACES.garage.x - 60;
    state.player.y = save.y || PLACES.garage.y + 30;
    state.player.health = save.health || PLAYER.health;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    missions.load(save.missionIndex || 0, save.missionStep || 0, save.completed || []);
    state.mission = missions.state;
  }

  reset();
  return {
    state, reset, step, respawn, serialize, deserialize,
    nearestCar,
    addWanted,
    // Staging helpers, used by the screenshot scenes (and only there): they
    // put the world into a chosen situation without going through play.
    setWanted(n) {
      state.wanted = clamp(n, 0, 5);
      state.quietTime = 0;
      state.decayTimer = 0;
    },
    // Drop the heat entirely (the mission screenshot uses this so the
    // firefight, not a bust, is what the frame shows).
    clearHeat() {
      state.wanted = 0;
      state.quietTime = 0;
      state.decayTimer = 0;
      state.cops.length = 0;
      state.cars = state.cars.filter((c) => c.driver !== 'police');
    },
    spawnPoliceCar,
    teleportPlayer(x, y) {
      const p = state.player;
      p.x = x; p.y = y;
      state.camera.x = x;
      state.camera.y = y;
    },
    putPlayerInCar(type, x, y, angle) {
      const car = makeCar(type, x, y, angle, 'player');
      state.cars.push(car);
      state.player.car = car;
      state.player.x = x;
      state.player.y = y;
      state.player.angle = angle;
      return car;
    },
    startMissionAt(index, stepIndex) {
      missions.forceStart(index, stepIndex);
      state.mission = missions.state;
    },
    suppressMissions() {
      missions.suppressAuto();
    },
  };
}
