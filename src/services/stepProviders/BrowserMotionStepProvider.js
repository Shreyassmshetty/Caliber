/**
 * BrowserMotionStepProvider.js
 * Hardware Accelerometer-based Step Detector for Browser & PWA environments.
 * Uses DeviceMotionEvent with signal processing:
 * 1. Gravity estimation (Low-pass filter)
 * 2. Linear acceleration magnitude calculation
 * 3. Exponential moving average smoothing
 * 4. Adaptive thresholding & noise calibration
 * 5. Cadence validation (250ms - 1200ms) to reject single bumps/shakes
 */

export class BrowserMotionStepProvider {
  constructor() {
    this.id = 'browser_motion';
    this.name = 'Phone Motion Sensor';
    this.isListening = false;
    this.isPaused = false;
    
    // State
    this.stepCount = 0;
    this.dateStr = this.getTodayDateString();
    
    // Sensor Filter Variables
    this.gravity = { x: 0, y: 0, z: 9.81 };
    this.alpha = 0.8; // Low pass filter weight for gravity
    
    // Buffer & Moving Average
    this.smoothMagnitude = 0;
    this.smoothAlpha = 0.35; // Exponential moving average coefficient
    this.magnitudeHistory = [];
    this.maxHistoryLength = 50;

    // Calibration
    this.isCalibrating = true;
    this.calibrationSamples = [];
    this.calibrationTargetCount = 30; // ~1-2 seconds of sensor events
    this.noiseLevel = 0.5;
    this.adaptiveThreshold = 1.8; // Dynamic threshold above gravity-free baseline (m/s²)
    this.sensitivityMode = 'NORMAL'; // 'LOW', 'NORMAL', 'HIGH'

    // Peak & Step Validation
    this.lastPeakTime = 0;
    this.lastPeakMagnitude = 0;
    this.minStepIntervalMs = 280;  // Max cadence ~214 steps/min (fast run)
    this.maxStepIntervalMs = 1200; // Min cadence ~50 steps/min (slow walk)
    
    // Consecutive step rhythm validation to reject isolated bumps/shakes
    this.candidateStepTimes = [];
    this.minRhythmicSteps = 2; // Need 2 rhythmic peaks before trusting steps

    // Real-time Diagnostics for Developer Panel
    this.diagnostics = {
      rawAcc: { x: 0, y: 0, z: 0 },
      gravity: { x: 0, y: 0, z: 0 },
      linearMag: 0,
      smoothMag: 0,
      adaptiveThreshold: 1.8,
      noiseLevel: 0.5,
      isCalibrating: true,
      lastStepCadenceBpm: 0,
      peakCandidates: 0,
      rejectedSpikes: 0,
      status: 'IDLE'
    };

    // Binding
    this.handleMotionEvent = this.handleMotionEvent.bind(this);
    
    // Restore saved steps for today
    this.loadSavedSteps();
  }

  getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadSavedSteps() {
    this.dateStr = this.getTodayDateString();
    try {
      const saved = localStorage.getItem(`caliber_motion_steps_${this.dateStr}`);
      if (saved !== null) {
        this.stepCount = Math.max(0, parseInt(saved, 10) || 0);
      }
    } catch (e) {
      this.stepCount = 0;
    }
  }

