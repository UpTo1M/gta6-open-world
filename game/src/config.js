// SOLMARA — tuning, palette and mission data. One place for every number the
// game balances on, so the world, the renderer and the missions all agree.
export const STEP = 1 / 60; // fixed simulation step, seconds

export const WORLD = { width: 2560, height: 1920 };

// The road grid: avenues run north-south, streets east-west, every 320 units.
export const ROADS = {
  avenues: [160, 480, 800, 1120, 1440, 1760, 2080, 2400],
  streets: [160, 480, 800, 1120, 1440, 1760],
  halfWidth: 45,
};

export const PLAYER = {
  radius: 12,
  walkSpeed: 175,
  runSpeed: 275,
  health: 100,
  punchDamage: 22,
  punchRange: 34,
  punchArc: 1.1,
  pistolDamage: 34,
  pistolRange: 340,
  pistolMag: 12,
  pistolFireRate: 0.16,
  reloadTime: 0.9,
};

export const CAR = {
  // length/width are the top-down footprint; radius is used for collisions.
  length: 46,
  width: 22,
  radius: 20,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 430,
  maxReverse: 140,
  steer: 3.1,
  grip: 6.5,
  handbrakeGrip: 2.2,
  health: 100,
};

export const CAR_TYPES = {
  sedan: { maxSpeed: 400, accel: 380, color: '#c94f42', name: 'Sedan' },
  taxi: { maxSpeed: 390, accel: 370, color: '#f2c230', name: 'Taxi' },
  sport: { maxSpeed: 520, accel: 520, color: '#2fa8e0', name: 'Comet GT' },
  truck: { maxSpeed: 330, accel: 300, color: '#7a8a99', name: 'Truck' },
  van: { maxSpeed: 360, accel: 330, color: '#e8e4da', name: 'Van' },
  police: { maxSpeed: 470, accel: 470, color: '#eef1f5', name: 'Interceptor' },
};

export const TRAFFIC = { count: 16, speed: 150, speedJitter: 40, spawnGap: 90 };
export const PEDS = { count: 26, walkSpeed: 55, runSpeed: 150 };
export const POLICE = {
  maxOnFoot: 4,
  maxCars: 5,
  bustTime: 1.4,
  shootAtStars: 3,
  carRamDamage: 12,
  decayDelay: 22, // seconds quiet before a star drops
  decayInterval: 14,
};

export const WANTED = {
  stealCar: 1,
  runOverPed: 1,
  shoot: 1,
  killCop: 2,
  killPed: 1,
  damageCar: 0,
};

// The story: four jobs from Vera Solano, who runs the garage on the south side.
// Each mission is a list of steps; the world engine walks them in order.
export const MISSIONS = [
  {
    id: 'pickup',
    name: 'The Pickup',
    giver: 'Vera Solano',
    intro: [
      'Vera: Kai, you drive like your mother taught you. Good.',
      'Vera: Pick up a package at North Market. Bring it to the Docks. No cops, no heroes.',
    ],
    steps: [
      { type: 'goto', text: 'Drive to North Market', loc: 'market', radius: 60 },
      { type: 'pickup', text: 'Pick up the package (walk to the marker)', loc: 'market', radius: 46 },
      { type: 'deliver', text: 'Deliver the package to the Docks', loc: 'docks', radius: 70 },
    ],
    reward: 300,
    outro: 'Vera: Clean. The crew is talking about you already.',
  },
  {
    id: 'hotcar',
    name: 'The Hot Car',
    giver: 'Vera Solano',
    intro: [
      'Vera: A Comet GT is parked at the Marina. Blue, fast, and not ours yet.',
      'Vera: Bring it to the garage. The owner has friends in blue, so expect company.',
    ],
    steps: [
      { type: 'goto', text: 'Go to the Marina', loc: 'marina', radius: 70 },
      { type: 'steal', text: 'Steal the blue Comet GT', loc: 'marina', radius: 60, carType: 'sport', carColor: '#2fa8e0' },
      { type: 'deliverCar', text: 'Bring the Comet GT to the garage', loc: 'garage', radius: 80 },
    ],
    reward: 500,
    outro: 'Vera: Beautiful. That car will pay for a month of rent.',
  },
  {
    id: 'ambush',
    name: 'The Ambush',
    giver: 'Vera Solano',
    intro: [
      'Vera: A buyer wants to meet at Sunset Plaza. Kovac crew, but the money is real.',
      'Vera: Take a gun. Trust no one at that plaza.',
    ],
    steps: [
      { type: 'goto', text: 'Go to Sunset Plaza', loc: 'plaza', radius: 70 },
      { type: 'kill', text: 'It was a setup! Fight off the Kovac crew', loc: 'plaza', radius: 260, enemies: 4 },
      { type: 'escape', text: 'Lose the heat and get to the garage', loc: 'garage', radius: 80 },
    ],
    reward: 700,
    outro: 'Vera: Kovac will not forget this. Neither will I.',
  },
  {
    id: 'harbor',
    name: 'The Harbor Job',
    giver: 'Vera Solano',
    intro: [
      'Vera: One big score and we are done running. The Harbor Bank vault.',
      'Vera: Get in, grab the cash, and do not stop for anyone. Not even me.',
    ],
    steps: [
      { type: 'goto', text: 'Go to Harbor Bank', loc: 'bank', radius: 70 },
      { type: 'collect', text: 'Grab the cash from the vault', loc: 'bank', radius: 56, holdTime: 3 },
      { type: 'escape', text: 'Escape the police and reach the Docks safehouse', loc: 'docks', radius: 80, wanted: 4 },
    ],
    reward: 1500,
    outro: 'Vera: We did it, Kai. Solmara is ours now.',
  },
];

