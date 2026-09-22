/**
 * Caliber Health Connect Web Bridge Interface
 * 
 * Interoperates with native Android window.AndroidHealthBridge (WebView interface)
 * or provides web fallback status and developer test bridge support.
 */

export class HealthConnectBridgeJS {
  static get isNativeBridgeAvailable() {
    return typeof window !== 'undefined' && !!window.AndroidHealthBridge;
  }

  /**
   * Get Health Connect availability status:
   * - 'SDK_AVAILABLE'
   * - 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED'
   * - 'SDK_UNAVAILABLE'
   */
  static async getStatus() {
    if (this.isNativeBridgeAvailable) {
      try {
        const status = window.AndroidHealthBridge.getHealthConnectStatus();
        return status || 'SDK_UNAVAILABLE';
      } catch (e) {
        console.warn('Error reading AndroidHealthBridge status:', e);
        return 'SDK_UNAVAILABLE';
      }
    }

    // Check if user enabled simulated dev mode in web browser
    if (typeof localStorage !== 'undefined' && localStorage.getItem('caliber_simulated_health_connect') === 'true') {
      return 'SDK_AVAILABLE';
    }

    // Default status in standard web browser
    return 'SDK_UNAVAILABLE';
  }

  /**
   * Check if android.permission.health.READ_STEPS is granted
   */
  static async checkPermission() {
    if (this.isNativeBridgeAvailable) {
      try {
        return !!window.AndroidHealthBridge.checkPermission();
      } catch (e) {
        console.warn('Error checking Health Connect permission:', e);
        return false;
      }
    }

    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('caliber_simulated_health_connect') === 'true') {
        return localStorage.getItem('caliber_simulated_permission_granted') !== 'false';
      }
    }

    return false;
  }

  /**
   * Trigger Health Connect permission request flow
   */
  static async requestPermission() {
    if (this.isNativeBridgeAvailable) {
      try {
        window.AndroidHealthBridge.requestPermission();
        return true;
      } catch (e) {
        console.error('Error requesting Health Connect permission:', e);
        return false;
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('caliber_simulated_health_connect', 'true');
      localStorage.setItem('caliber_simulated_permission_granted', 'true');
      return true;
    }

    return false;
  }

  /**
   * Query today's aggregated step count (StepsRecord.COUNT_TOTAL from local start of day)
   */
  static async getTodaySteps() {
    if (this.isNativeBridgeAvailable) {
      try {
        const steps = window.AndroidHealthBridge.getTodaySteps();
        return typeof steps === 'number' ? Math.max(0, steps) : parseInt(steps, 10) || 0;
      } catch (e) {
        console.warn('Error getting today steps from AndroidHealthBridge:', e);
        return 0;
      }
    }

    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge) {
      try {
        const steps = bridge.getTodaySteps ? bridge.getTodaySteps() : (bridge.getHealthConnectTodaySteps ? bridge.getHealthConnectTodaySteps() : 0);
        return typeof steps === 'number' ? Math.max(0, steps) : parseInt(steps, 10) || 0;
      } catch (e) {
        console.warn('Error getting today steps from Android native bridge:', e);
        return 0;
      }
    }

    return 0;
  }

  /**
   * Query historical daily aggregated steps
   * returns array of { date: 'YYYY-MM-DD', steps: number }
   */
  static async getStepHistory(days = 30) {
    const bridge = window.CaliberNativeSteps || window.AndroidHealthBridge;
    if (bridge && typeof bridge.getStepHistory === 'function') {
      try {
        const jsonStr = bridge.getStepHistory(days);
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Error fetching step history from Android native bridge:', e);
      }
    }

    return [];
  }
}
