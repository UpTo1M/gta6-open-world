// Keyboard + mouse input for SOLMARA. The browser attaches listeners and
// each frame produces one plain input object for the simulation; the Node
// sim builds the same shape directly with makeSimInput, so the game logic
// never knows which side it runs on.

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
};

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, worldX: 0, worldY: 0 };
  let wheel = null;

  function keydown(e) {
    if (e.repeat) return;
    const action = KEYMAP[e.code];
    if (action) {
      held.add(action);
      pressed.add(action);
      e.preventDefault();
    } else if (e.code === 'KeyE') { pressed.add('e'); e.preventDefault(); }
    else if (e.code === 'KeyQ') { held.add('q'); pressed.add('q'); }
    else if (e.code === 'KeyF') { pressed.add('f'); }
    else if (e.code === 'KeyX') { held.add('x'); }
    else if (e.code === 'KeyC') { pressed.add('c'); }
    else if (e.code === 'KeyG') { pressed.add('g'); }
    else if (e.code === 'KeyR') { pressed.add('r'); }
    else if (e.code === 'KeyP') { pressed.add('p'); }
    else if (e.code === 'KeyM') { pressed.add('m'); }
    else if (e.code === 'Enter') { pressed.add('enter'); }
    else if (e.code === 'Escape') { pressed.add('esc'); }
    else if (e.code === 'Digit1') { wheel = 'pistol'; pressed.add('wheel'); }
    else if (e.code === 'Digit2') { wheel = 'smg'; pressed.add('wheel'); }
    else if (e.code === 'Digit3') { wheel = 'shotgun'; pressed.add('wheel'); }
  }

  function keyup(e) {
    const action = KEYMAP[e.code];
    if (action) held.delete(action);
    else if (e.code === 'KeyQ') held.delete('q');
    else if (e.code === 'KeyX') held.delete('x');
  }

  return {
    held, pressed, mouse,
    get wheel() { return wheel; },
    set wheel(v) { wheel = v; },
    attach(canvas) {
      window.addEventListener('keydown', keydown);
      window.addEventListener('keyup', keyup);
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) mouse.down = true;
      });
      window.addEventListener('mouseup', () => { mouse.down = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    // One frame's input for the simulation. Edge-triggered keys are
    // consumed here, so holding E does not re-trigger every frame.
    read() {
      const out = {
        up: held.has('up'), down: held.has('down'),
        left: held.has('left'), right: held.has('right'),
        run: held.has('run'), brake: held.has('brake'),
        qHold: held.has('q'), nitro: held.has('x'),
        e: pressed.has('e'), qTap: pressed.has('q'),
        f: pressed.has('f'), c: pressed.has('c'), g: pressed.has('g'),
        r: pressed.has('r'), p: pressed.has('p'), m: pressed.has('m'),
        enter: pressed.has('enter'), esc: pressed.has('esc'),
        wheel, wheelPick: pressed.has('wheel'),
        mouseDown: mouse.down,
        mouseX: mouse.x, mouseY: mouse.y,
        mouseWorldX: mouse.worldX, mouseWorldY: mouse.worldY,
      };
      pressed.clear();
      wheel = null;
      return out;
    },
  };
}

// The sim (and the screenshot scenes) build inputs directly. Anything not
// listed defaults to "not pressed / not held".
export function makeSimInput(over = {}) {
  return {
    up: false, down: false, left: false, right: false,
    run: false, brake: false, qHold: false, nitro: false,
    e: false, qTap: false, f: false, c: false, g: false,
    r: false, p: false, m: false, enter: false, esc: false,
    wheel: null, wheelPick: false,
    mouseDown: false, mouseX: 0, mouseY: 0,
    mouseWorldX: 0, mouseWorldY: 0,
    ...over,
  };
}
