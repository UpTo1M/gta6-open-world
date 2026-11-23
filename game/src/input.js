// SOLMARA — keyboard and mouse. Held keys give movement and driving; one-shot
// presses (enter a car, punch, reload, pause, save, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_WEAPON = 32; // kept for compatibility; Q is tap-vs-hold now
export const ACTION_MUTE = 64;
export const ACTION_SAVE = 128;
export const ACTION_NEW = 256;
export const ACTION_RADIO = 512; // C — cycle the radio station
export const ACTION_GARAGE = 1024; // G — open Vera's Garage menu
export const ACTION_WHEEL1 = 2048; // 1 — pistol in the weapon wheel
export const ACTION_WHEEL2 = 4096; // 2 — SMG in the weapon wheel
export const ACTION_WHEEL3 = 8192; // 3 — shotgun in the weapon wheel

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false, handbrake: false, q: false, nitro: false };
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) {
      held.down = true;
      // S is also Save on the pause screen; in play the flag is ignored.
      if (event.code === 'KeyS' && !event.repeat) actions |= ACTION_SAVE;
    }
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.run = true;
    else if (event.code === 'Space') {
      held.handbrake = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RELOAD;
    } else if (event.code === 'KeyQ') {
      // Hold Q for the weapon wheel (a quick tap draws/holsters); the main
      // loop tells a tap from a hold, so no action flag is queued here.
      held.q = true;
    } else if (event.code === 'KeyX') {
      held.nitro = true;
    } else if (event.code === 'KeyC') {
      if (!event.repeat) actions |= ACTION_RADIO;
    } else if (event.code === 'KeyG') {
      if (!event.repeat) actions |= ACTION_GARAGE;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_WHEEL1;
    } else if (event.code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_WHEEL2;
    } else if (event.code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_WHEEL3;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyN') {
      if (!event.repeat) actions |= ACTION_NEW;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.run = false;
    else if (event.code === 'Space') held.handbrake = false;
    else if (event.code === 'KeyQ') held.q = false;
    else if (event.code === 'KeyX') held.nitro = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = held.handbrake = false;
    held.q = false;
    held.nitro = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held,
    mouse,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
