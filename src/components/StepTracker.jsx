import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { HealthConnectStepProvider } from '../services/stepDataProvider';
import { 
  Footprints, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Settings2, 
  ExternalLink, 
  Flame, 
  Navigation, 
  ChevronRight, 
  Calendar,
  Smartphone,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const StepTracker = ({ onClose }) => {
  const { user, updateUserProfile, token } = useApp();

  const [availability, setAvailability] = useState('CHECKING'); // CHECKING | SDK_AVAILABLE | SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED | SDK_UNAVAILABLE
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todaySteps, setTodaySteps] = useState(0);
  const [historyData, setHistoryData] = useState([]);
  const [selectedRange, setSelectedRange] = useState('7days'); // 'today' | 'yesterday' | '7days' | '30days'
  
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

  // Initialize and check Health Connect availability and permissions
  const initHealthConnect = useCallback(async () => {
    setLoading(true);
    try {
      const status = await HealthConnectStepProvider.getAvailability();
      setAvailability(status);

      if (status === 'SDK_AVAILABLE') {
        const permGranted = await HealthConnectStepProvider.checkPermission();
        setHasPermission(permGranted);

        if (permGranted) {
          const steps = await HealthConnectStepProvider.getTodaySteps();
          setTodaySteps(steps);

          const hist = await HealthConnectStepProvider.getStepHistory(30);
          setHistoryData(hist);

          // Sync with server DB
          const todayStr = new Date().toISOString().split('T')[0];
          await HealthConnectStepProvider.syncWithServer(todayStr, steps, currentGoal, user?.profile, token);
        }
      } else {
        setHasPermission(false);
      }
    } catch (err) {
      console.error('Error initializing Health Connect:', err);
      setAvailability('SDK_UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  }, [currentGoal, user?.profile, token]);

  useEffect(() => {
    initHealthConnect();
  }, [initHealthConnect]);

  // Periodic polling every 20s while open
  useEffect(() => {
    if (availability !== 'SDK_AVAILABLE' || !hasPermission) return;

    const interval = setInterval(async () => {
      try {
        const steps = await HealthConnectStepProvider.getTodaySteps();
        setTodaySteps(steps);
        const todayStr = new Date().toISOString().split('T')[0];
        await HealthConnectStepProvider.syncWithServer(todayStr, steps, currentGoal, user?.profile, token);
      } catch (e) {}
    }, 20000);

    return () => clearInterval(interval);
  }, [availability, hasPermission, currentGoal, user?.profile, token]);

  // Handle Permission Request
  const handleConnectClick = async () => {
    setLoading(true);
    try {
      const success = await HealthConnectStepProvider.requestPermission();
      if (success) {
        await initHealthConnect();
      }
    } catch (e) {
      console.error('Permission request failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // Manual Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await initHealthConnect();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Toggle Dev Test / Simulation Mode for browser preview
  const handleToggleSimulatedBridge = async () => {
    if (typeof localStorage !== 'undefined') {
      const isSimulated = localStorage.getItem('caliber_simulated_health_connect') === 'true';
      if (isSimulated) {
        localStorage.removeItem('caliber_simulated_health_connect');
        localStorage.removeItem('caliber_simulated_permission_granted');
      } else {
        localStorage.setItem('caliber_simulated_health_connect', 'true');
        localStorage.setItem('caliber_simulated_permission_granted', 'true');
      }
      await initHealthConnect();
    }
  };

  // Save Step Goal
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

  // Format date helper
  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Filter history for selected view range
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
            <p className="text-xs text-gray-500 font-medium">Android Health Connect Integration</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasPermission && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Refresh Health Connect Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          )}

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

      {/* Loading State */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-gray-500">Checking Health Connect availability...</p>
        </div>
      )}

      {/* ONBOARDING FLOW: Health Connect Not Connected or Permission Missing */}
      {!loading && (availability !== 'SDK_AVAILABLE' || !hasPermission) && (
        <div className="space-y-5 my-2">
          
          {/* Status Alert Banner */}
          {availability === 'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold block">Health Connect Update Required</span>
                <p>Health Connect is installed on your Android device, but needs an update from Google Play Store to support step aggregation.</p>
              </div>
            </div>
          ) : availability === 'SDK_UNAVAILABLE' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-slate-800">
              <div className="flex items-start space-x-3">
                <Smartphone className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-slate-900 block">Health Connect Unavailable on this Browser/Device</span>
                  <p className="text-slate-600 leading-relaxed">
                    Health Connect isn't available on this device. Caliber can't provide Health Connect-based step tracking until it is available.
                  </p>
                </div>
              </div>

              {/* Explicit Notice regarding GPS */}
              <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 flex items-start space-x-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Caliber strictly uses Android Health Connect for steps. GPS distance is NOT used to estimate or count steps.</span>
              </div>

              {/* Developer Test Mode Toggle */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Testing in Web Browser?</span>
                <button
                  onClick={handleToggleSimulatedBridge}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  Enable Web Test Bridge
                </button>
              </div>
            </div>
          ) : null}

          {/* Connect Health Connect Onboarding Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-5">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-indigo-300 border border-white/10">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Onboarding</span>
                <h3 className="text-lg font-extrabold text-white">Connect your steps to Caliber</h3>
              </div>
            </div>

            <p className="text-xs text-indigo-100/90 leading-relaxed">
              Caliber uses Android Health Connect to read your step count. Your steps are provided by your Android device and compatible health/fitness apps.
            </p>

            <div className="space-y-2 text-xs text-indigo-200/80">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Accurate step aggregation using <code className="bg-white/10 px-1 py-0.5 rounded text-[10px] text-white">StepsRecord</code></span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Prevents double-counting across smartwatches & phones</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero location tracking required for steps</span>
              </div>
            </div>

            <button
              onClick={handleConnectClick}
              className="w-full py-3.5 px-4 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 text-sm"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Connect Health Connect</span>
            </button>
          </div>
        </div>
      )}

      {/* CONNECTED DASHBOARD VIEW */}
      {!loading && availability === 'SDK_AVAILABLE' && hasPermission && (
        <div className="space-y-5">
          
          {/* Connection Status Badge & Source Label */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-full font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Connected to Health Connect</span>
            </div>

            <span className="text-[11px] font-semibold text-gray-400 tracking-tight">
              Source: Android Health Connect
            </span>
          </div>

          {/* Today's Step Card */}
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

          {/* Historical Step View */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">Step History</h3>
              </div>

              {/* View Range Selector */}
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

            {/* Historical Bar Chart / List */}
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
                No Health Connect step records found for selected period.
              </div>
            )}
          </div>

          {/* Manage Permissions / Settings Links */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Health Connect Permissions</span>
            <button
              onClick={handleConnectClick}
              className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center space-x-1"
            >
              <span>Manage Permissions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* EDIT STEP GOAL MODAL */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Set Daily Step Goal</h3>
            <p className="text-xs text-gray-500">Target steps per day for Health Connect tracking.</p>

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