// Named places on the map. The world and the minimap both read these.
export const PLACES = {
  garage: { x: 480, y: 1600, label: "Vera's Garage", color: '#58c96b' },
  bank: { x: 1120, y: 800, label: 'Harbor Bank', color: '#f2c230' },
  docks: { x: 2080, y: 1600, label: 'The Docks', color: '#e07b39' },
  marina: { x: 2320, y: 480, label: 'Marina', color: '#2fa8e0' },
  plaza: { x: 1120, y: 1120, label: 'Sunset Plaza', color: '#c96bd8' },
  market: { x: 800, y: 320, label: 'North Market', color: '#58c96b' },
  hospital: { x: 1760, y: 800, label: 'St. Mara Hospital', color: '#eef1f5' },
  strip: { x: 2080, y: 1120, label: 'The Strip', color: '#e0526b' },
};

export const PALETTE = {
  backdrop: '#0e1420',
  grass: '#5da24a',
  grassDark: '#4c8a3e',
  park: '#6db356',
  sand: '#e8d29a',
  water: '#2e7fa8',
  waterDeep: '#1f5f84',
  road: '#3a3f4a',
  roadEdge: '#2c303a',
  sidewalk: '#8a8f99',
  lane: '#e8d44d',
  crosswalk: '#dfe3e8',
  buildingRoof: ['#b0563f', '#7d8aa0', '#c98a4b', '#5f7d5a', '#8a6d9e', '#a8574e', '#6b7f8c', '#c2a35e'],
  buildingEdge: '#2a2e38',
  tree: '#3f7d33',
  treeDark: '#2f6126',
  player: '#f2c230',
  playerShirt: '#e0526b',
  pedShirt: ['#e07b39', '#2fa8e0', '#58c96b', '#c96bd8', '#e8e4da', '#7a8a99'],
  police: '#2f6fd0',
  policeCar: '#eef1f5',
  text: '#f4f6f8',
  muted: '#aab2bd',
  panel: 'rgba(12, 18, 30, 0.82)',
  panelEdge: 'rgba(255, 255, 255, 0.14)',
  star: '#ffd23f',
  starEmpty: '#5a6270',
  health: '#58c96b',
  healthLow: '#e0526b',
  marker: '#ffd23f',
  markerPulse: 'rgba(255, 210, 63, 0.35)',
  danger: '#e0526b',
  money: '#7be07b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmara.save.v1';
export const BEST_KEY = 'solmara.best.v1';

// Event flags the simulation returns from step(), so the caller can play
// sounds and announce without the world knowing about screens or sound.
export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 4;
export const EVENT_BUSTED = 8;
export const EVENT_WASTED = 16;
export const EVENT_STEP = 32;
export const EVENT_MISSION = 64;
export const EVENT_PICKUP = 128;
export const EVENT_WANTED = 256;
export const EVENT_STEAL = 512;
export const EVENT_EXPLODE = 1024;
export const EVENT_PUNCH = 2048;
export const EVENT_SIREN = 4096;
