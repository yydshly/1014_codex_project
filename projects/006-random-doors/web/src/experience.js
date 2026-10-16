export const WEATHERS = Object.freeze([
  Object.freeze({ id: 'dusk-rain', name: '黄昏细雨', description: '天还留着一点暖色，细雨落在檐外。', top: '#304f61', horizon: '#c99b88', sea: '#325c62', fog: '#899794', rain: 0.7, wind: 0.16, ambient: 1.6, sun: 1.35, exposure: 1.03, fogDensity: 0.008, dripInterval: 0.12 }),
  Object.freeze({ id: 'night-rain', name: '入夜微雨', description: '海暗了下来，亭里的灯还亮着。', top: '#081924', horizon: '#294957', sea: '#143740', fog: '#243f49', rain: 1, wind: 0.26, ambient: 0.85, sun: 0.4, exposure: 1.13, fogDensity: 0.011, dripInterval: 0.095 }),
  Object.freeze({ id: 'after-rain', name: '雨歇薄雾', description: '雨停了，屋檐还在滴水，海雾正慢慢散开。', top: '#536d77', horizon: '#c4c2ac', sea: '#476f70', fog: '#a7b6b2', rain: 0, wind: 0.07, ambient: 2.1, sun: 1.8, exposure: 0.98, fogDensity: 0.016, dripInterval: 0.3 }),
]);

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEncounter({ previousWeather = '', requestedWeather = 'random', seed = Math.floor(Math.random() * 0xffffffff) } = {}) {
  const random = seededRandom(seed);
  const forced = WEATHERS.find(weather => weather.id === requestedWeather);
  const candidates = WEATHERS.filter(weather => weather.id !== previousWeather);
  const weather = forced ?? candidates[Math.floor(random() * candidates.length)];
  return { version: 1, seed: seed >>> 0, weatherId: weather.id, boatDelay: 65 + random() * 20, boatDuration: 72 };
}

export function validEncounter(value) {
  return value?.version === 1 && Number.isInteger(value.seed) && value.seed >= 0 && value.seed <= 0xffffffff
    && WEATHERS.some(weather => weather.id === value.weatherId)
    && Number.isFinite(value.boatDelay) && value.boatDelay >= 0 && value.boatDelay <= 85
    && value.boatDuration === 72;
}

export class Experience {
  constructor(encounter) { this.reset(encounter); }
  reset(encounter) {
    if (!validEncounter(encounter)) throw new Error('无法读取这次遇见。');
    this.encounter = { ...encounter };
    this.elapsed = 0;
    this.inside = false;
    this.seated = false;
    this.catching = false;
    this.contactCount = 0;
    this.earlyBoatAt = null;
  }
  get weather() { return WEATHERS.find(weather => weather.id === this.encounter.weatherId); }
  enter() { this.inside = true; }
  advance(seconds) { if (this.inside && Number.isFinite(seconds) && seconds > 0) this.elapsed += seconds; }
  get boatProgress() {
    const start = this.earlyBoatAt ?? this.encounter.boatDelay;
    return Math.max(0, Math.min(1, (this.elapsed - start) / this.encounter.boatDuration));
  }
  get boatVisible() { return this.boatProgress > 0 && this.boatProgress < 1; }
  inviteBoat() { if (this.inside) this.earlyBoatAt = this.elapsed - 5; }
  snapshot() { return { ...this.encounter }; }
}
