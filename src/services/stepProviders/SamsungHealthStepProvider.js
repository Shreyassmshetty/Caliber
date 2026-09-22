/**
 * SamsungHealthStepProvider.js
 * Priority 3 Provider for Samsung smartphones running Samsung Health.
 * Integrates with Samsung Health Data SDK to fetch unified daily aggregated steps
 * (merging Galaxy Watch + phone motion sensors to avoid double counting).
 */

export class SamsungHealthStepProvider {
  constructor() {
    this.id = 'samsung_health';
    this.name = 'Samsung Health';
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

    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge && typeof bridge.isSamsungHealthAvailable === 'function') {
      try {
        return bridge.isSamsungHealthAvailable();
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async checkPermission() {
    if (typeof window === 'undefined') return 'UNSUPPORTED';

    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge && typeof bridge.checkSamsungHealthPermission === 'function') {
      try {
        const granted = bridge.checkSamsungHealthPermission();
        return granted ? 'GRANTED' : 'DENIED';
      } catch (e) {
        return 'DENIED';
      }
    }
    return 'DENIED';
  }

  async requestPermission() {
    if (typeof window === 'undefined') return false;

    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge && typeof bridge.requestSamsungHealthPermission === 'function') {
      try {
        return bridge.requestSamsungHealthPermission();
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  async getTodaySteps() {
    if (typeof window === 'undefined') return 0;

    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (!bridge || typeof bridge.getSamsungHealthSteps !== 'function') {
      return 0;
    }

    try {
      const dateStr = this.getTodayDateString();
      const res = bridge.getSamsungHealthSteps(dateStr);
      const steps = typeof res === 'string' ? parseInt(res, 10) : Number(res);
      return Math.max(0, steps || 0);
    } catch (e) {
      console.warn('Error reading Samsung Health steps:', e);
      return 0;
    }
  }

  getDiagnostics() {
    const bridge = typeof window !== 'undefined' ? (window.CaliberNativeSteps || window.AndroidHealthBridge) : null;
    return {
      providerId: this.id,
      name: this.name,
      sdkStatus: bridge ? 'BRIDGE_CONNECTED' : 'NO_NATIVE_BRIDGE',
      aggregatedSources: 'Phone + Galaxy Wearable (Unified)'
    };
  }
}
