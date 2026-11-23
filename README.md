# SOLMARA

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/UpTo1M/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/UpTo1M/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun
gta6-01 bounty. You are **Kai Mercer**, a wheelman new to the fictional
sun-soaked coastal city of **Solmara**, working jobs for garage owner
**Vera Solano** while the Kovac crew and the Solmara PD close in.

Everything is original: the city, the characters, the vehicles, the story,
the art and the sound. Nothing from Rockstar Games or any other commercial
game. The whole game is plain static files under `game/` — open
`game/index.html` in a desktop browser and it plays offline, no network
request, no build step.

## How to play

Serve `game/` with any static HTTP server (the kit ships one: `node serve.ts`,
then open http://localhost:8080), or just open `game/index.html`.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move on foot · drive (W accelerate, S brake/reverse, A/D steer, Space handbrake) |
| Shift | Run |
| E | Get in / get out · steal a car |
| Q (tap) | Draw / holster your gun |
| Q (hold) | Weapon wheel — 1 pistol · 2 SMG · 3 shotgun |
| Mouse | Aim · Click — shoot · R — reload |
| F | Punch |
| X | Nitro boost (while driving, once fitted at the garage) |
| C | Cycle the radio station (while driving) |
| G | Vera's Garage — buy armor, engine, nitro (near the garage) |
| P | Pause (S — save there) · M — mute |

## The game

- **A city to explore on foot and by car.** Solmara is a deterministic grid
  city (2,560 × 1,920): avenues and streets, blocks with alleys, two parks,
  a beach and ocean on the east edge, a pier with a lighthouse, a market, a
  bank, a marina with moored boats, a hospital and the Docks. A seeded RNG
  lays it out the same every run.
- **Traffic and pedestrians.** 20 cars follow the roads, turn at
  intersections, slow for the car ahead and respawn near you. 34 pedestrians
  walk the sidewalks and flee gunfire and fast cars.
- **Steal cars.** Walk up to a parked or traffic car, press E, and drive it
  away — stealing one puts a star on you. Eight vehicle types, from vans and
  taxis to the Comet GT sports car, the Muscle V8 and a pickup truck.
- **Wanted level and police.** 0–5 stars. The PD chases you in cars that
  ram and in cops on foot who bust you after 1.4 seconds of contact, and
  shoot at 3 stars and up. The heat decays after a quiet stretch, and the
  screen edges throb red while the heat is high.
- **Missions and a story.** Ten jobs from Vera Solano, with dialogue and
  progression: *The Pickup* ($300), *The Hot Car* ($500), *The Ambush*
  ($700), *The Harbor Job* ($1,500), *The Getaway* ($900, a 75-second timed
  run), *The Courier Run* ($800, three drops in one run), *Kovac's
  Revenge* ($2,000, a six-strong finale), *The Harbor Sprint* ($1,100 — a
  street race against Rico through three checkpoints), *Air Support*
  ($1,800 — crack the vault at five stars under a police helicopter) and
  *The King's Gambit* ($2,500 — eight crew at the Strip, then a 60-second
  run home). $12,100 in all. Every job opens with a briefing card and
  closes with a payout card. Objectives show on the HUD with a step
  counter, a live distance, a pulsing marker, a minimap marker and a
  screen-edge waypoint arrow. Completing a job pays out, autosaves, and
  opens the next.
- **Street races.** *The Harbor Sprint* puts two rival racers on the road
  with you — Rico in a red Comet GT and a second driver in a Muscle V8 —
  chasing the same three checkpoints (Market, Pier, Strip) against an
  80-second clock. If a rival finishes first, the job restarts.
- **Districts and standing.** Solmara is three districts — the Harbor
  (north), St. Mara (middle), the Docks (south), named on the ground and the
  minimap. Finishing work in a district raises your standing there
  (Unknown → Known → Respected → Legend); the HUD shows where you stand.
- **Police escalation.** At 3 stars the PD seals the streets with
  roadblocks — parked cruisers on the roads near you. At 4–5 stars a police
  helicopter joins, hovering overhead with a searchlight, and while it is
  above you the heat never cools.
- **Weapon wheel.** Hold Q for a radial picker: pistol (12 rounds, heavy),
  SMG (30 rounds, fast, unlocks at Runner rank) and shotgun (6 shells, five
  pellets, unlocks at Wheelman rank). Pick with 1 / 2 / 3.
- **Respect ranks.** Street → Runner (3 jobs) → Wheelman (6 jobs) →
  King of Solmara (10 jobs), from jobs done. The rank shows on the HUD and
  gates the weapon wheel.
