// SOLMARA — the screenshot scenes behind ?shot=start|drive|chase|mission. Each
// one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so the frame is what real play looks
// like and the same seed always gives the same frame.
import { PLACES, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 2.4;
const CHASE_SECONDS = 2.2;
const MISSION_SECONDS = 2.0;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function emptyCtl() {
  return {
    up: false, down: false, left: false, right: false, run: false, handbrake: false,
    enterPressed: false, punchPressed: false, fireHeld: false, reloadPressed: false,
    toggleWeapon: false, aimX: 0, aimY: 0,
  };
}

/**
 * Drive straight along one avenue toward `dirY` (+1 south, -1 north), staying
 * in lane and easing around a car ahead. The shot is taken mid-straight, at
 * speed, before the car reaches the avenue's end.
 */
function driveCtl(world, avenueX, dirY) {
  const ctl = emptyCtl();
  const car = world.state.player.car;
  if (!car) return ctl;
  const speed = Math.abs(car.vf);
  const lookahead = 70 + speed * 0.45;
  let blocker = null;
  let blockerAhead = Infinity;
  for (const other of world.state.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (ahead > 0 && ahead < lookahead && Math.abs(side) < 30 && ahead < blockerAhead) {
      blockerAhead = ahead;
      blocker = side;
    }
  }
  // Steer toward the avenue's centre line, and around a blocker if there is one.
  let targetX = avenueX;
  if (blocker !== null) targetX = avenueX + (blocker >= 0 ? -40 : 40);
  const aheadY = car.y + dirY * 220;
  const want = Math.atan2(aheadY - car.y, targetX - car.x);
  const steer = clamp(angDiff(want, car.angle) * 2.2, -1, 1);
  ctl.left = steer < -0.12;
  ctl.right = steer > 0.12;
  // Pass a slow car instead of queuing behind it: only brake when it is
  // right in front of the nose.
  ctl.up = !(blocker !== null && blockerAhead < 32);
  ctl.down = !!(blocker !== null && blockerAhead < 32);
  return ctl;
}

/** Fight the nearest living enemy: aim, fire, and keep moving. */
function combatCtl(world) {
  const ctl = emptyCtl();
  const p = world.state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of world.state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) {
    ctl.aimX = best.x;
    ctl.aimY = best.y;
    ctl.fireHeld = bestD < 340;
    // Strafe sideways so the frame has motion.
    const a = Math.atan2(best.y - p.y, best.x - p.x) + Math.PI / 2;
    ctl.left = Math.cos(a) < -0.3;
    ctl.right = Math.cos(a) > 0.3;
    ctl.up = Math.sin(a) < -0.3;
    ctl.down = Math.sin(a) > 0.3;
  }
  return ctl;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over a living city. drive: a run up the avenue in the
 * Comet GT, mission one on the HUD. chase: three stars, police on the tail.
 * mission: the plaza ambush, gun out, rivals closing in.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'drive') {
    world.startMissionAt(0, 0);
    world.putPlayerInCar('sport', 800, 1350, -Math.PI / 2);
    // Straight up the avenue, past the market: the frame catches the car at
    // speed with the mission marker ahead.
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      world.step(STEP, driveCtl(world, 800, -1));
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    world.suppressMissions();
    world.putPlayerInCar('sport', 1120, 420, Math.PI / 2);
    world.setWanted(3);
    world.spawnPoliceCar();
    world.spawnPoliceCar();
    world.spawnPoliceCar();
    // Straight down the avenue, police on the tail, mid-city when the frame lands.
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      world.step(STEP, driveCtl(world, 1120, 1));
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    world.startMissionAt(2, 1);
    world.teleportPlayer(PLACES.plaza.x - 80, PLACES.plaza.y + 90);
    s.player.armed = true;
    // Two seconds in the firefight is still going (two rivals down, two
    // closing in); any longer and the job is over and the heat arrives.
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      world.step(STEP, combatCtl(world));
    }
    world.clearHeat();
    return { screen: SCREEN_PLAY };
  }
  // start (and anything else): the title over a living city.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, emptyCtl());
  }
  return { screen: SCREEN_TITLE };
}
