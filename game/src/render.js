// All drawing for SOLMARA: the city, the cars, the people, the HUD, the
// minimap and every screen (title, cards, weapon wheel, garage, pause).
// Canvas 2D only, no assets — every shape is drawn from the world state.

import { WORLD, AVENUES, STREETS, ROAD_W, BEACH_X, PLACES, VEHICLES, WEAPONS, GARAGE, RANKS, MISSIONS } from './config.js';
import { districtAt } from './city.js';
import { currentMission, missionObjective } from './missions.js';
import { starsOf, rankOf, standingName, playerCar, playerPos } from './world.js';
import { clamp, dist } from './random.js';

const GROUND = '#79a75b';
const ROAD = '#3f3f46';
const ROAD_LINE = '#d6d3d1';
const SAND = '#e9d8a6';
const OCEAN = '#0284c7';
const OCEAN_DEEP = '#075985';

function drawCarShape(ctx, x, y, angle, color, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = kind === 'truck' || kind === 'van' ? 34 : 30;
  const wid = kind === 'truck' || kind === 'van' ? 17 : 14;
  ctx.fillStyle = '#111827';
  ctx.fillRect(-len / 2 - 2, -wid / 2 - 2, len + 4, wid + 4);
  ctx.fillStyle = color;
  ctx.fillRect(-len / 2, -wid / 2, len, wid);
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(-len / 2 + 7, -wid / 2 + 2, 8, wid - 4);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 2, 3);
  ctx.fillRect(len / 2 - 3, wid / 2 - 5, 2, 3);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-len / 2, -wid / 2 + 2, 2, 3);
  ctx.fillRect(-len / 2, wid / 2 - 5, 2, 3);
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, flash) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = flash > 0 ? '#ffffff' : color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash > 0 ? '#ffffff' : '#111827';
  ctx.beginPath();
  ctx.arc(Math.cos(0) * 4, Math.sin(0) * 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function starRow(ctx, x, y, stars, size = 16) {
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#fbbf24' : '#52525b';
    ctx.fillText('★', x + i * (size + 2), y);
  }
}

function drawCity(ctx, w, view) {
  const { city } = w;
  const { camX, camY, zoom } = view;
  ctx.save();
  ctx.translate(-camX * zoom, -camY * zoom);
  ctx.scale(zoom, zoom);

  // Ground.
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  // Ocean and beach on the east edge.
  ctx.fillStyle = OCEAN_DEEP;
  ctx.fillRect(2440, 0, WORLD.w - 2440, WORLD.h);
  ctx.fillStyle = OCEAN;
  ctx.fillRect(2400, 0, 40, WORLD.h);
  ctx.fillStyle = SAND;
  ctx.fillRect(BEACH_X, 0, 2400 - BEACH_X, WORLD.h);
  // Parks and plaza.
  for (const p of city.parks) {
    ctx.fillStyle = '#4d7c0f';
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(city.plaza.x - city.plaza.w / 2, city.plaza.y - city.plaza.h / 2, city.plaza.w, city.plaza.h);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(city.plaza.x, city.plaza.y, 22, 0, Math.PI * 2);
  ctx.fill();

  // Roads.
  ctx.fillStyle = ROAD;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const sy of STREETS) ctx.fillRect(0, sy - ROAD_W / 2, WORLD.w, ROAD_W);
  // Centre dashes.
  ctx.strokeStyle = ROAD_LINE;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const ax of AVENUES) { ctx.moveTo(ax, 0); ctx.lineTo(ax, WORLD.h); }
  for (const sy of STREETS) { ctx.moveTo(0, sy); ctx.lineTo(WORLD.w, sy); }
  ctx.stroke();
  ctx.setLineDash([]);

  // Pier and lighthouse.
  ctx.fillStyle = '#92400e';
  ctx.fillRect(city.pier.x - city.pier.w / 2, city.pier.y - city.pier.h / 2, city.pier.w, city.pier.h);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(city.lighthouse.x, city.lighthouse.y, city.lighthouse.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(city.lighthouse.x, city.lighthouse.y, 10, 0, Math.PI * 2);
  ctx.fill();
  // Sweeping beam.
  const beamA = w.time * 0.6;
  ctx.save();
  ctx.translate(city.lighthouse.x, city.lighthouse.y);
  ctx.rotate(beamA);
  const grad = ctx.createLinearGradient(0, 0, 260, 0);
  grad.addColorStop(0, 'rgba(254, 249, 195, 0.5)');
  grad.addColorStop(1, 'rgba(254, 249, 195, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(260, -18);
  ctx.lineTo(260, 18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Boats and palms.
  for (const b of city.boats) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-16, -6, 32, 12);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-16, -6, 32, 4);
    ctx.restore();
  }
  for (const p of city.palms) {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 10);
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings with roof colour and a darker edge.
  for (const b of city.buildings) {
    ctx.fillStyle = '#292524';
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x, b.y, b.w, 6);
  }

  // District labels on the ground.
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('HARBOR', 1160, 320);
  ctx.fillText('ST. MARA', 1160, 960);
  ctx.fillText('DOCKS', 1160, 1600);
  // Place labels.
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    if (key === 'vault' || key === 'home' || key === 'hideout') continue;
    ctx.fillText(p.name.toUpperCase(), p.x, p.y - 26);
  }
  ctx.restore();
}

