import { HealthConnectBridgeJS } from './healthConnectBridge';

/**
 * HealthConnectStepProvider
 * Single source of truth for step counts in Caliber via Android Health Connect.
 * Uses StepsRecord aggregation to eliminate double-counting across devices.
 * NO GPS DISTANCE-TO-STEP CONVERSION.
 */
export class HealthConnectStepProvider {
  /**
   * Get availability status of Health Connect
   * Returns: 'SDK_AVAILABLE' | 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED' | 'SDK_UNAVAILABLE'
   */
  static async getAvailability() {
    return await HealthConnectBridgeJS.getStatus();
  }

  /**
   * Check if android.permission.health.READ_STEPS is granted
   */
  static async checkPermission() {
    return await HealthConnectBridgeJS.checkPermission();
  }

  /**
   * Request Health Connect permission
   */
  static async requestPermission() {
    return await HealthConnectBridgeJS.requestPermission();
  }

  /**
   * Fetch today's aggregated step count from Health Connect
   */
  static async getTodaySteps() {
    return await HealthConnectBridgeJS.getTodaySteps();
  }

  /**
   * Fetch historical daily aggregated steps
   * @param {number} days
   * @returns {Promise<Array<{date: string, steps: number}>>}
   */
  static async getStepHistory(days = 30) {
    return await HealthConnectBridgeJS.getStepHistory(days);
  }

  /**
   * Calculate estimated distance in kilometers based on step count and user height
   * Stride length ≈ height * 0.414 (or default 0.75m)
   * Labeled "Estimated distance"
   */
  static calculateDistance(steps, userHeightCm = 175) {
    const safeSteps = Math.max(0, Number(steps) || 0);
    const heightMeters = (userHeightCm && userHeightCm > 100) ? (userHeightCm / 100) : 1.75;
    const strideLengthMeters = heightMeters * 0.414; // Average human walking stride multiplier
    const totalMeters = safeSteps * strideLengthMeters;
    return parseFloat((totalMeters / 1000).toFixed(2));
  }

  /**
   * Calculate estimated active calories burned based on step count and user weight
   * Burn ≈ 0.04 kcal per step for average 70kg adult
   * Labeled "Estimated calories"
   */
  static calculateCalories(steps, userWeightKg = 70) {
    const safeSteps = Math.max(0, Number(steps) || 0);
    const weightFactor = (userWeightKg && userWeightKg > 30) ? (userWeightKg / 70) : 1.0;
    const caloriesPerStep = 0.04 * weightFactor;
    return Math.round(safeSteps * caloriesPerStep);
  }

  /**
   * Sync Health Connect step count into Caliber backend database (/api/steps/sync)
   */
  static async syncWithServer(dateStr, steps, goal = 10000, userProfile = null, token = null, apiBase = '') {
    if (!token) {
      if (typeof localStorage !== 'undefined') {
        token = localStorage.getItem('cnt_token');
      }
    }
    if (!dateStr) return null;

    const heightCm = userProfile?.height || 175;
    const weightKg = userProfile?.weight || 70;

    const distanceKm = this.calculateDistance(steps, heightCm);
    const calories = this.calculateCalories(steps, weightKg);

    const stepData = {
      dateStr,
      steps,
      goal,
      distanceKm,
      calories,
      updatedAt: new Date().toISOString()
    };

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`caliber_steps_${dateStr}`, JSON.stringify(stepData));
      } catch (e) {}
    }

    if (!token || token.startsWith('local_token_')) {
      return stepData;
    }

    try {
      const baseUrl = apiBase || (typeof window !== 'undefined' ? window.location.origin : '');
      const response = await fetch(`${baseUrl}/api/steps/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dateStr,
          steps,
          goal,
          distanceKm,
          calories
        })
      });

      if (response.ok) {
        const serverData = await response.json();
        return serverData;
      }
    } catch (e) {
      console.warn('Syncing steps with server deferred (offline or network issue):', e.message || e);
    }
    return stepData;
  }
}