  saveSteps() {
    try {
      localStorage.setItem(`caliber_motion_steps_${this.dateStr}`, String(this.stepCount));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('caliber-step-event', { detail: { steps: this.stepCount } }));
      }
    } catch (e) {}
  }

  async isAvailable() {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return false;
    }
    return true;
  }

  async checkPermission() {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return 'UNSUPPORTED';
    }
    
    // iOS 13+ requires explicit permission request
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const state = await DeviceMotionEvent.requestPermission();
        return state === 'granted' ? 'GRANTED' : 'DENIED';
      } catch (e) {
        return 'DENIED';
      }
    }
    
    return 'GRANTED';
  }

  async requestPermission() {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return false;
    }

    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        return permission === 'granted';
      } catch (e) {
        return false;
      }
    }

    return true;
  }

  async start() {
    if (this.isListening) return true;
    
    const available = await this.isAvailable();
    if (!available) {
      this.diagnostics.status = 'UNSUPPORTED';
      return false;
    }

    const permitted = await this.requestPermission();
    if (!permitted) {
      this.diagnostics.status = 'PERMISSION_DENIED';
      return false;
    }

    this.loadSavedSteps();
    this.isListening = true;
    this.isPaused = false;
    this.isCalibrating = true;
    this.calibrationSamples = [];
    this.diagnostics.status = 'TRACKING';

    window.addEventListener('devicemotion', this.handleMotionEvent, true);
    return true;
  }

  stop() {
    if (!this.isListening) return;
    this.isListening = false;
    this.isPaused = false;
    this.diagnostics.status = 'STOPPED';
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleMotionEvent, true);
    }
  }

  pause() {
    this.isPaused = true;
    this.diagnostics.status = 'PAUSED';
  }

  resume() {
    this.isPaused = false;
    this.diagnostics.status = 'TRACKING';
  }

  reset() {
    this.stepCount = 0;
    this.saveSteps();
    this.candidateStepTimes = [];
    this.lastPeakTime = 0;
  }

  setSensitivity(mode = 'NORMAL') {
    this.sensitivityMode = mode;
    this.updateAdaptiveThreshold();
  }

  updateAdaptiveThreshold() {
    let multiplier = 1.0;
    if (this.sensitivityMode === 'HIGH') multiplier = 0.75;
    if (this.sensitivityMode === 'LOW') multiplier = 1.35;

    // Threshold = baseline noise floor + dynamic margin (clamped between 1.2 m/s² and 4.0 m/s²)
    const dynamicMargin = Math.max(1.1, this.noiseLevel * 2.2) * multiplier;
    this.adaptiveThreshold = Math.min(4.0, Math.max(1.2, dynamicMargin));
    this.diagnostics.adaptiveThreshold = parseFloat(this.adaptiveThreshold.toFixed(2));
  }

  handleMotionEvent(event) {
    if (!this.isListening || this.isPaused) return;

    // Prefer accelerationIncludingGravity if available
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const rx = acc.x || 0;
    const ry = acc.y || 0;
    const rz = acc.z || 0;

    this.diagnostics.rawAcc = { x: rx, y: ry, z: rz };

    // 1. Low-Pass Filter to estimate Gravity Component
    this.gravity.x = this.alpha * this.gravity.x + (1 - this.alpha) * rx;
    this.gravity.y = this.alpha * this.gravity.y + (1 - this.alpha) * ry;
    this.gravity.z = this.alpha * this.gravity.z + (1 - this.alpha) * rz;

    this.diagnostics.gravity = {
      x: parseFloat(this.gravity.x.toFixed(2)),
      y: parseFloat(this.gravity.y.toFixed(2)),
      z: parseFloat(this.gravity.z.toFixed(2))
    };

    // 2. Linear Acceleration Magnitude (gravity subtracted)
    const lx = rx - this.gravity.x;
    const ly = ry - this.gravity.y;
    const lz = rz - this.gravity.z;

    const linearMag = Math.sqrt(lx * lx + ly * ly + lz * lz);
    this.diagnostics.linearMag = parseFloat(linearMag.toFixed(2));

    // 3. Calibration Phase
    if (this.isCalibrating) {
      this.calibrationSamples.push(linearMag);
      if (this.calibrationSamples.length >= this.calibrationTargetCount) {
        const mean = this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
        const variance = this.calibrationSamples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.calibrationSamples.length;
        this.noiseLevel = Math.sqrt(variance);
        this.diagnostics.noiseLevel = parseFloat(this.noiseLevel.toFixed(2));
        this.updateAdaptiveThreshold();
        this.isCalibrating = false;
        this.diagnostics.isCalibrating = false;
      }
      return;
    }

    // 4. Exponential Moving Average Smoothing
    this.smoothMagnitude = (this.smoothAlpha * linearMag) + ((1 - this.smoothAlpha) * this.smoothMagnitude);
    this.diagnostics.smoothMag = parseFloat(this.smoothMagnitude.toFixed(2));

    // Maintain history buffer
    this.magnitudeHistory.push(this.smoothMagnitude);
    if (this.magnitudeHistory.length > this.maxHistoryLength) {
      this.magnitudeHistory.shift();
    }

    // Need at least 3 samples to detect local peak
    const len = this.magnitudeHistory.length;
    if (len < 3) return;

    const prev2 = this.magnitudeHistory[len - 3];
    const prev1 = this.magnitudeHistory[len - 2];
    const current = this.magnitudeHistory[len - 1];

    // 5. Local Peak Detection (prev1 is a peak if it is strictly higher than prev2 and current)
    const isPeak = (prev1 > prev2) && (prev1 > current) && (prev1 >= this.adaptiveThreshold);

    if (isPeak) {
      const now = Date.now();
      const interval = now - this.lastPeakTime;
      this.diagnostics.peakCandidates++;

      // Check Cadence constraint (between 280ms and 1200ms per step)
      if (interval >= this.minStepIntervalMs && interval <= this.maxStepIntervalMs) {
        // Cadence in Steps/Min
        const cadenceBpm = Math.round(60000 / interval);
        this.diagnostics.lastStepCadenceBpm = cadenceBpm;

        // Rhythm validation to reject single isolated spikes (shaking/tapping)
        this.candidateStepTimes.push(now);
        if (this.candidateStepTimes.length > 5) this.candidateStepTimes.shift();

        if (this.candidateStepTimes.length >= this.minRhythmicSteps) {
          this.stepCount++;
          this.saveSteps();
          this.lastPeakTime = now;
          this.lastPeakMagnitude = prev1;
        }
      } else if (interval > this.maxStepIntervalMs) {
        // First step after a pause or initial step
        this.candidateStepTimes = [now];
        this.lastPeakTime = now;
        this.lastPeakMagnitude = prev1;
      } else {
        // Spike too fast (<280ms) -> Reject isolated noise spike
        this.diagnostics.rejectedSpikes++;
      }
    }
  }

  getCurrentSteps() {
    // Check if day changed
    const today = this.getTodayDateString();
    if (this.dateStr !== today) {
      this.dateStr = today;
      this.stepCount = 0;
      this.saveSteps();
    }
    return this.stepCount;
  }

  getDiagnostics() {
    return {
      ...this.diagnostics,
      stepCount: this.stepCount,
      isListening: this.isListening,
      isPaused: this.isPaused,
      dateStr: this.dateStr
    };
  }
}
