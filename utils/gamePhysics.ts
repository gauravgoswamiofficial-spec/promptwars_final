
import { Obstacle, LANES } from '../types';

/**
 * Pure physics functions to enable unit testing and improve engine performance.
 */

export const checkCollision = (
  playerLane: number,
  playerY: number,
  playerHeight: number,
  obs: Obstacle
): boolean => {
  // Only check obstacles within hitting range (z between 0 and 80)
  if (obs.z > 0 && obs.z < 80 && obs.lane === playerLane) {
    return playerY < obs.height;
  }
  return false;
};

export const calculatePerspective = (z: number, focalLength: number = 600): number => {
  return focalLength / (focalLength + z);
};

export const getScreenCoords = (
  lane: number,
  z: number,
  y: number,
  width: number,
  height: number,
  horizon: number,
  focalLength: number = 600
) => {
  const p = calculatePerspective(z, focalLength);
  return {
    x: width / 2 + lane * p,
    y: horizon + (height - horizon) * p - (y * p * 2.5),
    scale: p
  };
};
