// SOLMARA — the city itself. A deterministic grid city built from a seed: roads,
// blocks with an alley through each, buildings, two parks, a beach and a pier.
// The same seed always builds the same city, so screenshots repeat.
import { PALETTE, PLACES, ROADS, WORLD } from './config.js';
import { int, pick, range } from './random.js';

const BLOCK_COLS = ROADS.avenues.length - 1; // 7
const BLOCK_ROWS = ROADS.streets.length - 1; // 5

// Blocks with a special job, keyed "col,row".
const SPECIAL = {
  '1,4': 'garage',
  '3,2': 'bank',
  '2,0': 'market',
  '5,2': 'hospital',
  '3,3': 'plaza',
  '1,1': 'park',
};

const SPECIAL_COLOR = {
  garage: '#5a7d4a',
  bank: '#c2a35e',
  market: '#7d8aa0',
  hospital: '#e8e4da',
};

function blockRect(col, row) {
  return {
    x0: ROADS.avenues[col] + ROADS.halfWidth + 8,
    x1: ROADS.avenues[col + 1] - ROADS.halfWidth - 8,
    y0: ROADS.streets[row] + ROADS.halfWidth + 8,
    y1: ROADS.streets[row + 1] - ROADS.halfWidth - 8,
  };
}

/** Build the city from a seeded random. Returns { buildings, trees, parks, water }. */
export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parks = [];
  // The ocean: a band along the east edge, with a sand beach in front of it.
  const water = { x0: WORLD.width - 40, x1: WORLD.width, y0: 0, y1: WORLD.height };
  const beach = { x0: ROADS.avenues[ROADS.avenues.length - 1] + ROADS.halfWidth, x1: water.x0, y0: 0, y1: WORLD.height };

  for (let col = 0; col < BLOCK_COLS; col += 1) {
    for (let row = 0; row < BLOCK_ROWS; row += 1) {
      const rect = blockRect(col, row);
      const key = `${col},${row}`;
      const kind = SPECIAL[key] || 'block';
      if (kind === 'plaza' || kind === 'park') {
        parks.push({ ...rect, kind });
        const count = kind === 'plaza' ? 7 : 9;
        for (let i = 0; i < count; i += 1) {
          trees.push({
            x: range(random, rect.x0 + 24, rect.x1 - 24),
            y: range(random, rect.y0 + 24, rect.y1 - 24),
            r: range(random, 12, 18),
          });
        }
        continue;
      }
      // One horizontal alley through the block's middle, buildings above and below.
      const midY = (rect.y0 + rect.y1) / 2;
      // The mid-block alley is wide enough for a car to pass without
      // scraping both walls: a car's collision circles are 11 units, so
      // the alley needs to be well wider than 22 plus room to cut a corner.
      const alleyHalf = 38;
      const bw = rect.x1 - rect.x0;
      const topH = Math.max(40, midY - alleyHalf - rect.y0 - 14);
      const botH = Math.max(40, rect.y1 - (midY + alleyHalf) - 14);
      const topW = bw * range(random, 0.55, 0.9);
      const botW = bw * range(random, 0.55, 0.9);
      const topX = rect.x0 + range(random, 0, bw - topW);
      const botX = rect.x0 + range(random, 0, bw - botW);
      const color = SPECIAL_COLOR[kind] || pick(random, PALETTE.buildingRoof);
      buildings.push({
        x: topX, y: rect.y0 + 6, w: topW, h: topH, color, kind,
        label: kind === 'garage' ? "VERA'S GARAGE" : kind === 'bank' ? 'HARBOR BANK' : kind === 'market' ? 'NORTH MARKET' : kind === 'hospital' ? 'ST. MARA' : null,
      });
      buildings.push({
        x: botX, y: midY + alleyHalf + 8, w: botW, h: botH, color: pick(random, PALETTE.buildingRoof), kind: 'building', label: null,
      });
      // A tree or two on the block's corners.
      if (random() < 0.7) trees.push({ x: rect.x0 + 14, y: rect.y0 + 14, r: 12 });
      if (random() < 0.5) trees.push({ x: rect.x1 - 14, y: rect.y1 - 14, r: 12 });
    }
  }

  // The pier at the marina, reaching into the water.
  const pier = { x: PLACES.marina.x - 10, y: PLACES.marina.y - 60, w: 120, h: 20 };
  // A fountain in the middle of Sunset Plaza's park — the one solid landmark.
  // (The plaza mission marker sits at the park's corner, so the fountain never
  // blocks an objective.)
  const circles = [{ x: 1280, y: 1280, r: 34 }];
  // Palm trees along the beach.
  const palms = [];
  for (let i = 0; i < 10; i += 1) {
    palms.push({ x: 2452 + (i % 2) * 12, y: 140 + i * 170, r: 13 });
  }
  // Boats moored in the marina water, east of the pier.
  const boats = [];
  for (let i = 0; i < 5; i += 1) {
    boats.push({ x: 2532 + (i % 2) * 14, y: 300 + i * 260, angle: (i % 2 ? 0.4 : -0.3) });
  }
  // A lighthouse at the end of the pier.
  const lighthouse = { x: pier.x + pier.w - 8, y: pier.y + pier.h / 2 };

  return { buildings, trees, parks, water, beach, pier, circles, palms, boats, lighthouse };
}

