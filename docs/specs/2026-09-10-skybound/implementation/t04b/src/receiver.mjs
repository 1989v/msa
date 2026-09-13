// Single receiver latch; consumes committed objects, never transport/preview poses.
export function createReceiver({ prismId, x, z, width, depth, baseY, heightTolerance = .05 }) {
  if (typeof prismId !== 'string' || !prismId || ![x, z, width, depth, baseY, heightTolerance].every(Number.isFinite)
    || width <= 0 || depth <= 0 || heightTolerance < 0) throw new TypeError('Finite receiver bounds and prism ID required');
  const receiver = Object.freeze({ prismId, center: Object.freeze({ x, z }), baseY, width, depth, heightTolerance,
    bounds: Object.freeze({ minX: x-width/2, maxX: x+width/2, minZ: z-depth/2, maxZ: z+depth/2 }), yaw: Object.freeze([90, 270]) });
  function evaluate(previous, manipulation, { paused = false, reset = false } = {}) {
    if (typeof paused !== 'boolean' || typeof reset !== 'boolean') throw new TypeError('Boolean receiver lifecycle required');
    const result = (complete, reason) => Object.freeze({ complete, receiver, reason });
    if (reset) return result(false, 'waiting');
    if (previous?.complete === true) return result(true, null);
    if (paused || manipulation?.paused) return result(false, 'paused');
    if (manipulation?.held) return result(false, 'held');
    if (manipulation?.preview?.valid === false) return result(false, 'preview');
    const object = manipulation?.objects?.find(o => o.id === prismId);
    if (!object || object.kind !== 'prism') return result(false, 'object');
    if (!['x','y','z'].every(k => Number.isFinite(object.position?.[k]) && Number.isFinite(object.size?.[k]) && object.size[k] > 0)
      || !Number.isFinite(object.yaw)) return result(false, 'pose');
    const yaw = ((object.yaw % 360) + 360) % 360;
    if (!receiver.yaw.includes(yaw)) return result(false, 'orientation');
    const halfX = object.size.z/2, halfZ = object.size.x/2, p = object.position, b = receiver.bounds;
    if (p.x-halfX < b.minX-1e-9 || p.x+halfX > b.maxX+1e-9 || p.z-halfZ < b.minZ-1e-9 || p.z+halfZ > b.maxZ+1e-9) return result(false, 'footprint');
    if (Math.abs(p.y-object.size.y/2-baseY) > heightTolerance+1e-9) return result(false, 'height');
    return result(true, null);
  }
  return Object.freeze({ receiver, evaluate });
}
