/**
 * AndroidStepCounterProvider.js
 * Priority 2 Provider for Android devices using native hardware Sensor.TYPE_STEP_COUNTER.
 * Communicates with native Android SensorManager via JavascriptInterface.
 * Features:
 * - Low-power hardware step counter
 * - Cumulative sensor baseline calculation (Current - InitialBaseline)
 * - Safe device reboot handling (resets baseline on sensor reset/reboot)
 * - Safe daily reset at midnight
 * - Prevents negative values and step jumps
 */

export class AndroidStepCounterProvider {
  constructor() {
    this.id = 'android_step_counter';
    this.name = 'Android Hardware Step Counter';
    this.dateStr = this.getTodayDateString();
  }

  getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async isAvailable() {
    if (typeof window === 'undefined') return false;
    
    // Check if native Android bridge exposes hardware step counter
    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge && typeof bridge.isHardwareStepCounterAvailable === 'function') {
      try {
        return bridge.isHardwareStepCounterAvailable();
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async checkPermission() {
    if (typeof window === 'undefined') return 'UNSUPPORTED';
    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge && typeof bridge.checkActivityRecognitionPermission === 'function') {
      try {
        const granted = bridge.checkActivityRecognitionPermission();
        return granted ? 'GRANTED' : 'DENIED';
      } catch (e) {
        return 'DENIED';
      }
    }
    return 'GRANTED';
  }

  async requestPermission() {
    if (typeof window === 'undefined') return false;
    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge && typeof bridge.requestActivityRecognitionPermission === 'function') {
      try {
        return bridge.requestActivityRecognitionPermission();
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  async getTodaySteps() {
    if (typeof window === 'undefined') return 0;

    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (!bridge || typeof bridge.getHardwareStepCount !== 'function') {
      return 0;
    }

    try {
      // Returns JSON or string containing: { cumulativeSteps, dailySteps, baseline, lastSensorRead }
      const res = bridge.getHardwareStepCount(this.getTodayDateString());
      let parsed = typeof res === 'string' ? JSON.parse(res) : res;
      
      if (parsed && typeof parsed.dailySteps === 'number') {
        return Math.max(0, parsed.dailySteps);
      }
      return 0;
    } catch (e) {
      console.warn('Error reading Android hardware step counter:', e);
      return 0;
    }
  }

  getDiagnostics() {
    const bridge = typeof window !== 'undefined' ? (window.CaliberNativeSteps || window.AndroidHealthBridge) : null;
    let rawSensorValue = 0;
    let baseline = 0;

    if (bridge && typeof bridge.getHardwareStepCount === 'function') {
      try {
        const res = bridge.getHardwareStepCount(this.getTodayDateString());
        const parsed = typeof res === 'string' ? JSON.parse(res) : res;
        if (parsed) {
          rawSensorValue = parsed.cumulativeSteps || 0;
          baseline = parsed.baseline || 0;
        }
      } catch (e) {}
    }

    return {
      providerId: this.id,
      name: this.name,
      sensorType: 'Sensor.TYPE_STEP_COUNTER',
      rawSensorValue,
      baseline,
      bridgeAvailable: Boolean(bridge)
    };
  }
}
