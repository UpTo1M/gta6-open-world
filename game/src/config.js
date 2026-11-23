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

// The weapon wheel: hold Q, pick with 1/2/3. The pistol is yours from the
// start; the SMG unlocks at Runner rank (3 jobs done) and the shotgun at
// Wheelman (6 jobs done). Damage is per pellet; the shotgun fires five.
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.16, mag: 12, range: 340, pellets: 1, spread: 0, unlockJobs: 0 },
  smg: { name: 'SMG', damage: 16, rate: 0.07, mag: 30, range: 300, pellets: 1, spread: 0.05, unlockJobs: 3 },
  shotgun: { name: 'Shotgun', damage: 13, rate: 0.85, mag: 6, range: 240, pellets: 5, spread: 0.16, unlockJobs: 6 },
};
export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun'];

// Three districts split the city by latitude: the north side is the Harbor,
// the middle band is St. Mara, the south strip is the Docks. Standing in a
// district rises when you finish work there.
export const DISTRICTS = {
  harbor: { name: 'Harbor', label: 'HARBOR' },
  mara: { name: 'St. Mara', label: 'ST. MARA' },
  docks: { name: 'The Docks', label: 'THE DOCKS' },
};
export const STANDING_LEVELS = [
  { min: 0, name: 'Unknown' },
  { min: 1, name: 'Known' },
  { min: 3, name: 'Respected' },
  { min: 6, name: 'Legend' },
];

// Respect ranks: your name in Solmara, from jobs done. The rank gates the
// weapon wheel and shows on the title screen and the HUD.
export const RESPECT_RANKS = [
  { jobs: 0, name: 'Street' },
  { jobs: 3, name: 'Runner' },
  { jobs: 6, name: 'Wheelman' },
  { jobs: 10, name: 'King of Solmara' },
];

// Vera's Garage: spend earned $ on the car you drive. Armor adds max health
// and repairs your ride; engine adds top speed; nitro is a boost on X.
export const GARAGE_UPGRADES = {
  armor: { name: 'Armor Plating', desc: '+60 car health, repairs your ride', price: [400, 700, 1000], max: 3 },
  engine: { name: 'Engine Tune', desc: '+8% top speed per level', price: [600, 900, 1300], max: 3 },
  nitro: { name: 'Nitro Kit', desc: 'Hold X while driving for a boost', price: [500], max: 1 },
};

// Radio: three switchable WebAudio synth stations (C to cycle, while driving).
export const RADIO_STATIONS = [
  { name: 'SOL FM', bpm: 100, bass: [55, 0, 65.41, 0, 49, 0, 58.27, 0], lead: [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 196], wave: 'sine' },
  { name: 'GARAGE ROCK', bpm: 132, bass: [82.41, 82.41, 98, 110, 82.41, 82.41, 123.47, 110], lead: [164.81, 196, 246.94, 196, 164.81, 146.83, 164.81, 220], wave: 'square' },
  { name: 'DOCKS BASS', bpm: 90, bass: [41.2, 0, 41.2, 49, 41.2, 0, 55, 49], lead: [110, 0, 130.81, 0, 98, 0, 110, 0], wave: 'sawtooth' },
];

export const CAR_TYPES = {
  sedan: { maxSpeed: 400, accel: 380, color: '#c94f42', name: 'Sedan' },
  taxi: { maxSpeed: 390, accel: 370, color: '#f2c230', name: 'Taxi' },
  sport: { maxSpeed: 520, accel: 520, color: '#2fa8e0', name: 'Comet GT' },
  truck: { maxSpeed: 330, accel: 300, color: '#7a8a99', name: 'Truck' },
  van: { maxSpeed: 360, accel: 330, color: '#e8e4da', name: 'Van' },
  police: { maxSpeed: 470, accel: 470, color: '#eef1f5', name: 'Interceptor' },
  muscle: { maxSpeed: 470, accel: 460, color: '#8a3b2e', name: 'Muscle V8' },
  pickup: { maxSpeed: 380, accel: 360, color: '#5f7d5a', name: 'Pickup' },
};

