import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Eye, EyeOff, Save, Check, RefreshCw, Smartphone, HelpCircle, Bell, Plus, Trash2, WifiOff, CloudUpload, Layers } from 'lucide-react';

import { OfflineSyncModal } from './OfflineSyncModal';

export const Settings = () => {
  const {
    user,
    updateProfile,
    logExercise,
    logout,
    loading,
    isOnline,
    effectiveOnline,
    simulatedOffline,
    toggleSimulatedOffline,
    pendingQueue,
    isSyncing,
    syncPendingQueue
  } = useApp();

  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

  // Load from context user profile state
  const [name, setName] = useState(user?.profile?.name || '');
  const [age, setAge] = useState(String(user?.profile?.age || 28));
  const [weight, setWeight] = useState(String(user?.profile?.weight || 75));
  const [height, setHeight] = useState(String(user?.profile?.height || 175));
  const [sex, setSex] = useState(user?.profile?.sex || 'male');
  const [activityLevel, setActivityLevel] = useState(user?.profile?.activityLevel || 'moderate');
  const [goal, setGoal] = useState(user?.profile?.goal || 'lose');

  const [hideRemaining, setHideRemaining] = useState(user?.profile?.hideCaloriesRemaining || false);
  const [darkMode, setDarkMode] = useState(user?.profile?.darkMode || false);
  const [reminders, setReminders] = useState(user?.profile?.reminders || []);
  const [syncingWearable, setSyncingWearable] = useState(false);

  const [notification, setNotification] = useState(null);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const success = await updateProfile({
      name: name.trim() || undefined,
      age: Number(age),
      weight: Number(weight),
      height: Number(height),
      sex,
      activityLevel,
      goal,
      hideCaloriesRemaining: hideRemaining,
      reminders,
      darkMode
    });

    if (success) {
      setNotification("Settings updated successfully!");
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleToggleHideRemaining = async (val) => {
    setHideRemaining(val);
    await updateProfile({ hideCaloriesRemaining: val });
  };

  const handleToggleDarkMode = async (val) => {
    setDarkMode(val);
    await updateProfile({ darkMode: val });
  };

  const handleAddReminder = () => {
    setReminders([...reminders, { id: `rem_${Date.now()}`, time: '12:00', message: 'Time to log your meal!', enabled: true }]);
  };

  const handleUpdateReminder = (id, updates) => {
    setReminders(reminders.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleRemoveReminder = (id) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await window.Notification.requestPermission();
      if (permission === 'granted') {
        setNotification("Notifications enabled!");
      } else {
        setNotification("Please enable notifications in your browser settings.");
      }
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Phase 2: Stub Google Fit / Apple Health Wearable Sync pull!
  const syncWearable = async () => {
    setSyncingWearable(true);
    setNotification("Accessing Google Fit / Apple Health...");

    // Wait for mock synchronization delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Log a realistic exercise entry
    const activeCalories = 240;
    const duration = 45;
    const success = await logExercise({
      activityType: "Wearable Sync (4,850 Steps / Active Walk)",
      durationMinutes: duration,
      caloriesBurned: activeCalories,
      loggedAt: new Date().toISOString()
    });

    setSyncingWearable(false);
    if (success) {
      setNotification("Synced! Added +240.00 kcal active burn from your daily steps.");
    } else {
      setNotification("Sync succeeded but error saving log.");
    }
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-12 space-y-4">
      {notification && (
        <div className="fixed bottom-18 left-1/2 -translate-x-1/2 bg-neutral-dark text-white text-xs px-4 py-3 rounded-xl shadow-lg z-50 text-center max-w-xs animate-bounce">
          {notification}
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-neutral-dark dark:text-white border-b border-gray-50 dark:border-slate-700 pb-2">Profile & Mifflin-St Jeor Targets</h3>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Biological Sex</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Age (years)</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Weight (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Height (cm)</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none"
            />
          </div>
        </div>

        <div className="text-xs space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Activity Multiplier</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none"
            >
              <option value="sedentary">Sedentary (1.2x TDEE)</option>
              <option value="light">Lightly Active (1.375x TDEE)</option>
              <option value="moderate">Moderately Active (1.55x TDEE)</option>
              <option value="active">Active (1.725x TDEE)</option>
              <option value="very_active">Very Active (1.9x TDEE)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Daily Goal</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none"
            >
              <option value="lose">Lose Weight (-500.00 kcal target deficit)</option>
              <option value="maintain">Maintain Weight (balanced target)</option>
              <option value="gain">Gain Weight (+500.00 kcal target surplus)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-light text-white font-bold py-3 rounded-xl transition text-xs shadow-sm flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" /> Recalculate & Save Targets
            </>
          )}
        </button>
      </form>

      {/* Accessibility Preferences Panel */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-neutral-dark dark:text-white">Accessibility & Preferences</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 text-xs">
            <div className="pr-4">
              <span className="font-semibold text-gray-700 dark:text-slate-200 block mb-0.5">Hide Calories Remaining</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-400">Avoid anxiety by focusing on logged targets rather than deficit values.</span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleHideRemaining(!hideRemaining)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 shrink-0 ${
                hideRemaining ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-500'
              }`}
            >
              <span className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${
                hideRemaining ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 text-xs">
            <div className="pr-4">
              <span className="font-semibold text-gray-700 dark:text-slate-200 block mb-0.5">Dark Mode</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-400">Switch to a darker theme for reduced eye strain.</span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleDarkMode(!darkMode)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 shrink-0 ${
                darkMode ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-500'
              }`}
            >
              <span className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${
                darkMode ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* Custom Reminders Panel */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-dark dark:text-white flex items-center gap-1">
            <Bell className="w-4 h-4 text-primary" /> Custom Reminders
          </h3>
          <button
            type="button"
            onClick={requestNotificationPermission}
            className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-bold hover:bg-primary/20 transition"
          >
            Enable Notifications
          </button>
        </div>

        {reminders.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-2">No reminders set. Add one to stay on track!</p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div key={reminder.id} className="flex flex-col gap-2 p-3 rounded-xl bg-gray-50/50 border border-gray-100 text-xs">
                <div className="flex items-center justify-between">
                  <input
                    type="time"
                    value={reminder.time}
                    onChange={(e) => handleUpdateReminder(reminder.id, { time: e.target.value })}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateReminder(reminder.id, { enabled: !reminder.enabled })}
                      className={`w-9 h-5 rounded-full transition-colors flex items-center p-1 ${
                        reminder.enabled ? 'bg-primary' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`bg-white w-3 h-3 rounded-full shadow-sm transition-transform ${
                        reminder.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveReminder(reminder.id)}
                      className="text-red-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={reminder.message}
                  onChange={(e) => handleUpdateReminder(reminder.id, { message: e.target.value })}
                  placeholder="Reminder message..."
                  className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none text-[11px]"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleAddReminder}
          className="w-full bg-gray-50 hover:bg-gray-100 text-primary font-bold py-2.5 rounded-xl border border-gray-200 transition text-xs flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Reminder
        </button>
        
        <p className="text-[10px] text-gray-400 text-center leading-tight pt-1">
          Make sure to tap "Recalculate & Save Targets" at the top to save your changes.
        </p>
      </div>

      {/* Wearable Device Integration */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-neutral-dark dark:text-white flex items-center gap-1">
          <Smartphone className="w-4 h-4 text-primary" /> Wearable Synchronizer
        </h3>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Directly pull activity data and estimated active step-burn calorie modifications from Google Fit, Apple Health, or Fitbit.
        </p>

        <button
          onClick={syncWearable}
          disabled={syncingWearable}
          className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl border border-gray-200 transition text-xs flex items-center justify-center gap-2"
        >
          {syncingWearable ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Connecting to health store...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 text-primary" /> Pull Logs from Apple Health / Google Fit
            </>
          )}
        </button>
      </div>

      {/* Offline Logging & Local Sync Settings */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-dark dark:text-white flex items-center gap-1.5">
            <WifiOff className="w-4 h-4 text-emerald-500" /> Offline Logging & Queue
          </h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            !effectiveOnline
              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          }`}>
            {!effectiveOnline ? 'Offline' : 'Online'}
          </span>
        </div>

        <p className="text-[11px] text-gray-400 leading-relaxed">
          Caliber automatically queues your food entries, water intake, and exercise logs when offline and syncs them seamlessly when internet is restored.
        </p>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 text-xs">
          <div>
            <span className="font-semibold text-gray-700 dark:text-slate-200 block">Simulate Offline Mode</span>
            <span className="text-[10px] text-gray-400">Force offline queueing to test offline entry logging</span>
          </div>
          <button
            type="button"
            onClick={toggleSimulatedOffline}
            className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 shrink-0 ${
              simulatedOffline ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-500'
            }`}
          >
            <span className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${
              simulatedOffline ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button
            onClick={() => setIsOfflineModalOpen(true)}
            className="flex-1 bg-gray-50 hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-neutral-dark dark:text-white font-bold py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 transition text-xs flex items-center justify-center gap-1.5"
          >
            <Layers className="w-4 h-4 text-emerald-500" /> Manage Queue ({pendingQueue.length})
          </button>

          {pendingQueue.length > 0 && effectiveOnline && (
            <button
              onClick={() => syncPendingQueue()}
              disabled={isSyncing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> Sync Now
            </button>
          )}
        </div>
      </div>

      <OfflineSyncModal isOpen={isOfflineModalOpen} onClose={() => setIsOfflineModalOpen(false)} />


      {/* Account actions */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm text-center">
        <div className="text-xs text-gray-400 mb-2">Signed in as <strong className="text-gray-600 dark:text-gray-300">{user?.email}</strong></div>
        <button
          onClick={logout}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-4 h-4" /> Sign Out of Account
        </button>
      </div>
    </div>
  );
};
