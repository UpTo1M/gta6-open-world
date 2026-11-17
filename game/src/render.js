// SOLMARA — drawing only: the city, the cars and people, the effects, the HUD
// with its minimap, and the menus. The world's state and the current screen
// in, pixels out. A camera follows the player; the view zooms out a little
// at speed and shakes on impacts.
import { CAR, FONT, MISSIONS, PALETTE, PLACES, PLAYER, ROADS, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

const VIEW_HEIGHT = 820; // world units visible vertically at zoom 1

export function createRenderer(canvas, city) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, w: 0, h: 0, dpr: 1 };
  const fonts = new Map();

  function font(size, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    view.scale = (view.h / VIEW_HEIGHT) * dpr;
  }

  function text(value, x, y, size, color, align, weight) {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- City ---------------------------------------------------------------
  function drawGround() {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // A few darker grass patches for texture.
    ctx.fillStyle = PALETTE.grassDark;
    for (let i = 0; i < 40; i += 1) {
      const gx = ((i * 613) % WORLD.width) + 40;
      const gy = ((i * 997) % WORLD.height) + 40;
      ctx.fillRect(gx, gy, 90, 46);
    }
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
    }
    // Beach and ocean on the east edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(city.beach.x0, 0, city.beach.x1 - city.beach.x0, WORLD.height);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(city.water.x0, 0, WORLD.width - city.water.x0, WORLD.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(city.water.x0, 0, 22, WORLD.height);
    // Animated wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    const t = performance.now() / 1000;
    for (let i = 0; i < 5; i += 1) {
      const wy = ((i * 397 + t * 40) % (WORLD.height + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(city.water.x0 + 2, wy);
      ctx.quadraticCurveTo(city.water.x0 + 12, wy + 8, city.water.x0 + 22, wy);
      ctx.stroke();
    }
    // The pier.
    ctx.fillStyle = '#8a6d4b';
    ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
    ctx.fillStyle = '#6d5439';
    for (let i = 0; i < 6; i += 1) ctx.fillRect(city.pier.x + 8 + i * 19, city.pier.y, 3, city.pier.h);
  }

  function drawRoads() {
    // Sidewalks, then asphalt, for every avenue and street.
    for (const ax of ROADS.avenues) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(ax - ROADS.halfWidth - 14, 0, (ROADS.halfWidth + 14) * 2, WORLD.height);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(ax - ROADS.halfWidth, 0, ROADS.halfWidth * 2, WORLD.height);
    }
    for (const st of ROADS.streets) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(0, st - ROADS.halfWidth - 14, WORLD.width, (ROADS.halfWidth + 14) * 2);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(0, st - ROADS.halfWidth, WORLD.width, ROADS.halfWidth * 2);
    }
    // Dashed centre lines.
    ctx.fillStyle = PALETTE.lane;
    for (const ax of ROADS.avenues) {
      for (let y = 20; y < WORLD.height; y += 56) ctx.fillRect(ax - 2, y, 4, 28);
    }
    for (const st of ROADS.streets) {
      for (let x = 20; x < WORLD.width; x += 56) ctx.fillRect(x, st - 2, 28, 4);
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const ax of ROADS.avenues) {
      for (const st of ROADS.streets) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(ax + i * 12 - 4, st - ROADS.halfWidth - 4, 8, 8);
          ctx.fillRect(ax + i * 12 - 4, st + ROADS.halfWidth - 4, 8, 8);
        }
      }
    }
  }

  function drawBuildings(cam) {
    for (const b of city.buildings) {
      if (b.x + b.w < cam.x0 || b.x > cam.x1 || b.y + b.h < cam.y0 || b.y > cam.y1) continue;
      // Drop shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Roof detail: an inset slab and a couple of vents.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, Math.max(8, b.h * 0.28));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.55, 14, 10);
      ctx.fillRect(b.x + b.w * 0.65, b.y + b.h * 0.6, 12, 12);
      if (b.label) {
        ctx.font = font(15, '700');
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
    // Trees.
    for (const tr of city.trees) {
      if (tr.x < cam.x0 || tr.x > cam.x1 || tr.y < cam.y0 || tr.y > cam.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(tr.x + 3, tr.y + 4, tr.r, tr.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  }

  // --- Entities -------------------------------------------------------------
  function drawShadow(x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCar(car, time) {
    drawShadow(car.x, car.y, 22);
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = CAR.length;
    const W = CAR.width;
    // Wheels.
    ctx.fillStyle = '#15181d';
    ctx.fillRect(-L / 2 + 4, -W / 2 - 3, 10, 5);
    ctx.fillRect(-L / 2 + 4, W / 2 - 2, 10, 5);
    ctx.fillRect(L / 2 - 14, -W / 2 - 3, 10, 5);
    ctx.fillRect(L / 2 - 14, W / 2 - 2, 10, 5);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Windshield and roof.
    ctx.fillStyle = '#1b2430';
    roundRect(L / 2 - 16, -W / 2 + 4, 8, W - 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(-8, -W / 2 + 4, 16, W - 8, 3);
    ctx.fill();
    if (car.type === 'taxi') {
      ctx.fillStyle = '#15181d';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(-6 + i * 6, -W / 2 + 4, 3, 4);
    }
    if (car.type === 'sport') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-L / 2 + 6, -2, L - 12, 4);
    }
    // Headlights and brake lights.
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath(); ctx.arc(L / 2 - 1, -W / 2 + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(L / 2 - 1, W / 2 - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = car.brake ? '#ff2d2d' : '#a33';
    ctx.fillRect(-L / 2, -W / 2 + 3, 3, 5);
    ctx.fillRect(-L / 2, W / 2 - 8, 3, 5);
    // Police light bar, flashing.
    if (car.type === 'police') {
      const phase = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2f6fd0';
      ctx.fillRect(-4, -W / 2 + 2, 8, 6);
      ctx.fillStyle = phase ? '#2f6fd0' : '#ff2d2d';
      ctx.fillRect(-4, W / 2 - 8, 8, 6);
      ctx.fillStyle = '#15181d';
      ctx.font = font(8, '700');
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 2, 3);
    }
    // Smoke when badly damaged.
    if (car.health < 45 && !car.dead) {
      ctx.fillStyle = 'rgba(90,98,112,0.5)';
      ctx.beginPath(); ctx.arc(-L / 2 + 6, 0, 5 + Math.sin(time * 9) * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Siren glow.
    if (car.siren && car.driver === 'police') {
      const phase = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = phase ? 'rgba(255,45,45,0.18)' : 'rgba(47,111,208,0.18)';
      ctx.beginPath(); ctx.arc(car.x, car.y, 46, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPerson(x, y, angle, shirt, opts) {
    const o = opts || {};
    const bob = o.moving ? Math.sin((o.time || 0) * 14) * 1.5 : 0;
    drawShadow(x, y, 11);
    ctx.save();
    ctx.translate(x, y + bob * 0.3);
    // Body.
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Head.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(Math.cos(angle) * 2, Math.sin(angle) * 2, 6, 0, Math.PI * 2); ctx.fill();
    // Facing wedge.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
    ctx.lineTo(Math.cos(angle + 2.6) * 15, Math.sin(angle + 2.6) * 15);
    ctx.lineTo(Math.cos(angle - 2.6) * 15, Math.sin(angle - 2.6) * 15);
    ctx.closePath();
    ctx.fill();
    if (o.armed) {
      ctx.strokeStyle = '#15181d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
      ctx.lineTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
      ctx.stroke();
    }
    if (o.cop) {
      ctx.fillStyle = '#1b2430';
      ctx.beginPath(); ctx.arc(0, -2, 6.5, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(x, y, time, color) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.fillStyle = PALETTE.markerPulse;
    ctx.beginPath(); ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color || PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
    // A floating diamond above the marker.
    const bob = Math.sin(time * 3) * 4;
    ctx.fillStyle = color || PALETTE.marker;
    ctx.save();
    ctx.translate(x, y - 34 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    // A light beam so the marker reads from far away.
    const grad = ctx.createLinearGradient(x, y - 120, x, y);
    grad.addColorStop(0, 'rgba(255,210,63,0)');
    grad.addColorStop(1, 'rgba(255,210,63,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - 5, y - 120, 10, 120);
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      if (pt.tracer) {
        ctx.strokeStyle = `rgba(255,233,168,${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.tracer.x, pt.tracer.y);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPickups(state, time) {
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 2;
      drawShadow(pk.x, pk.y, 10);
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#58c96b';
        ctx.fillRect(pk.x - 8, pk.y - 5 + bob, 16, 10);
        ctx.fillStyle = '#2f7d3a';
        ctx.font = font(10, '700');
        ctx.textAlign = 'center';
        ctx.fillText('$', pk.x, pk.y + 3 + bob);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#eef1f5';
        ctx.fillRect(pk.x - 9, pk.y - 9 + bob, 18, 18);
        ctx.fillStyle = '#e0526b';
        ctx.fillRect(pk.x - 2, pk.y - 6 + bob, 4, 12);
        ctx.fillRect(pk.x - 6, pk.y - 2 + bob, 12, 4);
      } else {
        ctx.fillStyle = '#f2c230';
        ctx.fillRect(pk.x - 7, pk.y - 9 + bob, 14, 18);
        ctx.fillStyle = '#7a5b00';
        ctx.font = font(9, '700');
        ctx.textAlign = 'center';
        ctx.fillText('AMMO', pk.x, pk.y + 3 + bob);
      }
    }
  }

  // --- HUD ------------------------------------------------------------------
  function drawHud(state, ui) {
    const w = view.w;
    const h = view.h;
    const p = state.player;
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    // Top-left: health, money, wanted.
    ctx.fillStyle = PALETTE.panel;
    roundRect(14, 14, 250, 64, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    text('HEALTH', 26, 34, 12, PALETTE.muted, 'left', '700');
    ctx.fillStyle = '#222';
    roundRect(26, 40, 150, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 35 ? PALETTE.health : PALETTE.healthLow;
    roundRect(26, 40, Math.max(0, 150 * (p.health / PLAYER.health)), 12, 6);
    ctx.fill();
    text(`$${state.money}`, 190, 52, 18, PALETTE.money, 'left', '700');
    // Wanted stars.
    const starY = 40;
    for (let i = 0; i < 5; i += 1) {
      text('★', 26 + i * 24, starY + 30, 20, i < state.wanted ? PALETTE.star : PALETTE.starEmpty, 'left');
    }
    // Ammo and weapon.
    if (p.armed) {
      text(`AMMO ${p.ammo} / ${PLAYER.pistolMag}`, 26, 96, 14, PALETTE.text, 'left', '700');
      if (p.reloadTimer > 0) text('RELOADING…', 150, 96, 14, PALETTE.star, 'left', '700');
    }
    // Mission objective, bottom-left.
    const mission = state.mission;
    if (mission.active || mission.done) {
      const cur = MISSIONS[mission.index];
      const step = cur ? cur.steps[mission.step] : null;
      ctx.fillStyle = PALETTE.panel;
      const lines = mission.done
        ? ['STORY COMPLETE', 'King of Solmara — free roam, keep the city yours.']
        : [cur.name.toUpperCase(), step ? step.text : ''];
      const panelH = 62;
      roundRect(14, h - panelH - 14, 420, panelH, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.stroke();
      text(lines[0], 28, h - panelH + 12, 15, PALETTE.star, 'left', '700');
      text(lines[1], 28, h - 26, 14, PALETTE.text, 'left');
      // Collect progress bar.
      if (step && step.type === 'collect' && mission.holdProgress > 0) {
        const frac = mission.holdProgress / (step.holdTime || 3);
        ctx.fillStyle = '#222';
        roundRect(28, h - 46, 200, 8, 4);
        ctx.fill();
        ctx.fillStyle = PALETTE.star;
        roundRect(28, h - 46, 200 * frac, 8, 4);
        ctx.fill();
      }
    }
    // Speed, bottom-right.
    if (p.car) {
      const kmh = Math.round(Math.abs(p.car.vf) * 0.36);
      text(`${kmh}`, w - 26, h - 40, 40, PALETTE.text, 'right', '700');
      text('km/h', w - 26, h - 18, 13, PALETTE.muted, 'right', '700');
      text(p.car.kind === 'sport' ? 'Comet GT' : p.car.type, w - 26, h - 78, 13, PALETTE.muted, 'right', '700');
    } else {
      text('WASD move · Shift run · E enter car · Q weapon · F punch', w - 26, h - 18, 12, PALETTE.muted, 'right');
    }
    // Interaction prompt, centre-bottom.
    if (ui.prompt) {
      ctx.font = font(16, '700');
      const pw = ctx.measureText(ui.prompt).width + 28;
      ctx.fillStyle = PALETTE.panel;
      roundRect((w - pw) / 2, h - 108, pw, 36, 18);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.stroke();
      text(ui.prompt, w / 2, h - 84, 16, PALETTE.text, 'center', '700');
    }
    // Crosshair when armed on foot.
    if (p.armed && !p.car && ui.mouse) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      const mx = ui.mouse.x;
      const my = ui.mouse.y;
      ctx.beginPath();
      ctx.moveTo(mx - 9, my); ctx.lineTo(mx - 3, my);
      ctx.moveTo(mx + 3, my); ctx.lineTo(mx + 9, my);
      ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my - 3);
      ctx.moveTo(mx, my + 3); ctx.lineTo(mx, my + 9);
      ctx.stroke();
    }
    // Dialogue, bottom-centre.
    if (state.dialogue && state.dialogue.length > 0) {
      const line = state.dialogue[0];
      ctx.font = font(16);
      const dw = Math.min(w - 80, ctx.measureText(line).width + 40);
      ctx.fillStyle = PALETTE.panel;
      roundRect((w - dw) / 2, h - 168, dw, 44, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.panelEdge;
      ctx.stroke();
      text(line, w / 2, h - 140, 16, PALETTE.text, 'center');
    }
    // Banner, top-centre.
    if (state.banner) {
      ctx.font = font(26, '800');
      const bw = ctx.measureText(state.banner).width + 44;
      ctx.fillStyle = PALETTE.panel;
      roundRect((w - bw) / 2, 16, bw, 46, 12);
      ctx.fill();
      ctx.strokeStyle = PALETTE.star;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(state.banner, w / 2, 47, 26, PALETTE.star, 'center', '800');
    }
    // Hurt vignette.
    if (p.hurtTimer > 0) {
      const a = Math.min(0.32, p.hurtTimer * 0.14);
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.75);
      grad.addColorStop(0, 'rgba(224,82,107,0)');
      grad.addColorStop(1, `rgba(224,82,107,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    drawMinimap(state);
    ctx.restore();
  }

  function drawMinimap(state) {
    const mw = 190;
    const mh = 142;
    const x0 = view.w - mw - 14;
    const y0 = 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.panel;
    roundRect(x0 - 6, y0 - 6, mw + 12, mh + 12, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    roundRect(x0, y0, mw, mh, 6);
    ctx.clip();
    ctx.fillStyle = '#3f6b35';
    ctx.fillRect(x0, y0, mw, mh);
    // Water.
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0 + city.water.x0 * sx, y0, (WORLD.width - city.water.x0) * sx, mh);
    // Roads.
    ctx.fillStyle = '#3a3f4a';
    for (const ax of ROADS.avenues) ctx.fillRect(x0 + (ax - ROADS.halfWidth) * sx, y0, ROADS.halfWidth * 2 * sx, mh);
    for (const st of ROADS.streets) ctx.fillRect(x0, y0 + (st - ROADS.halfWidth) * sy, mw, ROADS.halfWidth * 2 * sy);
    // Buildings.
    ctx.fillStyle = '#6b7f8c';
    for (const b of city.buildings) ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
    // Garage.
    ctx.fillStyle = PALETTE.marker;
    ctx.fillRect(x0 + PLACES.garage.x * sx - 3, y0 + PLACES.garage.y * sy - 3, 6, 6);
    // Mission marker.
    const mission = state.mission;
    if (mission.active) {
      const cur = MISSIONS[mission.index];
      const step = cur ? cur.steps[mission.step] : null;
      if (step) {
        const pl = PLACES[step.loc];
        const pulse = 3 + Math.sin(performance.now() / 200) * 1.5;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(x0 + pl.x * sx, y0 + pl.y * sy, pulse + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Cars.
    for (const car of state.cars) {
      if (car.dead) continue;
      ctx.fillStyle = car.driver === 'police' ? (Math.floor(performance.now() / 300) % 2 ? '#ff2d2d' : '#2f6fd0') : '#c8ccd2';
      ctx.fillRect(x0 + car.x * sx - 1.5, y0 + car.y * sy - 1.5, 3, 3);
    }
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // --- Panels ---------------------------------------------------------------
  function drawPanel(title, lines, prompt) {
    const w = view.w;
    const h = view.h;
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const pw = 620;
    const ph = 150 + lines.length * 30;
    const x = (w - pw) / 2;
    const y = (h - ph) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(x, y, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(title, w / 2, y + 62, 44, PALETTE.text, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], w / 2, y + 108 + i * 30, 17, PALETTE.muted, 'center');
    }
    text(prompt, w / 2, y + ph - 28, 17, PALETTE.star, 'center', '700');
    ctx.restore();
  }

  function drawTitle(state, ui, time) {
    const w = view.w;
    const h = view.h;
    // A slow pan over the city behind the title.
    const panX = 1280 + Math.sin(time * 0.05) * 500;
    const panY = 960 + Math.cos(time * 0.04) * 300;
    drawWorld(state, panX, panY, 0.9, time, false);
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(10,14,24,0.25)');
    grad.addColorStop(0.55, 'rgba(10,14,24,0.55)');
    grad.addColorStop(1, 'rgba(10,14,24,0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    text('SOLMARA', w / 2, h * 0.3, 92, '#ffd23f', 'center', '800');
    text('A coastal city. A rising crew. Your story.', w / 2, h * 0.3 + 42, 20, PALETTE.text, 'center');
    const lines = [
      'Steal cars, outrun the Solmara PD, and run four jobs for Vera Solano.',
      'WASD / arrows — move & drive · E — enter / steal a car · Q — draw your gun',
      'Mouse — aim · Click — shoot · F — punch · R — reload · Shift — run · P — pause · M — mute',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], w / 2, h * 0.52 + i * 28, 16, PALETTE.muted, 'center');
    }
    if (ui.hasSave) {
      text('ENTER — Continue your story', w / 2, h * 0.68, 22, PALETTE.star, 'center', '700');
      text('N — New game', w / 2, h * 0.68 + 32, 17, PALETTE.text, 'center');
    } else {
      text('ENTER or CLICK — Start', w / 2, h * 0.68, 22, PALETTE.star, 'center', '700');
    }
    if (ui.best > 0) text(`Best fortune: $${ui.best}`, w / 2, h * 0.68 + 64, 15, PALETTE.muted, 'center');
    ctx.restore();
  }

  // --- World frame ------------------------------------------------------------
  function drawWorld(state, camX, camY, zoom, time, drawHudFlag) {
    const scale = view.scale * zoom;
    const dpr = view.dpr;
    const cx = view.w * dpr / 2;
    const cy = view.h * dpr / 2;
    const shakeX = state.camera.shake > 0 ? (Math.random() - 0.5) * state.camera.shake * dpr : 0;
    const shakeY = state.camera.shake > 0 ? (Math.random() - 0.5) * state.camera.shake * dpr : 0;
    ctx.setTransform(scale, 0, 0, scale, cx - camX * scale + shakeX, cy - camY * scale + shakeY);
    const vw = view.w / (view.scale / dpr) / zoom;
    const vh = view.h / (view.scale / dpr) / zoom;
    const cam = { x0: camX - vw / 2 - 60, x1: camX + vw / 2 + 60, y0: camY - vh / 2 - 60, y1: camY + vh / 2 + 60 };
    drawGround();
    drawRoads();
    drawBuildings(cam);
    // Skid marks.
    for (const s of state.skid) {
      ctx.fillStyle = `rgba(20,22,28,${0.4 * (s.life / s.maxLife)})`;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    drawPickups(state, time);
    // Mission marker.
    const mission = state.mission;
    if (mission.active) {
      const cur = MISSIONS[mission.index];
      const step = cur ? cur.steps[mission.step] : null;
      if (step) {
        const pl = PLACES[step.loc];
        drawMarker(pl.x, pl.y, time);
      }
    }
    // Cars, people, effects.
    for (const car of state.cars) {
      if (car.dead) {
        // A wreck: dark, smoking.
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = '#22262e';
        roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (car.x < cam.x0 || car.x > cam.x1 || car.y < cam.y0 || car.y > cam.y1) continue;
      drawCar(car, time);
    }
    for (const ped of state.peds) {
      if (ped.dead) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - ped.fade / 6);
        ctx.translate(ped.x, ped.y);
        ctx.rotate(ped.angle + Math.PI / 2);
        ctx.fillStyle = ped.color;
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      if (ped.x < cam.x0 || ped.x > cam.x1 || ped.y < cam.y0 || ped.y > cam.y1) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, { moving: true, time });
    }
    for (const e of state.enemies) {
      if (e.dead) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - e.fade / 6);
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle + Math.PI / 2);
        ctx.fillStyle = '#8a2f2f';
        ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      drawPerson(e.x, e.y, e.angle, '#8a2f2f', { moving: true, time, armed: true });
    }
    for (const cop of state.cops) {
      if (cop.dead) continue;
      drawPerson(cop.x, cop.y, cop.angle, '#2f6fd0', { moving: true, time, cop: true });
      if (cop.bustTimer > 0) {
        ctx.fillStyle = '#ffd23f';
        ctx.font = font(13, '700');
        ctx.textAlign = 'center';
        ctx.fillText('BUSTING…', cop.x, cop.y - 22);
      }
    }
    // The player on foot.
    const p = state.player;
    if (!p.car && p.health > 0) {
      drawPerson(p.x, p.y, p.angle, PALETTE.playerShirt, { moving: p.moving, time, armed: p.armed });
    }
    drawParticles(state);
    // Waypoint arrow at the screen edge, pointing at the objective.
    if (drawHudFlag && mission.active) {
      const cur = MISSIONS[mission.index];
      const step = cur ? cur.steps[mission.step] : null;
      if (step) {
        const pl = PLACES[step.loc];
        const dx = pl.x - p.x;
        const dy = pl.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > vw * 0.45) {
          const a = Math.atan2(dy, dx);
          const ex = cx + Math.cos(a) * (view.w * dpr / 2 - 70 * dpr);
          const ey = cy + Math.sin(a) * (view.h * dpr / 2 - 70 * dpr);
          ctx.fillStyle = PALETTE.marker;
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(16, 0);
          ctx.lineTo(-10, -10);
          ctx.lineTo(-10, 10);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.font = font(13 * dpr, '700');
          ctx.fillStyle = PALETTE.marker;
          ctx.textAlign = 'center';
          ctx.fillText(`${Math.round(dist)}m`, ex, ey + 26 * dpr);
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function draw(state, screen, ui, time) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const p = state.player;
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui, time);
      return;
    }
    drawWorld(state, state.camera.x, state.camera.y, state.camera.zoom, time, true);
    drawHud(state, ui);
    if (screen === SCREEN_PAUSED) {
      ctx.save();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.fillStyle = 'rgba(10,14,24,0.45)';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.restore();
      drawPanel('Paused', ['The city waits for you.', `Money $${state.money} · Jobs done ${state.mission.completed.length} / ${MISSIONS.length}`], 'P — resume · S — save');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Solmara PD caught up with you.', 'You lost $150 and the heat is off. The garage is waiting.'], 'Press Enter to get back out there');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Solmara is a hard city.', 'You lost $150. Vera patched you up at the garage.'], 'Press Enter to get back out there');
    } else if (screen === SCREEN_DONE) {
      drawPanel('KING OF SOLMARA', ['Every job done. The city is yours.', `Fortune $${state.money} · Cars stolen ${state.stats.stolen} · Rivals down ${state.stats.kills}`], 'Press Enter to keep roaming free');
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /** Convert a mouse position in CSS pixels to world coordinates. */
  function screenToWorld(state, sx, sy) {
    const scale = view.scale * state.camera.zoom;
    const cx = (view.w * view.dpr) / 2;
    const cy = (view.h * view.dpr) / 2;
    return {
      x: state.camera.x + (sx * view.dpr - cx) / scale,
      y: state.camera.y + (sy * view.dpr - cy) / scale,
    };
  }

  return { draw, resize, screenToWorld };
}
