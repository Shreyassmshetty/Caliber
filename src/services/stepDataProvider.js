import { HealthConnectBridgeJS } from './healthConnectBridge';
import { stepProviderManager } from './StepProviderManager';

/**
 * HealthConnectStepProvider / Unified Step Provider facade
 * Single source of truth for step counts in Caliber via StepProviderManager.
 * NO GPS DISTANCE-TO-STEP CONVERSION.
 */
export class HealthConnectStepProvider {
  /**
   * Get availability status of Health Connect or active provider
   */
  static async getAvailability() {
    return await HealthConnectBridgeJS.getStatus();
  }

  static async checkPermission() {
    return await HealthConnectBridgeJS.checkPermission();
  }

  static async requestPermission() {
    return await HealthConnectBridgeJS.requestPermission();
  }

  /**
   * Fetch today's aggregated step count using StepProviderManager active provider
   */
  static async getTodaySteps() {
    return await stepProviderManager.getTodaySteps();
  }

  static async getStepHistory(days = 30) {
    return await HealthConnectBridgeJS.getStepHistory(days);
  }

  static calculateDistance(steps, userHeightCm = 175) {
    const safeSteps = Math.max(0, Number(steps) || 0);
    const heightMeters = (userHeightCm && userHeightCm > 100) ? (userHeightCm / 100) : 1.75;
    const strideLengthMeters = heightMeters * 0.414;
    const totalMeters = safeSteps * strideLengthMeters;
    return parseFloat((totalMeters / 1000).toFixed(2));
  }

  static calculateCalories(steps, userWeightKg = 70) {
    const safeSteps = Math.max(0, Number(steps) || 0);
    const weightFactor = (userWeightKg && userWeightKg > 30) ? (userWeightKg / 70) : 1.0;
    const caloriesPerStep = 0.04 * weightFactor;
    return Math.round(safeSteps * caloriesPerStep);
  }

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
    const providerInfo = stepProviderManager.getActiveProviderInfo();
    const source = providerInfo.id || 'health_connect';

    const stepData = {
      dateStr,
      steps,
      goal,
      distanceKm,
      calories,
      source,
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
          calories,
          source
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
