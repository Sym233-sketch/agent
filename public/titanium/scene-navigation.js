/* Drag rotates the exhibits; the camera position is independent of drag input. */
export const ROTATION_LIMITS = Object.freeze({ tilt: .12, mobileTilt: .10, minDistance: 12, dragThreshold: 7, maxDelta: 80 });
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const finite = Number.isFinite;
export const wrapAngle = angle => finite(angle) ? Math.atan2(Math.sin(angle), Math.cos(angle)) : 0;
export const angleDelta = (from, to) => wrapAngle(to - from);
export function cameraPose(distance) {
  const d = Math.max(ROTATION_LIMITS.minDistance, finite(distance) ? distance : 20);
  return { x: 0, y: d * .13 + 1.25, z: d };
}

export class SceneNavigation {
  constructor() { this.mobile = false; this.yaw = 0; this.pitch = 0; this.drag = null; }
  get tiltLimit() { return this.mobile ? ROTATION_LIMITS.mobileTilt : ROTATION_LIMITS.tilt; }
  setMobile(mobile) { this.mobile = !!mobile; this.pitch = clamp(this.pitch, -this.tiltLimit, this.tiltLimit); }
  begin(pointerId, x, y) {
    if (this.drag || !finite(pointerId) || !finite(x) || !finite(y)) return false;
    this.drag = { pointerId, x, y, distance: 0, moved: false };
    return true;
  }
  move(pointerId, x, y, buttons = 1, pointerType = 'mouse') {
    const drag = this.drag;
    if (!drag || drag.pointerId !== pointerId) return null;
    if (!finite(x) || !finite(y) || (pointerType === 'mouse' && !(buttons & 1))) return { ended: this.end(pointerId, true) };
    const dx = clamp(x - drag.x, -ROTATION_LIMITS.maxDelta, ROTATION_LIMITS.maxDelta);
    const dy = clamp(y - drag.y, -ROTATION_LIMITS.maxDelta, ROTATION_LIMITS.maxDelta);
    drag.x = x; drag.y = y; drag.distance += Math.hypot(dx, dy);
    drag.moved ||= drag.distance > ROTATION_LIMITS.dragThreshold;
    if (drag.moved) {
      this.yaw = wrapAngle(this.yaw + dx * .0032);
      this.pitch = clamp(this.pitch + dy * .0011, -this.tiltLimit, this.tiltLimit);
    }
    return { moved: drag.moved };
  }
  end(pointerId, cancelled = false) {
    if (!this.drag || this.drag.pointerId !== pointerId) return null;
    const result = { ...this.drag, cancelled, suppressClick: cancelled || this.drag.moved };
    this.drag = null;
    return result;
  }
  cancel() { return this.drag ? this.end(this.drag.pointerId, true) : null; }
  reset() { this.drag = null; this.yaw = 0; this.pitch = 0; }
}
