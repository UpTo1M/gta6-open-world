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
| Q | Draw / holster your gun |
| Mouse | Aim · Click — shoot · R — reload |
| F | Punch |
| P | Pause (S — save there) · M — mute |

## The game

- **A city to explore on foot and by car.** Solmara is a deterministic grid
  city (2,560 × 1,920): avenues and streets, blocks with alleys, two parks,
  a beach and ocean on the east edge, a pier, a market, a bank, a marina,
  a hospital and the Docks. A seeded RNG lays it out the same every run.
- **Traffic and pedestrians.** Cars follow the roads, turn at intersections,
  slow for the car ahead and respawn near you. Pedestrians walk the
  sidewalks and flee gunfire and fast cars.
- **Steal cars.** Walk up to a parked or traffic car, press E, and drive it
  away — stealing one puts a star on you. Six vehicle types, from vans and
  taxis to the Comet GT sports car.
- **Wanted level and police.** 0–5 stars. The PD chases you in cars that
  ram and in cops on foot who bust you after 1.4 seconds of contact, and
  shoot at 3 stars and up. The heat decays after a quiet stretch.
- **Missions and a story.** Four jobs from Vera Solano, with dialogue and
  progression: *The Pickup* ($300), *The Hot Car* ($500), *The Ambush*
  ($700) and *The Harbor Job* ($1,500). Objectives show on the HUD with a
  pulsing marker, a minimap marker and a screen-edge waypoint arrow.
  Completing a job pays out, autosaves, and opens the next.
- **Combat.** A pistol (12-round mag, reload) and fists, against the Kovac
  crew and the police. Enemies take cover and shoot back; health regens
  out of combat. Cars take damage and explode.
- **HUD with a minimap.** Health, money, wanted stars, ammo, speed and
  the current objective, plus a live minimap showing you, cars, police,
  pedestrians and the mission marker.
- **Start screen and save.** A title screen with a living city behind it,
  Continue from a save, and autosave on every completed job (localStorage,
  `solmara.save.v1`). Best fortune is kept too.
- **Polish.** A camera that zooms out with speed and shakes on impacts,
  skid marks, particles, screen shake, a hurt vignette, and WebAudio
  synthesis throughout — engine hum, sirens, gunshots, jingles and a city
  hum, all generated, no audio files.

## Files

- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.
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
