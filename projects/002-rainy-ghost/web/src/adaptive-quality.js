// Device pairs are [desktop, mobile]. Core lighting and cloth material stay fixed.
const TIERS = [
  { id: 'fluid', label: '流畅', pixelRatio: [0.9, 0.75], pixels: [850000, 320000], reflection: [384, 256], reflectionHz: [24, 18], rain: [900, 650], bloom: 0.35, waterDetail: 0, clothHz: [30, 24], collisionHz: [30, 24] },
  { id: 'balanced', label: '均衡', pixelRatio: [1.25, 1], pixels: [1500000, 500000], reflection: [512, 512], reflectionHz: [30, 24], rain: [1300, 1000], bloom: 0.5, waterDetail: 1, clothHz: [45, 30], collisionHz: [30, 30] },
  { id: 'high', label: '细腻', pixelRatio: [1.75, 1.35], pixels: [2600000, 800000], reflection: [1024, 512], reflectionHz: [60, 30], rain: [1800, 1400], bloom: null, waterDetail: 2, clothHz: [60, 45], collisionHz: [60, 30] },
];

export function qualitySettings(level, mobile, width, height, nativePixelRatio = 1) {
  const tier = TIERS[level];
  const device = mobile ? 1 : 0;
  return {
    id: tier.id, label: tier.label,
    pixelRatio: Math.min(nativePixelRatio, tier.pixelRatio[device], Math.sqrt(tier.pixels[device] / Math.max(1, width * height))),
    reflectionSize: tier.reflection[device], reflectionHz: tier.reflectionHz[device],
    rainCount: tier.rain[device], bloomScale: tier.bloom ?? (mobile ? 0.75 : 1),
    waterDetail: tier.waterDetail, clothHz: tier.clothHz[device], collisionHz: tier.collisionHz[device],
  };
}

// Measures real RAF intervals, not the clamped simulation clock. No timers run
// while the scene is idle. Downshift quickly; require sustained headroom to rise.
export class AdaptiveQuality {
  constructor(mobile = false, now = 0) {
    this.mobile = mobile;
    this.level = mobile ? 1 : 2;
    this.changes = 0;
    this.fps = this.frameMs = this.workMs = 0;
    this.lastChange = -Infinity;
    this.upgradeBlockedUntil = now + 15000;
    this.resetMeasurements(now, 2500);
  }

  resetMeasurements(now, warmup = 1000) {
    this.previous = null;
    this.presentationClock = null;
    this.elapsed = this.frames = this.work = this.slow = 0;
    this.badTime = this.goodTime = 0;
    this.warmUntil = now + warmup;
  }

  setDevice(mobile, now) {
    const changed = this.mobile !== mobile;
    if (changed) {
      this.mobile = mobile;
      if (mobile) this.level = Math.min(1, this.level);
      this.upgradeBlockedUntil = Math.max(this.upgradeBlockedUntil, now + 15000);
    }
    this.fps = this.frameMs = this.workMs = 0;
    this.resetMeasurements(now, Math.max(1500, this.warmUntil - now));
    return changed;
  }

  shouldRender(now, playing) {
    if (!this.mobile || !playing) { this.presentationClock = null; return true; }
    if (this.presentationClock === null) { this.presentationClock = now; return true; }
    const interval = 1000 / 60;
    const elapsed = now - this.presentationClock;
    if (elapsed < interval - 0.5) return false;
    // Keep phase on 90/120/144 Hz displays; rounding each gap would cap 90 Hz
    // devices at 45 fps and incorrectly trigger a quality downgrade.
    this.presentationClock += Math.max(1, Math.floor((elapsed + 0.5) / interval)) * interval;
    return true;
  }

  sample(now, workMs, active = true) {
    if (!active) { this.resetMeasurements(now); return null; }
    const previous = this.previous;
    this.previous = now;
    if (previous === null || now < this.warmUntil) return null;
    const delta = now - previous;
    if (delta <= 0) return null;
    if (delta > 1000) { this.resetMeasurements(now); return null; }
    this.elapsed += delta;
    this.frames++;
    this.work += Math.max(0, workMs);
    if (delta > 25) this.slow++;
    if (this.elapsed < 1000) return null;

    const duration = this.elapsed;
    this.fps = this.frames * 1000 / duration;
    this.frameMs = duration / this.frames;
    this.workMs = this.work / this.frames;
    const slowRatio = this.slow / this.frames;
    this.badTime = this.fps < 48 ? this.badTime + duration : 0;
    this.goodTime = this.fps >= 57 && this.workMs < 9 && slowRatio < 0.06 ? this.goodTime + duration : 0;
    this.elapsed = this.frames = this.work = this.slow = 0;

    let reason = 'measured';
    if (this.level > 0 && (this.fps < 30 || this.badTime >= 2000) && now - this.lastChange >= 4000) {
      this.level--;
      const failedProbe = this.lastReason === 'recovered' && now - this.lastChange < 10000;
      this.upgradeBlockedUntil = now + (failedProbe ? 60000 : 20000);
      reason = 'slow';
    } else if (this.level < 2 && this.goodTime >= (this.mobile ? 20000 : 12000) && now >= this.upgradeBlockedUntil) {
      this.level++;
      reason = 'recovered';
    }
    const changed = reason !== 'measured';
    if (changed) {
      this.changes++;
      this.lastChange = now;
      this.lastReason = reason;
      this.resetMeasurements(now, 1500);
    }
    return { changed, reason, fps: this.fps, frameMs: this.frameMs, workMs: this.workMs };
  }
}
