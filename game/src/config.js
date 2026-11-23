// Tuning, places, vehicles, weapons and the ten-job story for SOLMARA.
// This file is pure data: the simulation (world.js) and the story engine
// (missions.js) read it, and the renderer (render.js) colours from it.

export const WORLD = { w: 2560, h: 1920 };

// Road centrelines. Avenues run north-south, streets east-west; the grid
// makes the whole city, and every address sits on one of these lines.
export const AVENUES = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const STREETS = [160, 480, 800, 1120, 1440, 1760];
export const ROAD_W = 64;
export const BEACH_X = 2320; // east of this line: sand, then ocean

export const DISTRICTS = [
  { id: 'harbor', name: 'Harbor', y0: 0, y1: 640 },
  { id: 'stmara', name: 'St. Mara', y0: 640, y1: 1280 },
  { id: 'docks', name: 'Docks', y0: 1280, y1: 1920 },
];

export const STANDING_NAMES = ['Unknown', 'Known', 'Respected', 'Legend'];
export const RANKS = [
  { name: 'Street', jobs: 0 },
  { name: 'Runner', jobs: 3 },
  { name: 'Wheelman', jobs: 6 },
  { name: 'King of Solmara', jobs: 10 },
];

// Named places. Every mission marker and every minimap label points here.
export const PLACES = {
  garage: { name: "Vera's Garage", x: 480, y: 480, district: 'harbor' },
  market: { name: 'Market', x: 800, y: 160, district: 'harbor' },
  pier: { name: 'Pier', x: 2400, y: 800, district: 'stmara' },
  lighthouse: { name: 'Lighthouse', x: 2440, y: 480, district: 'harbor' },
  bank: { name: 'Solmara Bank', x: 1120, y: 800, district: 'stmara' },
  hospital: { name: 'Hospital', x: 1440, y: 1440, district: 'docks' },
  marina: { name: 'Marina', x: 2080, y: 1440, district: 'docks' },
  strip: { name: 'The Strip', x: 800, y: 1120, district: 'stmara' },
  plaza: { name: 'Plaza', x: 1440, y: 800, district: 'stmara' },
  docks: { name: 'Docks', x: 480, y: 1760, district: 'docks' },
  ambush: { name: 'Ambush Alley', x: 1120, y: 1440, district: 'docks' },
  hideout: { name: 'Kovac Hideout', x: 1760, y: 1120, district: 'stmara' },
  vault: { name: 'Vault', x: 1120, y: 800, district: 'stmara' },
  home: { name: 'Safehouse', x: 480, y: 480, district: 'harbor' },
};

export const VEHICLES = {
  comet: { name: 'Comet GT', color: '#e11d48', top: 330, accel: 240, grip: 3.4, hp: 120 },
  muscle: { name: 'Muscle V8', color: '#f97316', top: 300, accel: 260, grip: 3.0, hp: 150 },
  pickup: { name: 'Pickup', color: '#65a30d', top: 270, accel: 200, grip: 2.8, hp: 170 },
  taxi: { name: 'Taxi', color: '#facc15', top: 250, accel: 190, grip: 2.9, hp: 130 },
  sedan: { name: 'Sedan', color: '#3b82f6', top: 255, accel: 185, grip: 2.9, hp: 130 },
  coupe: { name: 'Coupe', color: '#a855f7', top: 275, accel: 200, grip: 3.1, hp: 125 },
  van: { name: 'Van', color: '#94a3b8', top: 225, accel: 160, grip: 2.5, hp: 180 },
  truck: { name: 'Truck', color: '#78716c', top: 210, accel: 150, grip: 2.4, hp: 200 },
  cruiser: { name: 'Police Cruiser', color: '#0f172a', top: 310, accel: 250, grip: 3.3, hp: 160 },
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, mag: 12, range: 430, spread: 0.03, pellets: 1, unlockJobs: 0 },
  smg: { name: 'SMG', damage: 16, rate: 0.09, mag: 30, range: 370, spread: 0.07, pellets: 1, unlockJobs: 3 },
  shotgun: { name: 'Shotgun', damage: 13, rate: 0.75, mag: 6, range: 300, spread: 0.16, pellets: 5, unlockJobs: 6 },
};

export const GARAGE = {
  armor: { name: 'Armor Plating', desc: '+60 car health per level, repairs your ride', price: 800, max: 3 },
  engine: { name: 'Engine Tune', desc: '+8% top speed per level', price: 900, max: 3 },
  nitro: { name: 'Nitro Kit', desc: 'Hold X while driving for a 2s boost', price: 1200, max: 1 },
};

export const RADIO = [
  { name: 'SOL FM', tempo: 112, wave: 'sawtooth', bass: [0, 0, 7, 10] },
  { name: 'GARAGE ROCK', tempo: 140, wave: 'square', bass: [0, 3, 5, 7] },
  { name: 'DOCKS BASS', tempo: 96, wave: 'triangle', bass: [0, 0, 5, 3] },
];

// Wanted heat thresholds: heat 0-100 maps to 0-5 stars.
export const WANTED = {
  thresholds: [0, 12, 28, 48, 68, 88],
  decayPerSec: 2.2,
  quietTime: 8,
  stealHeat: 14,
  killCopHeat: 12,
  killCrewHeat: 6,
  hitPedHeat: 8,
};

