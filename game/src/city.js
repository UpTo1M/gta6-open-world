// The city of Solmara, laid out from a seed. Roads are a grid of avenues
// and streets; blocks between them hold buildings, two parks, a plaza and a
// fountain; the east edge is beach and ocean, with a pier and a lighthouse.
// Everything here is pure data — no canvas, no DOM — so the Node sim can
// load the same city the browser draws.

import { AVENUES, STREETS, ROAD_W, WORLD, BEACH_X } from './config.js';
import { createRng as makeRng } from './random.js';

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [
    { x: 800, y: 480, w: 220, h: 180, name: 'North Park' },
    { x: 1760, y: 1440, w: 220, h: 180, name: 'South Park' },
  ];
  const plaza = { x: 1440, y: 800, w: 200, h: 160 };

  // Buildings fill each block, leaving a margin for the sidewalk and an
  // alley through the middle of wide blocks. Park and plaza blocks stay
  // open; nothing is built on the beach or in the ocean.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (cx > BEACH_X - 90) continue; // beach blocks stay empty
      if (parks.some((p) => Math.abs(cx - p.x) < 200 && Math.abs(cy - p.y) < 180)) continue;
      if (Math.abs(cx - plaza.x) < 200 && Math.abs(cy - plaza.y) < 160) continue;
      const bw = x1 - x0;
      const bh = y1 - y0;
      const wide = bw > 200;
      const tall = bh > 200;
      const count = wide && tall ? 4 : wide || tall ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const col = count === 4 ? i % 2 : 0;
        const row = count === 4 ? Math.floor(i / 2) : count === 2 && wide ? i : 0;
        const ww = count === 4 ? bw / 2 - 26 : count === 2 && wide ? bw / 2 - 26 : bw - 20;
        const hh = count === 4 ? bh / 2 - 26 : count === 2 && !wide ? bh / 2 - 26 : bh - 20;
        const bx = x0 + (count === 4 || (count === 2 && wide) ? col * (bw / 2) + 10 : 10);
        const by = y0 + (count === 4 || (count === 2 && !wide) ? row * (bh / 2) + 10 : 10);
        buildings.push({
          x: bx, y: by, w: ww, h: hh,
          hue: rng.int(18, 46),
          roof: rng.pick(['#b45309', '#475569', '#7c2d12', '#334155', '#92400e']),
        });
      }
    }
  }

  // The pier runs east from the beach into the ocean; the lighthouse caps it.
  const pier = { x: 2320, y: 800, w: 220, h: 46 };
  const lighthouse = { x: 2480, y: 800, r: 26 };

  // Moored boats in the marina, south-east.
  const boats = [];
  for (let i = 0; i < 5; i++) {
    boats.push({ x: 2080 + i * 52, y: 1520 + (i % 2) * 40, a: rng.range(-0.4, 0.4) });
  }

  // Beach palms along the sand.
  const palms = [];
  for (let i = 0; i < 14; i++) {
    palms.push({ x: rng.range(2330, 2390), y: rng.range(120, 1800) });
  }

  return {
    seed, buildings, parks, plaza, pier, lighthouse, boats, palms,
    avenues: AVENUES.slice(), streets: STREETS.slice(),
    // A block grid over the buildings, so collision only tests the nine
    // blocks around a point instead of every building in the city.
    bgrid: buildBlockGrid(buildings),
  };
}

// Bucket buildings by the block they sit in (blocks are ~320px, buildings
// never straddle one), for fast collision lookups.
function buildBlockGrid(buildings) {
  const grid = new Map();
  for (const b of buildings) {
    const ai = Math.max(0, Math.min(7, Math.floor((b.x + b.w / 2 - 160) / 320)));
    const si = Math.max(0, Math.min(5, Math.floor((b.y + b.h / 2 - 160) / 320)));
    const key = `${ai},${si}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(b);
  }
  return grid;
}

function buildingsNear(city, x, y) {
  const ai = Math.max(0, Math.min(7, Math.floor((x - 160) / 320)));
  const si = Math.max(0, Math.min(5, Math.floor((y - 160) / 320)));
  const out = [];
  for (let da = -1; da <= 1; da++) {
    for (let ds = -1; ds <= 1; ds++) {
      const list = city.bgrid.get(`${ai + da},${si + ds}`);
      if (list) out.push(...list);
    }
  }
  return out;
}

export function districtAt(x, y) {
  if (y < 640) return 'harbor';
  if (y < 1280) return 'stmara';
  return 'docks';
}

export function isOnRoad(x, y) {
  const onAvenue = AVENUES.some((ax) => Math.abs(x - ax) <= ROAD_W / 2);
  const onStreet = STREETS.some((sy) => Math.abs(y - sy) <= ROAD_W / 2);
  return onAvenue || onStreet;
}

export function inOcean(x, y) {
  return x > 2440;
}

export function onBeach(x, y) {
  return x > BEACH_X && x <= 2440;
}

// Circle-vs-buildings collision. Returns the corrected position after
// sliding along walls: try the full move, then each axis on its own.
export function collideCircle(city, x, y, r, nx, ny) {
  const hit = (px, py) => {
    if (px < r || py < r || px > WORLD.w - r || py > WORLD.h - r) return true;
    for (const b of buildingsNear(city, px, py)) {
      if (px + r > b.x && px - r < b.x + b.w && py + r > b.y && py - r < b.y + b.h) return true;
    }
    return false;
  };
  if (!hit(nx, ny)) return { x: nx, y: ny };
  if (!hit(nx, y)) return { x: nx, y };
  if (!hit(x, ny)) return { x, y: ny };
  return { x, y };
}

// Snap a point to the nearest road centreline (used for traffic spawns and
// for keeping parked cars on the street).
export function nearestRoadPoint(x, y) {
  let bestA = AVENUES[0];
  for (const ax of AVENUES) if (Math.abs(x - ax) < Math.abs(x - bestA)) bestA = ax;
  let bestS = STREETS[0];
  for (const sy of STREETS) if (Math.abs(y - sy) < Math.abs(y - bestS)) bestS = sy;
  if (Math.abs(x - bestA) < Math.abs(y - bestS)) return { x: bestA, y };
  return { x, y: bestS };
}

// A random point on a road, for traffic and pedestrian spawns.
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(AVENUES), y: rng.range(80, WORLD.h - 80) };
  }
  return { x: rng.range(80, WORLD.w - 80), y: rng.pick(STREETS) };
}

// The nearest intersection to a point (traffic waypoints).
export function nearestIntersection(x, y) {
  let bestA = AVENUES[0];
  for (const ax of AVENUES) if (Math.abs(x - ax) < Math.abs(x - bestA)) bestA = ax;
  let bestS = STREETS[0];
  for (const sy of STREETS) if (Math.abs(y - sy) < Math.abs(y - bestS)) bestS = sy;
  return { x: bestA, y: bestS };
}
