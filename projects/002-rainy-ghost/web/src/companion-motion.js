const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };

// Small pose offsets share scene simulation time: pause freezes every gesture.
export class CompanionMotion {
  constructor({ random = Math.random } = {}) { this.random = random; this.reset(); }
  reset() {
    this.target = this.attention = this.lookX = this.lookY = this.targetX = this.targetY = 0;
    this.kind = 'rest'; this.since = -100; this.familiar = false;
    this.held = 0; this.noticed = false;
    this.strokeSession = false; this.strokePulse = this.strokeMove = -100;
    this.strokeDuration = this.strokeLevel = this.comfort = this.strokeX = this.strokeY = 0;
    this.strokeTargetX = this.strokeTargetY = 0;
    this.farewellSince = -100;
    this.farewellTargetX = this.farewellTargetY = this.farewellX = this.farewellY = this.farewell = 0;
    this.wake(0);
    this.pose = { lift: 0, lean: 0, nod: 0, tuck: 0, blush: 0, squint: 0, eyes: 1, lookX: 0, lookY: 0, attention: 0, noticed: false, kind: 'rest',
      strokeX: 0, strokeY: 0, nuzzle: 0, comfort: 0, farewell: 0, farewellX: 0, farewellY: 0 };
  }
  setAttention(value, x = 0, y = 0) {
    this.target = clamp(value, 0, 1);
    this.targetX = clamp(x, -1, 1); this.targetY = clamp(y, -1, 1);
    if (value < 0.2) { this.held = 0; this.noticed = false; }
  }
  wake(time) { this.squintSince = -100; this.squintAt = time + 18 + this.random() * 16; }
  cue(kind, time, familiar = false) {
    if (kind !== 'pet') this.endStroke();
    this.kind = kind; this.since = time; this.familiar = familiar; this.wake(time);
  }
  // Only a complete, gentle pass renews the session. Merely hovering, holding or
  // jittering cannot build comfort, even though valid movement updates direction.
  stroke(x, y, time, pulse = false) {
    const fresh = pulse && (!this.strokeSession || time - this.strokePulse > 1.4);
    if (fresh) { this.strokeDuration = 0; this.farewellSince = -100; }
    if (pulse) { this.strokeSession = true; this.strokePulse = time; }
    if (!this.strokeSession || time - this.strokePulse > 1.4) return false;
    this.strokeMove = time;
    this.strokeTargetX = clamp(x, -1, 1); this.strokeTargetY = clamp(y, -1, 1);
    return fresh;
  }
  endStroke() { this.strokeSession = false; this.farewellSince = -100; }
  releaseStroke(time, x = this.strokeTargetX, y = this.strokeTargetY) {
    if (!this.strokeSession) return false;
    this.strokeSession = false;
    this.farewellSince = time;
    this.farewellTargetX = clamp(x, -1, 1); this.farewellTargetY = clamp(y, -1, 1);
    this.setAttention(0); this.wake(time);
    return true;
  }
  isSeeingOff(time) { return this.farewellSince >= 0 && (time - this.farewellSince < 2.6 || this.farewell > 0.02); }
  isStroking(time) { return this.strokeSession && time - this.strokePulse <= 1.4 && time - this.strokeMove <= 0.25; }
  sample(time, dt, busy = false) {
    // A brief pause at a turn is still stroking. A real stop gets one silent
    // glance using the last direction, even when no pointerleave/up arrives.
    if (dt > 0 && this.strokeSession && (time - this.strokeMove > 0.55 || time - this.strokePulse > 1.4)) this.releaseStroke(time);
    const step = 1 - Math.exp(-4 * dt);
    this.attention += (this.target - this.attention) * step;
    this.lookX += (this.targetX * this.target - this.lookX) * step;
    this.lookY += (this.targetY * this.target - this.lookY) * step;
    this.held = this.target > 0.55 ? this.held + dt : 0;
    const noticed = this.held > 0.7 && !this.noticed;
    if (noticed) this.noticed = true;
    const stroking = this.isStroking(time);
    this.strokeDuration = stroking ? this.strokeDuration + dt : Math.max(0, this.strokeDuration - dt * 2);
    const strokeStep = 1 - Math.exp(-5 * dt);
    this.strokeLevel += ((stroking ? 1 : 0) - this.strokeLevel) * strokeStep;
    this.strokeX += ((stroking ? this.strokeTargetX : 0) - this.strokeX) * strokeStep;
    this.strokeY += ((stroking ? this.strokeTargetY : 0) - this.strokeY) * strokeStep;
    this.comfort += ((stroking ? smooth((this.strokeDuration - 1.4) / 1.8) : 0) - this.comfort) * (1 - Math.exp(-2.5 * dt));
    const farewellAge = time - this.farewellSince;
    const farewellEnvelope = farewellAge >= 0 && farewellAge < 2.6
      ? smooth(farewellAge / 0.3) * (1 - smooth((farewellAge - 0.65) / 1.95)) : 0;
    this.farewell += (farewellEnvelope - this.farewell) * strokeStep;
    this.farewellX += (this.farewellTargetX * farewellEnvelope - this.farewellX) * strokeStep;
    this.farewellY += (this.farewellTargetY * farewellEnvelope - this.farewellY) * strokeStep;
    const age = time - this.since;
    const pet = this.kind === 'pet' && age >= 0 && age < 1.8;
    const tuck = pet ? smooth(age / 0.28) * (1 - smooth((age - 0.48) / 1.32)) : 0;
    const petBlush = this.kind === 'pet' && age >= 0 && age < 2.6
      ? smooth(age / 0.36) * (1 - smooth((age - 0.5) / 2.1)) : 0;
    const blush = Math.max(petBlush, this.strokeLevel * 0.22);
    const envelope = this.kind !== 'pet' && age >= 0 && age < 3.2 ? Math.sin(Math.PI * age / 3.2) ** 2 : 0;
    if (dt > 0 && busy) this.wake(time);
    if (dt > 0 && !busy && !pet && !envelope && this.strokeLevel < 0.01 && !this.isSeeingOff(time) && time >= this.squintAt) {
      this.squintSince = time; this.squintAt = time + 18 + this.random() * 16;
    }
    const squintAge = time - this.squintSince;
    const squint = Math.max(this.comfort * 0.96, squintAge >= 0 && squintAge < 2.8 ? Math.sin(Math.PI * squintAge / 2.8) ** 2 : 0);
    const greeting = ['welcome', 'return', 'greet', 'nod'].includes(this.kind);
    const lift = this.attention * 0.14 + envelope * (greeting ? 0.17 : 0.055);
    const nod = envelope * Math.sin(Math.max(0, age) * 4) * (this.kind === 'nod' || this.familiar ? 0.065 : 0.025) + tuck * 0.11;
    const blink = envelope > 0 && ((age > 0.5 && age < 0.68) || (this.familiar && age > 0.95 && age < 1.1)) ? 0.25 : 1;
    const eyes = Math.min(blink, 1 - tuck * 0.8, 1 - squint * 0.72);
    return Object.assign(this.pose, { lift, lean: envelope * (this.familiar ? 0.045 : 0.025) - tuck * 0.025, nod, tuck, blush, squint, eyes,
      strokeX: this.strokeX * this.strokeLevel, strokeY: this.strokeY * this.strokeLevel,
      nuzzle: this.strokeLevel * (0.025 + 0.008 * Math.sin(time * 3.2)), comfort: this.comfort,
      farewell: this.farewell, farewellX: this.farewellX, farewellY: this.farewellY,
      lookX: this.lookX * (1 - this.farewell) + this.farewellX * 0.55,
      lookY: this.lookY * (1 - this.farewell) + this.farewellY * 0.45, attention: this.attention, noticed,
      kind: pet ? 'pet' : envelope > 0 ? this.kind : this.farewell > 0.02 ? 'farewell' : this.comfort > 0.3 ? 'content' : this.strokeLevel > 0.1 ? 'nuzzle' : squint > 0.01 ? 'squint' : this.attention > 0.1 ? 'watching' : 'rest' });
  }
}
