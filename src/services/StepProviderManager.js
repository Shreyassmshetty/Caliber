/**
 * StepProviderManager.js
 * Central Orchestrator & Selector for Multi-Source Step Tracking in Caliber.
 * Priority Chain:
 * Priority 1: Health Connect (Android)
 * Priority 2: Android Hardware TYPE_STEP_COUNTER Sensor
 * Priority 3: Samsung Health SDK
 * Priority 4: Browser Motion Accelerometer Sensor
 *
 * Rules:
 * 1. Single Source of Truth - Never sums steps from different providers together.
 * 2. Session Baselines - Transitioning providers maintains non-overlapping baseline.
 * 3. Zero Mock/Fake Generation - Reports 'UNAVAILABLE' if no hardware/sensor is present.
 */

import { HealthConnectStepProvider } from './stepProviders/HealthConnectStepProvider';
import { AndroidStepCounterProvider } from './stepProviders/AndroidStepCounterProvider';
import { SamsungHealthStepProvider } from './stepProviders/SamsungHealthStepProvider';
import { BrowserMotionStepProvider } from './stepProviders/BrowserMotionStepProvider';

export class StepProviderManager {
  constructor() {
    this.healthConnect = new HealthConnectStepProvider();
    this.androidStepCounter = new AndroidStepCounterProvider();
    this.samsungHealth = new SamsungHealthStepProvider();
    this.browserMotion = new BrowserMotionStepProvider();

    this.providers = [
      this.healthConnect,
      this.androidStepCounter,
      this.samsungHealth,
      this.browserMotion
    ];

    this.activeProvider = null;
    this.forcedProviderId = null;
    this.initialized = false;
    this.statusMessage = 'Initializing Step Tracking...';

    // Session Baseline Tracking for mid-day provider switching
    this.sessionBaseline = {
      dateStr: this.getTodayDateString(),
      providerId: null,
      providerStartStepCount: 0,
      priorStepsBaseline: 0
    };

    this.loadSessionBaseline();
  }

  getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadSessionBaseline() {
    const today = this.getTodayDateString();
    try {
      const saved = localStorage.getItem(`caliber_step_baseline_${today}`);
      if (saved) {
        this.sessionBaseline = JSON.parse(saved);
      } else {
        this.sessionBaseline = {
          dateStr: today,
          providerId: null,
          providerStartStepCount: 0,
          priorStepsBaseline: 0
        };
      }
    } catch (e) {
      this.sessionBaseline = {
        dateStr: today,
        providerId: null,
        providerStartStepCount: 0,
        priorStepsBaseline: 0
      };
    }
  }

  saveSessionBaseline() {
    try {
      localStorage.setItem(`caliber_step_baseline_${this.sessionBaseline.dateStr}`, JSON.stringify(this.sessionBaseline));
    } catch (e) {}
  }

  async initialize() {
    const today = this.getTodayDateString();
    if (this.sessionBaseline.dateStr !== today) {
      this.sessionBaseline = {
        dateStr: today,
        providerId: null,
        providerStartStepCount: 0,
        priorStepsBaseline: 0
      };
      this.saveSessionBaseline();
    }

    // Check forced override first (for development/debug)
    if (this.forcedProviderId) {
      const forced = this.providers.find(p => p.id === this.forcedProviderId);
      if (forced) {
        this.activeProvider = forced;
        this.statusMessage = `Using ${forced.name} (Forced Override)`;
        this.initialized = true;
        return this.activeProvider;
      }
    }

    // Priority 1: Health Connect
    if (await this.healthConnect.isAvailable()) {
      const perm = await this.healthConnect.checkPermission();
      if (perm === 'GRANTED') {
        this.setActiveProvider(this.healthConnect, 'Connected to Health Connect');
        this.initialized = true;
        return this.healthConnect;
      }
    }

    // Priority 2: Android Hardware TYPE_STEP_COUNTER
    if (await this.androidStepCounter.isAvailable()) {
      const perm = await this.androidStepCounter.checkPermission();
      if (perm === 'GRANTED') {
        this.setActiveProvider(this.androidStepCounter, 'Using Android Step Counter');
        this.initialized = true;
        return this.androidStepCounter;
      }
    }

    // Priority 3: Samsung Health
    if (await this.samsungHealth.isAvailable()) {
      const perm = await this.samsungHealth.checkPermission();
      if (perm === 'GRANTED') {
        this.setActiveProvider(this.samsungHealth, 'Using Samsung Health');
        this.initialized = true;
        return this.samsungHealth;
      }
    }

    // Priority 4: Browser Motion Sensor (PWA Accelerometer)
    if (await this.browserMotion.isAvailable()) {
      this.setActiveProvider(this.browserMotion, 'Using Phone Motion Sensor');
      this.initialized = true;
      return this.browserMotion;
    }

    // Provider Unavailable
    this.activeProvider = null;
    this.statusMessage = 'Step tracking is unavailable on this device';
    this.initialized = true;
    return null;
  }

