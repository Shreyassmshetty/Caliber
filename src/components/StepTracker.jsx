import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { stepProviderManager } from '../services/StepProviderManager';
import { HealthConnectStepProvider } from '../services/stepDataProvider';
import { 
  Footprints, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Settings2, 
  Flame, 
  Navigation, 
  ChevronRight, 
  Calendar,
  Smartphone,
  ShieldCheck,
  Zap,
  Info,
  Bug,
  Cpu
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const StepTracker = ({ onClose }) => {
  const { user, updateUserProfile, token } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todaySteps, setTodaySteps] = useState(0);
  const [historyData, setHistoryData] = useState([]);
  const [selectedRange, setSelectedRange] = useState('7days');
  const [providerInfo, setProviderInfo] = useState({ id: 'none', name: 'Initializing...', available: false, status: 'Initializing' });
  const [diagnostics, setDiagnostics] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  
  // Goal state
  const currentGoal = user?.profile?.dailyStepGoal || 10000;
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [inputGoal, setInputGoal] = useState(currentGoal);
  const [goalSaving, setGoalSaving] = useState(false);

  // User biometrics for distance/calorie calculations
  const userHeightCm = user?.profile?.height || 175;
  const userWeightKg = user?.profile?.weight || 70;

  // Calculated metrics
  const estimatedDistanceKm = HealthConnectStepProvider.calculateDistance(todaySteps, userHeightCm);
  const estimatedCaloriesKcal = HealthConnectStepProvider.calculateCalories(todaySteps, userWeightKg);
  const progressPercent = Math.min(100, Math.round((todaySteps / currentGoal) * 100));

  const refreshStepData = useCallback(async () => {
    try {
      await stepProviderManager.initialize();
      const activeInfo = stepProviderManager.getActiveProviderInfo();
      setProviderInfo(activeInfo);

      const steps = await stepProviderManager.getTodaySteps();
      setTodaySteps(steps);

      const diag = await stepProviderManager.getDiagnostics();
      setDiagnostics(diag);

      const todayStr = new Date().toISOString().split('T')[0];
      await HealthConnectStepProvider.syncWithServer(todayStr, steps, currentGoal, user?.profile, token);

      const hist = await HealthConnectStepProvider.getStepHistory(30);
      setHistoryData(hist);
    } catch (e) {
      console.warn('Error refreshing step provider data:', e);
    } finally {
      setLoading(false);
    }
  }, [currentGoal, user?.profile, token]);

  useEffect(() => {
    refreshStepData();
  }, [refreshStepData]);

  // Periodic polling every 5s while open
  useEffect(() => {
    const interval = setInterval(async () => {
      const steps = await stepProviderManager.getTodaySteps();
      setTodaySteps(steps);
      const diag = await stepProviderManager.getDiagnostics();
      setDiagnostics(diag);
      const todayStr = new Date().toISOString().split('T')[0];
      await HealthConnectStepProvider.syncWithServer(todayStr, steps, currentGoal, user?.profile, token);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentGoal, user?.profile, token]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshStepData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleSaveGoal = async () => {
    const newGoalNum = parseInt(inputGoal, 10);
    if (isNaN(newGoalNum) || newGoalNum < 1000 || newGoalNum > 100000) return;

    setGoalSaving(true);
    try {
      if (updateUserProfile) {
        await updateUserProfile({ dailyStepGoal: newGoalNum });
      }
      const todayStr = new Date().toISOString().split('T')[0];
      await HealthConnectStepProvider.syncWithServer(todayStr, todaySteps, newGoalNum, user?.profile, token);
      setShowGoalModal(false);
    } catch (e) {
      console.error('Failed to update step goal:', e);
    } finally {
      setGoalSaving(false);
    }
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const filteredHistory = useCallback(() => {
    if (!historyData || historyData.length === 0) return [];
    
    if (selectedRange === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      return historyData.filter(item => item.date === todayStr);
    }
    if (selectedRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      return historyData.filter(item => item.date === yStr);
    }
    if (selectedRange === '7days') {
      return historyData.slice(0, 7).reverse();
    }
    return historyData.slice(0, 30).reverse();
  }, [historyData, selectedRange])();

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl relative w-full max-w-lg mx-auto flex flex-col space-y-5 p-5 md:p-6 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
            <Footprints className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Step Tracker</h2>
            <p className="text-xs text-gray-500 font-medium">Multi-Source Step Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`p-2 rounded-xl transition-colors ${showDebug ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            title="Toggle Diagnostics / Debug Panel"
          >
            <Bug className="w-4 h-4" />
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Refresh Step Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-sm font-semibold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Active Source Transparency Badge */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {providerInfo.available ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <span className="font-bold text-slate-800">
            {providerInfo.available ? `Step Source: ${providerInfo.name}` : 'Step tracking is unavailable on this device'}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          {providerInfo.id}
        </span>
      </div>

      {/* Main Step Counter View */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-4">
        <div className="absolute right-0 top-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Today's Steps</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-4xl font-black text-white tracking-tight">{todaySteps.toLocaleString()}</span>
              <span className="text-sm font-semibold text-gray-400">/ {currentGoal.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => { setInputGoal(currentGoal); setShowGoalModal(true); }}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-gray-300 transition-colors"
            title="Edit Daily Step Goal"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-gray-300">
            <span>Goal Progress</span>
            <span className="text-indigo-400">{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden p-0.5">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Sub-Metrics: Estimated Distance & Estimated Calories */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-0.5">
            <div className="flex items-center space-x-1.5 text-gray-400">
              <Navigation className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Estimated distance</span>
            </div>
            <p className="text-lg font-bold text-white">{estimatedDistanceKm} <span className="text-xs text-gray-400 font-normal">km</span></p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-0.5">
            <div className="flex items-center space-x-1.5 text-gray-400">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Estimated calories</span>
            </div>
            <p className="text-lg font-bold text-white">{estimatedCaloriesKcal} <span className="text-xs text-gray-400 font-normal">kcal</span></p>
          </div>
        </div>
      </div>

      {/* DEBUG / DIAGNOSTICS PANEL */}
      {showDebug && diagnostics && (
        <div className="bg-slate-950 text-emerald-400 rounded-2xl p-4 font-mono text-xs space-y-3 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-white font-bold">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Step Engine Diagnostics</span>
            </div>
            <span className="text-[10px] text-slate-500">Live Telemetry</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><span className="text-slate-500">Active Provider:</span> <span className="text-white font-bold">{diagnostics.activeProvider?.name}</span></div>
            <div><span className="text-slate-500">Provider ID:</span> <span className="text-amber-300">{diagnostics.activeProvider?.id}</span></div>
            <div><span className="text-slate-500">Calculated Steps:</span> <span className="text-white font-bold">{diagnostics.todayCalculatedSteps}</span></div>
            <div><span className="text-slate-500">No Mock Data:</span> <span className="text-emerald-300">STRICT ENFORCED</span></div>
          </div>

          <div className="border-t border-slate-800 pt-2 space-y-1">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">Provider Priority Stack</span>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div>1. Motion Sensor: <span className={diagnostics.providerAvailability?.browserMotion ? 'text-emerald-400' : 'text-slate-600'}>{diagnostics.providerAvailability?.browserMotion ? 'AVAILABLE' : 'OFFLINE'}</span></div>
              <div>2. Health Connect: <span className={diagnostics.providerAvailability?.healthConnect ? 'text-emerald-400' : 'text-slate-600'}>{diagnostics.providerAvailability?.healthConnect ? 'AVAILABLE' : 'OFFLINE'}</span></div>
              <div>3. Android Step Counter: <span className={diagnostics.providerAvailability?.androidStepCounter ? 'text-emerald-400' : 'text-slate-600'}>{diagnostics.providerAvailability?.androidStepCounter ? 'AVAILABLE' : 'OFFLINE'}</span></div>
              <div>4. Samsung Health: <span className={diagnostics.providerAvailability?.samsungHealth ? 'text-emerald-400' : 'text-slate-600'}>{diagnostics.providerAvailability?.samsungHealth ? 'AVAILABLE' : 'OFFLINE'}</span></div>
            </div>
          </div>

          {diagnostics.browserMotion && (
            <div className="border-t border-slate-800 pt-2 space-y-1">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">PWA Accelerometer Live Stream</span>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div>Mag Raw: <span className="text-white">{diagnostics.browserMotion.accelerationMagnitude || 0} m/s²</span></div>
                <div>Gravity Filt: <span className="text-white">{diagnostics.browserMotion.gravityFilteredAcceleration || 0} m/s²</span></div>
                <div>Dynamic Thresh: <span className="text-amber-300">{diagnostics.browserMotion.dynamicThreshold || 0}</span></div>
                <div>Cadence: <span className="text-indigo-300">{diagnostics.browserMotion.currentCadenceBpm || 0} SPM</span></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historical Step View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-gray-900">Step History</h3>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold text-gray-600">
            {['today', 'yesterday', '7days', '30days'].map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                  selectedRange === range ? 'bg-white text-indigo-600 shadow-xs' : 'hover:text-gray-900'
                }`}
              >
                {range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : range}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length > 0 ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(d) => {
                      const dateObj = new Date(d + 'T00:00:00');
                      return dateObj.toLocaleDateString(undefined, { weekday: 'narrow' });
                    }}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(val) => [`${Number(val).toLocaleString()} steps`, 'Steps']}
                    labelFormatter={(label) => formatDateLabel(label)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  />
                  <Bar dataKey="steps" radius={[6, 6, 0, 0]}>
                    {filteredHistory.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.steps >= currentGoal ? '#6366f1' : '#a5b4fc'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center text-xs text-gray-500">
            No step records found for selected period.
          </div>
        )}
      </div>

      {/* EDIT STEP GOAL MODAL */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Set Daily Step Goal</h3>
            <p className="text-xs text-gray-500">Target steps per day for step tracking.</p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Daily Steps</label>
              <input
                type="number"
                step="500"
                value={inputGoal}
                onChange={(e) => setInputGoal(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={goalSaving}
                className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-xs"
              >
                {goalSaving ? 'Saving...' : 'Save Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