export const TRAFFIC = { count: 20, speed: 150, speedJitter: 40, spawnGap: 90 };
export const PEDS = { count: 34, walkSpeed: 55, runSpeed: 150 };
export const POLICE = {
  maxOnFoot: 4,
  maxCars: 5,
  bustTime: 1.4,
  shootAtStars: 3,
  roadblockStars: 3, // parked cruisers block the roads at 3 stars and up
  heliStars: 4, // the air unit joins at 4 stars and pins the heat on you
  heliSpeed: 215,
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

// The story: seven jobs from Vera Solano, who runs the garage on the south side.
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
  {
    id: 'getaway',
    name: 'The Getaway',
    giver: 'Vera Solano',
    intro: [
      'Vera: A buyer at the Strip has cash, but the deal dies in 75 seconds.',
      'Vera: Grab the package and RUN it to the Docks. Fast car, faster feet.',
    ],
    steps: [
      { type: 'goto', text: 'Go to the Strip', loc: 'strip', radius: 70 },
      { type: 'pickup', text: 'Grab the package at the Strip', loc: 'strip', radius: 46 },
      { type: 'timed', text: 'Race the package to the Docks — beat the clock!', loc: 'docks', radius: 70, timeLimit: 75 },
    ],
    reward: 900,
    outro: 'Vera: Seventy-five seconds and not a scratch. You are the fastest wheelman in Solmara.',
    fail: 'Vera: Too slow. The buyer walked. We go again — faster this time.',
  },
  {
    id: 'courier',
    name: 'The Courier Run',
    giver: 'Vera Solano',
    intro: [
      'Vera: Three drops, one run: the Market, the Plaza, the Strip.',
      'Vera: Collect them all, then bring everything home to the garage.',
    ],
    steps: [
      { type: 'pickup', text: 'Pick up drop 1 at North Market', loc: 'market', radius: 46 },
      { type: 'pickup', text: 'Pick up drop 2 at Sunset Plaza', loc: 'plaza', radius: 46 },
      { type: 'pickup', text: 'Pick up drop 3 at the Strip', loc: 'strip', radius: 46 },
      { type: 'deliver', text: 'Bring all three drops to the garage', loc: 'garage', radius: 80 },
    ],
    reward: 800,
    outro: 'Vera: Three drops, one driver, zero mistakes. The city runs on you now.',
  },
  {
    id: 'revenge',
    name: "Kovac's Revenge",
    giver: 'Vera Solano',
    intro: [
      'Vera: Kovac sent his whole crew to the Docks to finish us. They picked the wrong night.',
      'Vera: End it, Kai. All of them. Then come home.',
    ],
    steps: [
      { type: 'goto', text: 'Go to the Docks', loc: 'docks', radius: 80 },
      { type: 'kill', text: 'Take down the Kovac crew — all six of them', loc: 'docks', radius: 300, enemies: 6, wanted: 2 },
      { type: 'escape', text: 'Escape the heat and reach the garage', loc: 'garage', radius: 80 },
    ],
    reward: 2000,
    outro: 'Vera: Kovac is finished in this city. You are a legend, Kai.',
  },
  {
    id: 'streetrace',
    name: 'The Harbor Sprint',
    giver: 'Vera Solano',
    intro: [
      'Vera: Rico the Racer runs the north side. He says nobody beats him through the Harbor.',
      'Vera: Prove him wrong. Three checkpoints, one clock — beat Rico to the line.',
    ],
    steps: [
      { type: 'goto', text: 'Meet Rico at the Marina', loc: 'marina', radius: 70 },
      { type: 'race', text: 'Race Rico: Market, Pier, Strip — beat the clock!', checkpoints: ['market', 'pier', 'strip'], timeLimit: 80, rivals: 2 },
      { type: 'deliver', text: 'Bring the win home to the garage', loc: 'garage', radius: 80 },
    ],
    reward: 1100,
    outro: 'Vera: Rico is eating your dust. The Harbor is ours now.',
    fail: 'Vera: Rico beat you to the line. Again — and this time, floor it.',
    failRival: 'Vera: Rico beat you to the line. Again — and this time, floor it.',
  },
  {
    id: 'airsupport',
    name: 'Air Support',
    giver: 'Vera Solano',
    intro: [
      'Vera: The Harbor Bank vault, again — bigger this time. Five stars the moment you touch it.',
      'Vera: The eye in the sky will be on you. Lose the chopper and reach the Docks.',
    ],
    steps: [
      { type: 'goto', text: 'Go to Harbor Bank', loc: 'bank', radius: 70 },
      { type: 'collect', text: 'Crack the vault and grab the cash', loc: 'bank', radius: 56, holdTime: 3 },
      { type: 'escape', text: 'Five stars and a chopper above you — reach the Docks', loc: 'docks', radius: 80, wanted: 5 },
    ],
    reward: 1800,
    outro: 'Vera: Five stars, a helicopter, and you still walked away with the vault. Unbelievable.',
  },
  {
    id: 'gambit',
    name: "The King's Gambit",
    giver: 'Vera Solano',
    intro: [
      'Vera: What is left of the Kovac crew holds the Strip. End them, then outrun the whole city home.',
      'Vera: Eight of them. One clock. Sixty seconds to the garage.',
    ],
    steps: [
      { type: 'goto', text: 'Go to the Strip', loc: 'strip', radius: 80 },
      { type: 'kill', text: "Take down Kovac's last crew — all eight", loc: 'strip', radius: 300, enemies: 8, wanted: 2 },
      { type: 'timed', text: 'Outrun the city — 60 seconds to the garage!', loc: 'garage', radius: 80, timeLimit: 60 },
    ],
    reward: 2500,
    outro: 'Vera: That is the whole crew, Kai. The city has one king now — you.',
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
  pier: { x: 2320, y: 420, label: 'The Pier', color: '#2fa8e0' },
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

export const SAVE_KEY = 'solmara.save.v3';
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
export const EVENT_FAIL = 8192; // a mission failed (e.g. the timed run ran out)
