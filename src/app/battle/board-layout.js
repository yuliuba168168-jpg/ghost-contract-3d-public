import * as THREE from 'three';
import { LANES_X, ROW_Z } from '../scene/table.js';

export const CARD_Y = .016;
export function slotPos(side, lane, target = new THREE.Vector3()) {
  return target.set(LANES_X[Math.max(0, Math.min(3, lane))], CARD_Y, ROW_Z[side]);
}
export function standPos(side, lane, target = new THREE.Vector3()) {
  return target.set(LANES_X[Math.max(0, Math.min(3, lane))], .03, ROW_Z[side] + (side === 'ally' ? -.1 : -.7));
}
export function midPos(lane, target = new THREE.Vector3()) {
  return target.set(LANES_X[Math.max(0, Math.min(3, lane))], .5, (ROW_Z.enemy + ROW_Z.ally) / 2);
}