- **Radio.** Three switchable synth stations while driving (C to cycle):
  SOL FM, GARAGE ROCK and DOCKS BASS, all WebAudio, no audio files.
- **Vera's Garage.** Spend earned $ near the garage (G): Armor Plating
  (+60 car health per level, repairs your ride), Engine Tune (+8% top speed
  per level) and a Nitro Kit (hold X while driving for a two-second boost).
- **Combat.** A pistol (12-round mag, reload) and fists, against the Kovac
  crew and the police. Enemies take cover and shoot back; health regens
  out of combat. Cars take damage and explode. Hits flash white on whoever
  takes them.
- **HUD with a minimap.** Health, money, wanted stars, weapon and ammo,
  district standing and respect rank, speed, the radio station, the current
  objective with its step and distance, a countdown on timed runs and races,
  plus a live minimap showing you, cars, police, the helicopter, rival
  racers, pedestrians, named places, district labels and the mission marker.
- **Start screen and save.** A title screen with a living city behind it, a
  job board showing every mission's state, Continue from a save, and
  autosave on every completed job (localStorage, `solmara.save.v3` — v2
  saves cannot load into v3). Best fortune is kept too.
- **Polish.** A camera that zooms out with speed and shakes on impacts,
  skid marks, particles, pickup sparkles, screen shake, a hurt vignette,
  and WebAudio synthesis throughout — engine hum, sirens, gunshots,
  jingles and a city hum, all generated, no audio files.

## What changed in v3

- Three new jobs: the street race *The Harbor Sprint* (Rico and a second
  rival, three checkpoints, 80 seconds), the five-star vault job *Air
  Support* (a police helicopter overhead on the escape), and the eight-enemy
  finale *The King's Gambit* (ten jobs, $12,100 in all).
- Street races with rival AI cars that drive the checkpoint route; a rival
  finishing first restarts the job.
- Three districts (Harbor, St. Mara, the Docks) with standing that rises as
  you finish work there, shown on the HUD and the minimap.
- Police escalation: roadblocks at 3 stars, a helicopter with a searchlight
  at 4–5 stars that pins the heat while it is overhead.
- Weapon wheel (hold Q, pick 1 / 2 / 3): pistol, SMG (Runner rank), shotgun
  (Wheelman rank), each with its own damage, rate, range and ammo.
- Respect ranks (Street → Runner → Wheelman → King of Solmara), three radio
  stations (SOL FM, GARAGE ROCK, DOCKS BASS — C to cycle while driving),
  and Vera's Garage (G near the garage): armor, engine tune, nitro on X.
- Save format grew (upgrades, standing, weapon, earnings) — the save key is
  now `solmara.save.v3`.
- Fixed: the minimap mission marker crashed the frame on race steps (no
  single place to point at); it now points at the next checkpoint. Fixed:
  the nitro boost was clamped away by the driving model every frame; the
  boost now raises the top speed while it burns.

## What changed in v2

- Three new jobs: the timed Getaway, the multi-drop Courier Run, and the
  six-enemy finale Kovac's Revenge (seven jobs, $6,700 in all).
- Mission briefing and payout cards, a live objective tracker (step, distance,
  countdown), hit flashes, pickup sparkles, a wanted vignette, a job board
  on the title screen, and named places on the minimap.
- Two new vehicles (Muscle V8, Pickup), more traffic (20 cars) and more
  pedestrians (34), a plaza fountain, a lighthouse with a sweeping beam,
  moored boats and beach palms.
- Fixed: the mission Comet GT, a parked van and the garage ammo pickup used
  to spawn inside buildings where they could not be reached; they now sit
  on roads. Busted mid-job no longer leaves the old crew standing next to
  a fresh one. Loading a save resumes the job at its saved step. Cops who
  lose you walk off instead of standing around. If the Comet GT is wrecked
  before its job is done, Vera sends another one.
- `serve.ts` is now in the repo: `node serve.ts`, then open
  http://localhost:8080.

## Files

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.
- `serve.ts` — a tiny static server for local play (`node serve.ts`).
- `game/index.html` — the page; `game/src/` holds the game in one module
  per job: `config.js` (tuning, places, missions), `random.js` (seeded RNG),
  `city.js` (the map), `world.js` (simulation), `missions.js` (the story
  engine), `render.js` (drawing, HUD, minimap), `input.js`, `audio.js`,
  `shots.js` (the screenshot scenes), `main.js` (boot and loop).
- `screenshots/` — four real renders of the game's own code
  (`?shot=drive|start|chase|mission&seed=1`).
- `shots.json` — the scene list those screenshots come from.
- `LICENSE` — MIT.

## License

MIT — see `LICENSE`.
