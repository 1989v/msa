// Persistent ordered landing flags; transient airborne/respawn events do not erase progress.
export function updateRoute(progress, { first = false, second = false } = {}) {
  if (!progress || typeof progress !== 'object' || typeof first !== 'boolean' || typeof second !== 'boolean') throw new TypeError('Route progress and boolean contacts required');
  const reachedFirst = progress.firstAerialLanding === true || first;
  const complete = progress.firstAerialLanding === true && (progress.secondAerialLanding === true || second);
  if (progress.firstAerialLanding === reachedFirst && progress.secondAerialLanding === complete) return progress;
  return { ...progress, firstAerialLanding: reachedFirst, secondAerialLanding: complete };
}

export function routeSnapshot(progress) {
  const first = progress.firstAerialLanding === true;
  const second = first && progress.secondAerialLanding === true;
  return Object.freeze({ first, second, complete: second, stage: second ? 'complete' : first ? 'second' : 'first' });
}