// The story: ten jobs, $12,100 in all. Steps are data; the engine in
// missions.js walks them. Step types:
//   goto    reach a place (x, y, r, label)
//   pickup  reach a place and collect it (label)
//   car     get into the mission car parked at (x, y)
//   kill    eliminate count enemies spawned around (x, y)
//   race    pass checkpoints in order before the rivals or the clock
//   escape  reach a place while the heat is pinned at the given stars
//   timed   a goto with a countdown (time seconds)
export const MISSIONS = [
  {
    id: 'pickup', title: 'The Pickup', reward: 300, district: 'harbor',
    brief: 'Vera needs a package fetched from the garage and run to the Pier. No questions, no stops.',
    steps: [
      { type: 'goto', x: 480, y: 480, r: 70, label: 'Go to Vera\'s Garage' },
      { type: 'pickup', x: 480, y: 480, r: 60, label: 'Pick up the package' },
      { type: 'goto', x: 2400, y: 800, r: 80, label: 'Deliver to the Pier' },
    ],
  },
  {
    id: 'hotcar', title: 'The Hot Car', reward: 500, district: 'stmara',
    brief: 'A Comet GT is parked by the Plaza. Take it. Bring it to Vera — the PD will notice.',
    steps: [
      { type: 'goto', x: 1440, y: 800, r: 80, label: 'Find the Comet GT' },
      { type: 'car', x: 1440, y: 800, r: 60, label: 'Steal the Comet GT' },
      { type: 'goto', x: 480, y: 480, r: 80, label: 'Deliver it to Vera\'s Garage' },
    ],
  },
  {
    id: 'ambush', title: 'The Ambush', reward: 700, district: 'docks',
    brief: 'Kovac\'s boys are waiting in the alley by the Docks. Walk in ready.',
    steps: [
      { type: 'goto', x: 1120, y: 1440, r: 80, label: 'Go to Ambush Alley' },
      { type: 'kill', x: 1120, y: 1440, count: 3, label: 'Deal with the Kovac crew' },
      { type: 'goto', x: 480, y: 480, r: 80, label: 'Report back to Vera' },
    ],
  },
  {
    id: 'harborjob', title: 'The Harbor Job', reward: 1500, district: 'harbor',
    brief: 'The Bank vault, three stars, one fast car. Get in, grab the cash, get out.',
    steps: [
      { type: 'goto', x: 1120, y: 800, r: 80, label: 'Reach Solmara Bank' },
      { type: 'pickup', x: 1120, y: 800, r: 60, label: 'Grab the vault cash' },
      { type: 'escape', x: 480, y: 480, r: 80, stars: 3, label: 'Lose the heat — reach the Garage' },
    ],
  },
  {
    id: 'getaway', title: 'The Getaway', reward: 900, district: 'stmara',
    brief: 'Seventy-five seconds, one car, the whole city between you and the Docks. Drive.',
    steps: [
      { type: 'car', x: 800, y: 1120, r: 70, label: 'Get in the getaway car' },
      { type: 'timed', x: 480, y: 1760, r: 90, time: 75, label: 'Reach the Docks in 75s' },
    ],
  },
  {
    id: 'courier', title: 'The Courier Run', reward: 800, district: 'docks',
    brief: 'Three drops, one run: Market, Pier, Hospital. Then back to Vera.',
    steps: [
      { type: 'pickup', x: 800, y: 160, r: 60, label: 'Drop 1 — Market' },
      { type: 'pickup', x: 2400, y: 800, r: 60, label: 'Drop 2 — Pier' },
      { type: 'pickup', x: 1440, y: 1440, r: 60, label: 'Drop 3 — Hospital' },
      { type: 'goto', x: 480, y: 480, r: 80, label: 'Return to Vera\'s Garage' },
    ],
  },
  {
    id: 'revenge', title: "Kovac's Revenge", reward: 2000, district: 'harbor',
    brief: 'Six of Kovac\'s crew hold the Strip. End it, then tell Vera.',
    steps: [
      { type: 'goto', x: 800, y: 1120, r: 90, label: 'Go to the Strip' },
      { type: 'kill', x: 800, y: 1120, count: 6, label: 'Clear the Kovac crew' },
      { type: 'goto', x: 480, y: 480, r: 80, label: 'Report back to Vera' },
    ],
  },
  {
    id: 'sprint', title: 'The Harbor Sprint', reward: 1100, district: 'harbor',
    brief: 'Rico thinks he owns the streets. Three checkpoints, eighty seconds, two rivals. Beat them.',
    steps: [
      { type: 'goto', x: 800, y: 160, r: 90, label: 'Line up at the Market' },
      { type: 'race', time: 80, label: 'Race: Market → Pier → Strip' },
    ],
  },
  {
    id: 'airsupport', title: 'Air Support', reward: 1800, district: 'docks',
    brief: 'Five stars, a helicopter overhead, one vault. Crack it and run — the sky is watching.',
    steps: [
      { type: 'goto', x: 1120, y: 800, r: 80, label: 'Reach Solmara Bank' },
      { type: 'pickup', x: 1120, y: 800, r: 60, label: 'Crack the vault' },
      { type: 'escape', x: 480, y: 480, r: 80, stars: 5, label: 'Escape at 5 stars — reach the Garage' },
    ],
  },
  {
    id: 'gambit', title: "The King's Gambit", reward: 2500, district: 'stmara',
    brief: 'Eight crew on the Strip, then sixty seconds to get home. This is the one they\'ll remember.',
    steps: [
      { type: 'goto', x: 800, y: 1120, r: 90, label: 'Go to the Strip' },
      { type: 'kill', x: 800, y: 1120, count: 8, label: 'Take down the eight crew' },
      { type: 'timed', x: 480, y: 480, r: 90, time: 60, label: 'Get home in 60s' },
    ],
  },
];

export const RACE_CHECKPOINTS = [
  { x: 800, y: 160, name: 'Market' },
  { x: 2400, y: 800, name: 'Pier' },
  { x: 800, y: 1120, name: 'Strip' },
];

export const SAVE_KEY = 'solmara.save.v3';
