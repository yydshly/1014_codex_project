const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Read real pointer movement, not the character's animation. A slow pass and
// return must both span a useful fraction of the visible head, without a gap.
export class HeadStroke {
  reset() { this.last = this.origin = this.axis = this.movement = null; this.furthest = 0; this.interrupted = false; }
  constructor() { this.reset(); }
  begin(x, y, at) {
    this.reset(); this.last = { x, y, at }; this.origin = { x, y, at };
  }
  move(x, y, at, headSize, contact = false) {
    this.movement = null; this.interrupted = false;
    if (!this.last || at - this.last.at > 700 || at < this.last.at) { this.begin(x, y, at); this.interrupted = true; return false; }
    const dx = x - this.last.x, dy = y - this.last.y, distance = Math.hypot(dx, dy);
    if (distance < 1.5) return false;
    const elapsed = at - this.last.at, width = Math.max(42, headSize);
    if (elapsed <= 0 || distance > width * 0.65 || distance / elapsed * 1000 > Math.max(650, width * 5.5)) {
      this.begin(x, y, at); this.interrupted = true; return false;
    }
    this.last = { x, y, at };
    const fromX = x - this.origin.x, fromY = y - this.origin.y;
    if (!this.axis) {
      const length = Math.hypot(fromX, fromY);
      if (length < 4) return false;
      this.axis = { x: fromX / length, y: fromY / length };
    }
    this.movement = { x: dx, y: dy };
    const progress = fromX * this.axis.x + fromY * this.axis.y;
    this.furthest = Math.max(this.furthest, progress);
    const leg = clamp(width * 0.12, 10, 22);
    const complete = contact ? this.furthest >= leg * 1.25 : this.furthest >= leg && this.furthest - progress >= leg;
    if (complete && at - this.origin.at >= (contact ? 220 : 280)) {
      const movement = this.movement;
      this.begin(x, y, at); this.movement = movement; return true;
    }
    return false;
  }
}