function drawWorldEntities(ctx, w, view) {
  const { camX, camY, zoom } = view;
  ctx.save();
  ctx.translate(-camX * zoom, -camY * zoom);
  ctx.scale(zoom, zoom);

  // Pickups.
  for (const pk of w.pickups) {
    const bob = Math.sin(pk.t * 3) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'health' ? '#22c55e' : pk.kind === 'ammo' ? '#f59e0b' : '#84cc16';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', 0, 1);
    ctx.restore();
  }

  // Skid particles and sparks.
  for (const pt of w.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Cars (traffic, parked, police, mission, racers' rides are racers).
  for (const car of w.cars) {
    if (car.dead) continue;
    const def = VEHICLES[car.type] || VEHICLES.sedan;
    drawCarShape(ctx, car.x, car.y, car.angle, car.flash > 0 ? '#ffffff' : def.color, car.type);
    if (car.driver === 'police') {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -7, 8, 3);
      ctx.fillRect(-4, 4, 8, 3);
      ctx.restore();
    }
    car.flash = Math.max(0, (car.flash || 0) - 0.016);
  }

  // Racers.
  for (const r of w.racers) {
    drawCarShape(ctx, r.x, r.y, r.angle, r.color, r.type);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, r.x, r.y - 24);
  }

  // Pedestrians.
  for (const ped of w.peds) {
    if (ped.down > 0) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(1.2);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(-9, -4, 18, 8);
      ctx.restore();
      continue;
    }
    drawPerson(ctx, ped.x, ped.y, ped.angle, '#fbbf24', 0);
  }

  // Enemies (Kovac crew).
  for (const e of w.enemies) {
    if (e.hp <= 0) continue;
    drawPerson(ctx, e.x, e.y, e.angle, '#dc2626', e.flash);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(e.x - 12, e.y - 20, 24, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(e.x - 12, e.y - 20, 24 * clamp(e.hp / 100, 0, 1), 4);
  }

  // Foot cops.
  for (const c of w.cops) {
    if (c.hp <= 0) continue;
    drawPerson(ctx, c.x, c.y, c.angle, '#1e3a8a', c.flash);
    if (c.bustT > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUSTING…', c.x, c.y - 22);
    }
  }

  // The player.
  const p = w.player;
  if (p.onFoot) {
    drawPerson(ctx, p.x, p.y, p.drawn ? p.aimAngle : p.angle, '#14b8a6', p.hurtFlash);
    if (p.drawn) {
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.aimAngle) * 10, p.y + Math.sin(p.aimAngle) * 10);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 26, p.y + Math.sin(p.aimAngle) * 26);
      ctx.stroke();
    }
  }

  // Bullets.
  ctx.fillStyle = '#fde047';
  for (const b of w.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Helicopter and its searchlight.
  if (w.heli) {
    const h = w.heli;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.fillStyle = 'rgba(254, 249, 195, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const sa = h.searchA;
    ctx.lineTo(Math.cos(sa - 0.22) * 190, Math.sin(sa - 0.22) * 190);
    ctx.lineTo(Math.cos(sa + 0.22) * 190, Math.sin(sa + 0.22) * 190);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Mission marker: pulsing ring + bouncing chevron.
  const marker = missionMarker(w);
  if (marker) {
    const pulse = 1 + Math.sin(w.time * 5) * 0.15;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(0, -44 - Math.sin(w.time * 5) * 6);
    ctx.lineTo(-10, -28 - Math.sin(w.time * 5) * 6);
    ctx.lineTo(10, -28 - Math.sin(w.time * 5) * 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export function missionMarker(w) {
  const def = currentMission(w.mission);
  if (!def || w.mission.done) return null;
  const step = def.steps[w.mission.step];
  if (!step) return null;
  if (step.type === 'race') {
    if (w.race) {
      const cp = w.race.checkpoints[w.race.playerCp];
      if (cp) return { x: cp.x, y: cp.y };
    }
    return { x: 800, y: 160 };
  }
  if (step.x !== undefined) return { x: step.x, y: step.y };
  return null;
}

function drawMinimap(ctx, w, x, y, size) {
  const scale = size / WORLD.w;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
  ctx.fillRect(0, 0, size, size * (WORLD.h / WORLD.w));
  const h = size * (WORLD.h / WORLD.w);
  ctx.fillStyle = '#79a75b';
  ctx.fillRect(2, 2, size - 4, h - 4);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(2 + 2400 * scale, 2, size - 2 - 2400 * scale, h - 4);
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 2;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(ax * scale, 0);
    ctx.lineTo(ax * scale, h);
    ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath();
    ctx.moveTo(0, sy * scale);
    ctx.lineTo(size, sy * scale);
    ctx.stroke();
  }
  // District labels.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HARBOR', size / 2, 320 * scale);
  ctx.fillText('ST. MARA', size / 2, 960 * scale);
  ctx.fillText('DOCKS', size / 2, 1600 * scale);
  // Cars, cops, player, marker.
  const dot = (px, py, color, r = 2) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px * scale, py * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of w.cars) {
    if (!car.dead) dot(car.x, car.y, car.driver === 'police' ? '#60a5fa' : '#e5e7eb', 2);
  }
  for (const r of w.racers) dot(r.x, r.y, '#f97316', 2.5);
  for (const e of w.enemies) if (e.hp > 0) dot(e.x, e.y, '#ef4444', 2);
  if (w.heli) dot(w.heli.x, w.heli.y, '#fbbf24', 3);
  const marker = missionMarker(w);
  if (marker) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(marker.x * scale, marker.y * scale, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  const pp = playerPos(w);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(pp.x * scale, pp.y * scale, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pp.x * scale, pp.y * scale, 3.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHUD(ctx, w, view) {
  const p = w.player;
  const s = starsOf(w);
  const W = view.width;
  const H = view.height;
  ctx.save();
  // Top-left: health, money, stars.
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.fillRect(12, 12, 240, 92);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${p.money}`, 24, 30);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(24, 48, 150, 12);
  ctx.fillStyle = p.health > 30 ? '#22c55e' : '#ef4444';
  ctx.fillRect(24, 48, 150 * clamp(p.health / 100, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${Math.ceil(p.health)} HP`, 182, 54);
  starRow(ctx, 24, 84, s, 17);

  // Top-right: minimap.
  drawMinimap(ctx, w, W - 192, 12, 180);

  // Top-centre: district + rank.
  const pp = playerPos(w);
  const district = districtAt(pp.x, pp.y);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.fillRect(W / 2 - 130, 12, 260, 44);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${district === 'harbor' ? 'Harbor' : district === 'stmara' ? 'St. Mara' : 'Docks'} — ${standingName(p.standing[district])}`, W / 2, 28);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`${rankOf(p.jobsDone)} · ${p.jobsDone}/10 jobs`, W / 2, 46);

  // Bottom-left: weapon, ammo, speed, radio.
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.fillRect(12, H - 76, 250, 64);
  const def = WEAPONS[p.weapon];
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${def.name}  ${p.ammo[p.weapon]}/${def.mag}`, 24, H - 56);
  const car = playerCar(w);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#d1d5db';
  if (car) {
    const mph = Math.round(Math.abs(car.speed) * 0.36);
    ctx.fillText(`${VEHICLES[car.type].name} · ${mph} mph`, 24, H - 36);
    ctx.fillText(`Radio: ${['SOL FM', 'GARAGE ROCK', 'DOCKS BASS'][p.radio]} (C)`, 24, H - 20);
  } else {
    ctx.fillText(p.drawn ? 'Weapon drawn — click to shoot' : 'On foot — Q to draw weapon', 24, H - 36);
    ctx.fillText('E near a car to steal it', 24, H - 20);
  }

  // Objective tracker, bottom-centre.
  const obj = missionObjective(w);
  if (obj) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
    const tw = ctx.measureText(obj).width + 120;
    ctx.fillRect(W / 2 - tw / 2, H - 52, tw, 36);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    let line = obj;
    const marker = missionMarker(w);
    if (marker && !w.race) {
      const d = Math.round(dist(pp.x, pp.y, marker.x, marker.y));
      line = `${obj} · ${d}m`;
    }
    ctx.fillText(line, W / 2, H - 34);
  }

  // Toast.
  if (w.ui.toast) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(w.ui.toast).width + 32;
    ctx.fillRect(W / 2 - tw / 2, 70, tw, 32);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(w.ui.toast, W / 2, 86);
  }

  // Wanted vignette at 3+ stars.
  if (s >= 3) {
    const pulse = 0.10 + Math.sin(w.time * 4) * 0.05;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(220,38,38,0)');
    g.addColorStop(1, `rgba(220,38,38,${pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Hurt vignette.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(220,38,38,${p.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawWheel(ctx, w, view) {
  const W = view.width;
  const H = view.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = 120;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText('WEAPON WHEEL — hold Q, press 1 / 2 / 3', cx, cy - R - 30);
  const slots = [
    { key: '1', name: 'pistol', angle: -Math.PI / 2 },
    { key: '2', name: 'smg', angle: Math.PI / 6 },
    { key: '3', name: 'shotgun', angle: (5 * Math.PI) / 6 },
  ];
  for (const slot of slots) {
    const def = WEAPONS[slot.name];
    const locked = w.player.jobsDone < def.unlockJobs;
    const x = cx + Math.cos(slot.angle) * R * 0.62;
    const y = cy + Math.sin(slot.angle) * R * 0.62;
    ctx.beginPath();
    ctx.arc(x, y, 52, 0, Math.PI * 2);
    ctx.fillStyle = locked ? 'rgba(82, 82, 91, 0.9)' : w.player.weapon === slot.name ? '#0d9488' : 'rgba(39, 39, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(def.name, x, y - 6);
    ctx.font = '12px sans-serif';
    ctx.fillText(locked ? `Needs ${def.unlockJobs === 3 ? 'Runner' : 'Wheelman'}` : `${def.damage} dmg · ${def.mag} rds`, x, y + 12);
    ctx.fillText(`[${slot.key}]`, x, y + 30);
  }
  ctx.restore();
}

function drawShop(ctx, w, view) {
  const W = view.width;
  const H = view.height;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, 0, W, H);
  const bw = 460;
  const bh = 300;
  const bx = W / 2 - bw / 2;
  const by = H / 2 - bh / 2;
  ctx.fillStyle = '#111827';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("VERA'S GARAGE", W / 2, by + 36);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`Your money: $${w.player.money}`, W / 2, by + 62);
  const items = [
    { key: 'armor', label: '1', level: w.player.upgrades.armor },
    { key: 'engine', label: '2', level: w.player.upgrades.engine },
    { key: 'nitro', label: '3', level: w.player.upgrades.nitro },
  ];
  items.forEach((item, i) => {
    const def = GARAGE[item.key];
    const y = by + 100 + i * 62;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`[${item.label}] ${def.name}  Lv ${item.level}/${def.max}`, bx + 24, y);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText(def.desc, bx + 24, y + 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = item.level >= def.max ? '#6b7280' : w.player.money >= def.price ? '#22c55e' : '#ef4444';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(item.level >= def.max ? 'MAXED' : `$${def.price}`, bx + bw - 24, y);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px sans-serif';
  ctx.fillText('Press 1 / 2 / 3 to buy · G to close', W / 2, by + bh - 18);
  ctx.restore();
}

function drawCard(ctx, w, view) {
  const card = w.ui.card;
  if (!card) return;
  const W = view.width;
  const H = view.height;
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
  ctx.fillRect(0, 0, W, H);
  const bw = 520;
  const bh = 220;
  const bx = W / 2 - bw / 2;
  const by = H / 2 - bh / 2;
  ctx.fillStyle = card.kind === 'fail' ? '#7f1d1d' : '#111827';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = card.kind === 'fail' ? '#ef4444' : '#fbbf24';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(card.title, W / 2, by + 44);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#e5e7eb';
  wrapText(ctx, card.text, W / 2, by + 78, bw - 48, 22);
  if (card.reward) {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`+$${card.reward}`, W / 2, by + bh - 52);
  }
  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px sans-serif';
  ctx.fillText('ENTER to continue', W / 2, by + bh - 24);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawTitle(ctx, w, view) {
  const W = view.width;
  const H = view.height;
  ctx.save();
  // The living city behind the title.
  drawCity(ctx, w, { camX: 900, camY: 500, zoom: 0.55 });
  ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMARA', W / 2, H * 0.24);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime game', W / 2, H * 0.24 + 36);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#d1d5db';
  ctx.fillText('Kai Mercer · Vera Solano · Dmitri Kovac', W / 2, H * 0.24 + 62);

  // Job board.
  const bw = 560;
  const bx = W / 2 - bw / 2;
  const by = H * 0.36;
  ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
  ctx.fillRect(bx, by, bw, 330);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, 330);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('JOB BOARD', W / 2, by + 28);
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  MISSIONS.forEach((m, i) => {
    const y = by + 56 + i * 26;
    const state = i < w.mission.index ? '✓' : i === w.mission.index ? '▶' : '·';
    ctx.fillStyle = i < w.mission.index ? '#22c55e' : i === w.mission.index ? '#fbbf24' : '#9ca3af';
    ctx.fillText(`${state}  ${m.title}`, bx + 24, y);
    ctx.textAlign = 'right';
    ctx.fillText(`$${m.reward}`, bx + bw - 24, y);
    ctx.textAlign = 'left';
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('ENTER or CLICK — Start', W / 2, by + 330 + 30);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText('WASD move/drive · E steal car · Q weapon wheel · F punch · X nitro · C radio · G garage · P pause', W / 2, by + 330 + 54);
  ctx.restore();
}

export function render(ctx, w, view) {
  const W = view.width;
  const H = view.height;
  ctx.clearRect(0, 0, W, H);
  if (w.ui.title) {
    drawTitle(ctx, w, view);
    return;
  }
  const pp = playerPos(w);
  const car = playerCar(w);
  const speed01 = car ? clamp(Math.abs(car.speed) / 330, 0, 1) : 0;
  const zoom = clamp(1.05 - speed01 * 0.35, 0.7, 1.05) * (view.baseZoom || 1);
  const camX = clamp(pp.x - W / 2 / zoom, -80, WORLD.w - W / zoom + 80);
  const camY = clamp(pp.y - H / 2 / zoom, -80, WORLD.h - H / zoom + 80);
  const v = { ...view, camX, camY, zoom };
  drawCity(ctx, w, v);
  drawWorldEntities(ctx, w, v);
  drawHUD(ctx, w, view);
  if (w.ui.wheelOpen) drawWheel(ctx, w, view);
  if (w.ui.shopOpen) drawShop(ctx, w, view);
  if (w.ui.card) drawCard(ctx, w, view);
  if (w.ui.paused) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#d1d5db';
    ctx.fillText('P to resume · S to save', W / 2, H / 2 + 22);
  }
  if (w.ui.gameOver) {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = w.ui.gameOver === 'busted' ? '#60a5fa' : '#ef4444';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(w.ui.gameOver === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 8);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('ENTER to continue — the job restarts', W / 2, H / 2 + 28);
  }
}