/** True when the circle at (x, y) with radius r hits a building, a tree or the water. */
export function isBlocked(city, x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  if (x + r > city.water.x0 && y > 0) {
    // The beach is walkable; only the water itself blocks.
    if (x + r > city.water.x0 + 8) return true;
  }
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  // Solid round landmarks (the plaza fountain).
  for (const c of city.circles || []) {
    if (Math.hypot(x - c.x, y - c.y) < c.r + r) return true;
  }
  return false;
}

/** Push a circle out of whatever it overlaps; returns true when it was moved. */
export function resolveCircle(city, p, r) {
  let moved = false;
  p.x = Math.max(r, Math.min(WORLD.width - r, p.x));
  p.y = Math.max(r, Math.min(WORLD.height - r, p.y));
  if (p.x + r > city.water.x0 + 8) { p.x = city.water.x0 + 8 - r; moved = true; }
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
      moved = true;
    }
  }
  for (const c of city.circles || []) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d < c.r + r) {
      p.x = c.x + (dx / d) * (c.r + r);
      p.y = c.y + (dy / d) * (c.r + r);
      moved = true;
    }
  }
  return moved;
}

/** True when no building stands between the two points (for gunfire). */
export function lineOfSight(city, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 24));
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + (dx * i) / steps;
    const y = y1 + (dy * i) / steps;
    for (let b = 0; b < city.buildings.length; b += 1) {
      const bd = city.buildings[b];
      if (x > bd.x && x < bd.x + bd.w && y > bd.y && y < bd.y + bd.h) return false;
    }
  }
  return true;
}

/** True when the point is on a road (inside the asphalt). */
export function isOnRoad(x, y) {
  for (const ax of ROADS.avenues) if (Math.abs(x - ax) <= ROADS.halfWidth) return true;
  for (const st of ROADS.streets) if (Math.abs(y - st) <= ROADS.halfWidth) return true;
  return false;
}

/** A random point on a road, for traffic spawns. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const ax = pick(random, ROADS.avenues);
    return { x: ax + range(random, -30, 30), y: range(random, 60, WORLD.height - 60), vertical: true };
  }
  const st = pick(random, ROADS.streets);
  return { x: range(random, 60, WORLD.width - 120), y: st + range(random, -30, 30), vertical: false };
}

/** A random point on a sidewalk (just outside a road's edge), for pedestrians. */
export function randomSidewalkPoint(random) {
  const p = randomRoadPoint(random);
  const off = ROADS.halfWidth + 14;
  if (p.vertical) return { x: p.x + (random() < 0.5 ? -off : off), y: p.y };
  return { x: p.x, y: p.y + (random() < 0.5 ? -off : off) };
}

/** The nearest point on the road network to (x, y) — used to put cars back on roads. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of ROADS.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y: Math.max(40, Math.min(WORLD.height - 40, y)), vertical: true }; }
  }
  for (const st of ROADS.streets) {
    const d = Math.abs(y - st);
    if (d < bestD) { bestD = d; best = { x: Math.max(40, Math.min(WORLD.width - 120, x)), y: st, vertical: false }; }
  }
  return best;
}
