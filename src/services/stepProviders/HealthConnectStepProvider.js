/**
 * HealthConnectStepProvider.js
 * Priority 1 Provider for Android devices supporting Android Health Connect.
 * Uses HealthConnectClient & StepsRecord aggregation for accurate daily step totals.
 */

import { HealthConnectBridgeJS } from '../healthConnectBridge';

export class HealthConnectStepProvider {
  constructor() {
    this.id = 'health_connect';
    this.name = 'Android Health Connect';
  }

  async isAvailable() {
    try {
      const status = await HealthConnectBridgeJS.getStatus();
      return status === 'SDK_AVAILABLE';
    } catch (e) {
      return false;
    }
  }

  async checkPermission() {
    try {
      const granted = await HealthConnectBridgeJS.checkPermission();
      return granted ? 'GRANTED' : 'DENIED';
    } catch (e) {
      return 'DENIED';
    }
  }

  async requestPermission() {
    try {
      return await HealthConnectBridgeJS.requestPermission();
    } catch (e) {
      return false;
    }
  }

  async getTodaySteps() {
    try {
      const steps = await HealthConnectBridgeJS.getTodaySteps();
      return Math.max(0, Number(steps) || 0);
    } catch (e) {
      return 0;
    }
  }

  async getStepHistory(days = 7) {
    try {
      return await HealthConnectBridgeJS.getStepHistory(days);
    } catch (e) {
      return [];
    }
  }

  getDiagnostics() {
    return {
      providerId: this.id,
      name: this.name,
      sdkStatus: 'CHECKING'
    };
  }
}
