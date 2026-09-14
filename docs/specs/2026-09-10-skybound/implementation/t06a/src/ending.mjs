import { ruinSnapshot } from './ruins.mjs';

export function completeJourney(progress, { grounded, onIsland, paused = false }) {
  if (progress.journeyComplete === true || !ruinSnapshot(progress).complete || grounded !== true || onIsland !== true || paused) return progress;
  return { ...progress, journeyComplete: true };
}
