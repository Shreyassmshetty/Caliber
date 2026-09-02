import React, { useState, useEffect, useRef } from 'react';
import { useApp, formatCalories } from '../context/AppContext';
import { Play, Pause, Square, MapPin, Navigation, Activity, Clock, Flame, AlertCircle, X, Check, Footprints } from 'lucide-react';



export const LiveRunTracker = ({ onClose }) => {
  const { logExercise, user } = useApp();
  
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  const [positions, setPositions] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0); 
  const [durationMs, setDurationMs] = useState(0); 
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  
  const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const watchPosition = () => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPos = { lat: latitude, lng: longitude, timestamp: pos.timestamp };
        
        setPositions(prev => {
          if (prev.length > 0) {
            const lastPos = prev[prev.length - 1];
            const dist = calcDistance(lastPos.lat, lastPos.lng, newPos.lat, newPos.lng);
            // Count if moved at least 5 meters (0.005 km)
            if (dist > 0.005) {
              setDistanceKm(d => d + dist);
              return [...prev, newPos];
            }
            return prev;
          }
          return [newPos];
        });
      },
      (err) => {
        setError("Location access denied or unavailable. " + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setError(null);
    setIsTracking(true);
    setIsPaused(false);
    
    timerRef.current = setInterval(() => {
      setDurationMs(prev => prev + 1000);
    }, 1000);
    
    watchPosition();
  };

  const pauseTracking = () => {
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const resumeTracking = () => {
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setDurationMs(prev => prev + 1000);
    }, 1000);
    watchPosition();
  };
  
  const finishTracking = () => {
    pauseTracking();
    setIsFinished(true);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Format time (MM)
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Estimate calories: roughly 60-80 calories per km for a 70kg person running/walking
  const weightKg = user?.profile?.weight || 75;
  const estimatedCals = Math.round(distanceKm * weightKg * 1.036); 
  
  // Estimate steps: roughly 0.75 meters per step
  const estimatedSteps = Math.round((distanceKm * 1000) / 0.75);

  const currentPace = distanceKm > 0 ? (durationMs / 1000 / 60) / distanceKm : 0; // min/km
  const formatPace = (pace) => {
    if (!pace || !isFinite(pace)) return "--:--";
    const m = Math.floor(pace);
    const s = Math.round((pace - m) * 60).toString().padStart(2, '0');
    return `${m}'${s}"`;
  };

  const saveRun = async () => {
    setSaving(true);
    const durationMins = Math.max(1, Math.round(durationMs / 1000 / 60));
    await logExercise({
      activityType: `Run/Walk (${parseFloat(distanceKm.toFixed(2))} km, ${estimatedSteps} steps)`,
      durationMinutes: durationMins,
      caloriesBurned: estimatedCals,
      loggedAt: new Date().toISOString()
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-2xl relative w-full max-w-sm mx-auto flex flex-col space-y-6">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="text-center mt-2">
        <h3 className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2">
          <MapPin className="w-5 h-5 text-indigo-500" />
          Live Run Tracker
        </h3>
        <p className="text-xs text-gray-500 mt-1">Track distance, pace, and steps in real-time</p>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col items-center justify-center">
          <Activity className="w-5 h-5 text-indigo-500 mb-1" />
          <span className="text-2xl font-black text-indigo-900">{parseFloat(distanceKm.toFixed(2))}</span>
          <span className="text-[10px] font-bold text-indigo-400 uppercase">Kilometers</span>
        </div>
        
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col items-center justify-center">
          <Clock className="w-5 h-5 text-indigo-500 mb-1" />
          <span className={`text-2xl font-black ${isPaused ? 'text-indigo-900/50' : 'text-indigo-900'}`}>{formatTime(durationMs)}</span>
          <span className="text-[10px] font-bold text-indigo-400 uppercase">Time</span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
          <Flame className="w-5 h-5 text-orange-500 mb-1" />
          <span className="block text-sm font-bold text-gray-800">{formatCalories(estimatedCals)}</span>
          <span className="block text-[9px] font-bold text-gray-400 uppercase mt-0.5">Kcal</span>
        </div>
        
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
          <Navigation className="w-5 h-5 text-emerald-500 mb-1" />
          <span className="block text-sm font-bold text-gray-800">{formatPace(currentPace)}</span>
          <span className="block text-[9px] font-bold text-gray-400 uppercase mt-0.5">Avg Pace</span>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
          <Footprints className="w-5 h-5 text-blue-500 mb-1" />
          <span className="block text-sm font-bold text-gray-800">{estimatedSteps.toLocaleString()}</span>
          <span className="block text-[9px] font-bold text-gray-400 uppercase mt-0.5">Steps</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 pt-2">
        {!isTracking && !isFinished ? (
          <button
            onClick={startTracking}
            className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition"
          >
            <Play className="w-5 h-5 fill-current" /> Start Run
          </button>
        ) : isFinished ? (
          <button
            onClick={saveRun}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition"
          >
            {saving ? "Saving..." : <><Check className="w-5 h-5" /> Save Activity</>}
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={resumeTracking}
                className="bg-emerald-500 hover:bg-emerald-600 text-white flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition"
              >
                <Play className="w-5 h-5 fill-current" /> Resume
              </button>
            ) : (
              <button
                onClick={pauseTracking}
                className="bg-amber-500 hover:bg-amber-600 text-white flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-200 transition"
              >
                <Pause className="w-5 h-5 fill-current" /> Pause
              </button>
            )}
            
            <button
              onClick={finishTracking}
              className="bg-gray-800 hover:bg-gray-900 text-white flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-gray-300 transition"
            >
              <Square className="w-5 h-5 fill-current" /> Finish
            </button>
          </>
        )}
      </div>
    </div>
  );
};
