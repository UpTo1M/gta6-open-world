// SOLMARA v3 — a make.fun gta6-01 entry (Node 22, standard library only).
//
// v3 adds the missing top-entry beats to the v2 game: street races against
// rival cars, three districts with standing, police roadblocks and a
// helicopter at high wanted levels, a weapon wheel (pistol / SMG / shotgun),
// respect ranks, three radio stations, garage upgrades, and three new story
// jobs — ten jobs in all.
//
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline. game/index.html opens it, and every file it loads
// sits under game/ (ES modules, no library, no network request). This program
// hands the entry in: it copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library (vendor/makefun-game.ts, the kit's copy,
// unchanged). Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in
// for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the game itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Refuse to hand in a broken entry: the game must have its page, and the
// screenshots must be 3 or 4 real renders of it, or the judge sees nothing.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing — nothing to hand in');
}
// The scorer caps game/index.html at 1 MiB; a page past it is refused.
if (statSync(join(here, 'game', 'index.html')).size > 1048576) {
  throw new Error('game/index.html is over the 1 MiB cap — nothing to hand in');
}
const shotNames = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((n) => !n.startsWith('.'))
  : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotNames.length}`);
}
// The scorer refuses any screenshot over 256 KiB; catch one here, with its
// name, instead of handing in an entry the scorer would refuse outright.
for (const name of shotNames) {
  const size = statSync(join(here, 'screenshots', name)).size;
  if (size > 262144) {
    throw new Error(`screenshots/${name} is ${size} bytes — over the 256 KiB cap, re-render it smaller`);
  }
}
// The screenshots must be the ones shots.json lists: a stale or renamed
// render would hand the judge a frame that does not match the scene list.
if (existsSync(join(here, 'shots.json'))) {
  const listed = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8')).map((s) => s.name).sort();
  const found = [...shotNames].sort();
  if (JSON.stringify(listed) !== JSON.stringify(found)) {
    throw new Error(`screenshots/ (${found.join(', ')}) does not match shots.json (${listed.join(', ')})`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
