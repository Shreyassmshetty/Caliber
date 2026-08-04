import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Dumbbell, Plus, Check, RefreshCw, Sparkles, MapPin } from 'lucide-react';
import { LiveRunTracker } from './LiveRunTracker';

const ACTIVITY_PRESETS = [
  { type: "Walking (moderate)", met: 3.5, calPerMin: 4.5 },
  { type: "Running (jogging)", met: 8.0, calPerMin: 10.5 },
  { type: "Bicycling (leisurely)", met: 5.5, calPerMin: 7.2 },
  { type: "Swimming (laps)", met: 7.0, calPerMin: 9.2 },
  { type: "Weightlifting (intense)", met: 5.0, calPerMin: 6.5 },
  { type: "Yoga / Pilates", met: 3.0, calPerMin: 3.9 },
  { type: "Cardio Dance / Zumba", met: 6.5, calPerMin: 8.5 },
];

export const ExerciseLogger = () => {
  const { logExercise, user } = useApp();
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState('30');
  const [calories, setCalories] = useState('200');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showRunTracker, setShowRunTracker] = useState(false);

  // Recalculate estimated burn dynamically when preset is picked
  const handlePresetSelect = (preset) => {
    setActivity(preset.type);
    const dur = Number(duration) || 30;

    // Adjust burn based on actual user weight if present (standard MET calc is MET * 3.5 * weightKg / 200)
    const weightKg = user?.profile?.weight || 75;
    const estimatedBurn = Math.round(preset.met * 3.5 * weightKg * dur / 200);

    setCalories(String(estimatedBurn));
  };

  const handleDurationChange = (val) => {
    setDuration(val);
    const durNum = Number(val) || 0;

    // Recalculate if preset was matched
    const matchedPreset = ACTIVITY_PRESETS.find(p => p.type === activity);
    if (matchedPreset) {
      const weightKg = user?.profile?.weight || 75;
      const estimatedBurn = Math.round(matchedPreset.met * 3.5 * weightKg * durNum / 200);
      setCalories(String(estimatedBurn));
    }
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!activity || !duration || !calories) return;

    setLoading(true);
    const payload = {
      activityType: activity,
      durationMinutes: Number(duration),
      caloriesBurned: Number(calories),
      loggedAt: new Date().toISOString()
    };

    const success = await logExercise(payload);
    setLoading(false);

    if (success) {
      setNotification(`Logged "${activity}" exercise!`);
      setActivity('');
      setDuration('30');
      setCalories('200');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-12 space-y-4">
      {notification && (
        <div className="fixed bottom-18 left-1/2 -translate-x-1/2 bg-neutral-dark text-white text-xs px-4 py-3 rounded-xl shadow-lg z-50 animate-bounce">
          {notification}
        </div>
      )}

      {showRunTracker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <LiveRunTracker onClose={() => setShowRunTracker(false)} />
        </div>
      )}

      {/* Live Tracker Option */}
      <div 
        onClick={() => setShowRunTracker(true)}
        className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 hover:border-indigo-200 p-4 rounded-3xl cursor-pointer transition flex items-center justify-between group shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 text-white p-2.5 rounded-xl group-hover:scale-105 transition shadow-sm">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-gray-800 flex items-center gap-1">
              Live Run/Walk Tracker <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </h4>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Track GPS distance, pace, and estimate calories
            </p>
          </div>
        </div>
        <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm">
          Start
        </span>
      </div>

      {/* Manual Logger Form */}
      <form onSubmit={handleLogSubmit} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-neutral-dark">Log Exercise Activity</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Activity Type</label>
            <input
              type="text"
              required
              placeholder="E.g. Outdoor trail run, Gym push day"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Duration (mins)</label>
              <input
                type="number"
                required
                min="1"
                placeholder="30"
                value={duration}
                onChange={(e) => handleDurationChange(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Calories Burned (kcal)</label>
              <input
                type="number"
                required
                min="1"
                placeholder="200"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-gray-200 focus:outline-none"
              />
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
                <Check className="w-4 h-4" /> Save Activity
              </>
            )}
          </button>
        </div>
      </form>

      {/* Preset Cards list */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-primary" /> Quick presets (Auto-estimated)
        </h3>

        <div className="space-y-1.5">
          {ACTIVITY_PRESETS.map((preset, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              className="w-full p-3 rounded-xl text-left text-xs bg-gray-50 hover:bg-gray-100/70 border border-gray-50 transition flex justify-between items-center"
            >
              <div>
                <span className="font-semibold text-gray-700 block">{preset.type}</span>
                <span className="text-[10px] text-gray-400">MET rating: {preset.met}</span>
              </div>
              <span className="bg-primary/5 text-primary text-[10px] font-bold py-1 px-2.5 rounded-lg">
                ~{Math.round(preset.met * 3.5 * (user?.profile?.weight || 75) * 30 / 200)} cal / 30m
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
