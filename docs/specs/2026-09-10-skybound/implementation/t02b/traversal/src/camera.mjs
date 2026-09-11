export const CAMERA_DEFAULTS = Object.freeze({ yaw: 0, pitch: .29, distance: 5.2 });
export const CAMERA_LIMITS = Object.freeze({ minPitch: .08, maxPitch: 1.15, minDistance: 3, maxDistance: 8 });
const finite = value => { if (!Number.isFinite(value)) throw new TypeError('Finite camera values required'); return value; };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export function updateCamera(state, command) {
  let { yaw, pitch, distance } = state;
  if (command?.type === 'reset') return { ...CAMERA_DEFAULTS };
  if (command?.type === 'set') {
    yaw = command.yaw === undefined ? yaw : finite(command.yaw);
    pitch = command.pitch === undefined ? pitch : finite(command.pitch);
    distance = command.distance === undefined ? distance : finite(command.distance);
  } else if (command?.type === 'drag') {
    yaw -= finite(command.dx) * .005; pitch += finite(command.dy) * .004;
  } else if (command?.type === 'zoom') {
    distance *= Math.exp(clamp(finite(command.delta), -2000, 2000) * .001);
  } else throw new TypeError('Unknown camera command');
  const tau = Math.PI * 2;
  return { yaw: ((finite(yaw) + Math.PI) % tau + tau) % tau - Math.PI,
    pitch: clamp(finite(pitch), CAMERA_LIMITS.minPitch, CAMERA_LIMITS.maxPitch),
    distance: clamp(finite(distance), CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance) };
}
export function cameraOffset({ yaw, pitch, distance }) {
  const horizontal = distance * Math.cos(pitch);
  return { x: Math.sin(yaw) * horizontal, y: Math.sin(pitch) * distance, z: Math.cos(yaw) * horizontal };
}