  async setActiveProvider(provider, statusMsg) {
    const today = this.getTodayDateString();

    // Handle session baseline when changing provider mid-day
    if (this.activeProvider && this.activeProvider.id !== provider.id) {
      const currentSteps = await this.getTodaySteps();
      const newProviderRawSteps = await provider.getTodaySteps();

      this.sessionBaseline = {
        dateStr: today,
        providerId: provider.id,
        providerStartStepCount: newProviderRawSteps,
        priorStepsBaseline: currentSteps
      };
      this.saveSessionBaseline();
    }

    this.activeProvider = provider;
    this.statusMessage = statusMsg;

    // Start tracking if it's browser motion sensor
    if (provider.id === 'browser_motion') {
      await provider.start();
    }
  }

  forceProvider(providerId) {
    this.forcedProviderId = providerId;
    this.initialize();
  }

  async getTodaySteps() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.activeProvider) {
      return 0;
    }

    let rawSteps = 0;
    if (this.activeProvider.getTodaySteps) {
      rawSteps = await this.activeProvider.getTodaySteps();
    } else if (this.activeProvider.getCurrentSteps) {
      rawSteps = this.activeProvider.getCurrentSteps();
    }

    // If active provider matches session baseline provider, apply transition offset
    if (this.sessionBaseline.providerId === this.activeProvider.id && this.sessionBaseline.dateStr === this.getTodayDateString()) {
      const stepsSinceSwitch = Math.max(0, rawSteps - this.sessionBaseline.providerStartStepCount);
      return Math.max(0, this.sessionBaseline.priorStepsBaseline + stepsSinceSwitch);
    }

    return Math.max(0, rawSteps);
  }

  getStatusMessage() {
    if (!this.activeProvider) {
      return 'Step tracking is unavailable on this device';
    }
    return this.statusMessage;
  }

  getActiveProviderInfo() {
    if (!this.activeProvider) {
      return {
        id: 'none',
        name: 'None',
        available: false,
        status: 'UNAVAILABLE'
      };
    }
    return {
      id: this.activeProvider.id,
      name: this.activeProvider.name,
      available: true,
      status: this.statusMessage
    };
  }

  async startTracking() {
    if (this.activeProvider && this.activeProvider.start) {
      return await this.activeProvider.start();
    }
    return true;
  }

  stopTracking() {
    if (this.activeProvider && this.activeProvider.stop) {
      this.activeProvider.stop();
    }
  }

  async getDiagnostics() {
    const today = this.getTodayDateString();
    const activeSteps = await this.getTodaySteps();

    const providerAvailability = {
      healthConnect: await this.healthConnect.isAvailable(),
      androidStepCounter: await this.androidStepCounter.isAvailable(),
      samsungHealth: await this.samsungHealth.isAvailable(),
      browserMotion: await this.browserMotion.isAvailable()
    };

    const browserMotionDetails = this.browserMotion.getDiagnostics();
    const androidStepCounterDetails = this.androidStepCounter.getDiagnostics();

    return {
      activeProvider: this.getActiveProviderInfo(),
      providerAvailability,
      todayCalculatedSteps: activeSteps,
      sessionBaseline: this.sessionBaseline,
      forcedOverride: this.forcedProviderId,
      browserMotion: browserMotionDetails,
      androidStepCounter: androidStepCounterDetails,
      dateStr: today
    };
  }
}

// Singleton export
export const stepProviderManager = new StepProviderManager();
