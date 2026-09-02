import React, { useState, useEffect, useRef } from 'react';
import { useApp, formatCalories } from '../context/AppContext';
import { Play, Pause, Square, MapPin, Navigation, Activity, Clock, Flame, AlertCircle, X, Check, Footprints, Zap } from 'lucide-react';



export const LiveRunTracker = ({ onClose }) => {
  const { logExercise, user } = useApp();
  
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  const [positions, setPositions] = useState([]);
  const [distanceKm, setDistanceKm] = useState(0); 
  const [durationMs, setDurationMs] = useState(0); 
  const [steps, setSteps] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [motionSensorActive, setMotionSensorActive] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastStepTimeRef = useRef(0);
  const lastMotionTimeRef = useRef(0);
  const stepsRef = useRef(0);
  const isTrackingRef = useRef(false);
  const isPausedRef = useRef(false);

  // Sync refs with state for asynchronous event listeners
  useEffect(() => {
    isTrackingRef.current = isTracking;
    isPausedRef.current = isPaused;
  }, [isTracking, isPaused]);
  
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

  // Accelerometer step detector for precise physical motion monitoring
  useEffect(() => {
    let motionHandler = null;

    const handleMotion = (event) => {
      if (!isTrackingRef.current || isPausedRef.current) {
        setIsMoving(false);
        return;
      }

      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc || acc.x === null) return;

      setMotionSensorActive(true);

      const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      const now = Date.now();

      // Step detection algorithm:
      // Earth gravity ~ 9.81 m/s^2. Vertical step acceleration produces peak > 11.6 m/s^2
      const peakThreshold = 11.6;
      const stepCooldownMs = 280; // Max ~215 steps per min (realistic running limit)

      if (magnitude > peakThreshold && (now - lastStepTimeRef.current) > stepCooldownMs) {
        lastStepTimeRef.current = now;
        lastMotionTimeRef.current = now;
        stepsRef.current += 1;
        setSteps(stepsRef.current);
        setIsMoving(true);
      } else if (now - lastMotionTimeRef.current < 2500) {
        setIsMoving(true);
      } else {
        setIsMoving(false);
      }
    };

    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('devicemotion', handleMotion);
            }
          })
          .catch(() => {});
      } else {
        window.addEventListener('devicemotion', handleMotion);
      }
      motionHandler = handleMotion;
    }

    return () => {
      if (motionHandler && typeof window !== 'undefined') {
        window.removeEventListener('devicemotion', motionHandler);
      }
    };
  }, []);

  // Monitor motion idle state every second to freeze steps when stationary
  useEffect(() => {
    const idleCheckInterval = setInterval(() => {
      if (!isTracking || isPaused) {
        setIsMoving(false);
        return;
      }
      const timeSinceLastMotion = Date.now() - lastMotionTimeRef.current;
      if (timeSinceLastMotion > 3000) {
        setIsMoving(false);
      }
    }, 1000);

    return () => clearInterval(idleCheckInterval);
  }, [isTracking, isPaused]);

  const watchPosition = () => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (isPausedRef.current) return;

        const { latitude, longitude, accuracy, speed } = pos.coords;
        const newPos = { lat: latitude, lng: longitude, timestamp: pos.timestamp };
        
        // Filter out low accuracy reads (> 35 meters)
        if (accuracy && accuracy > 35) return;

        setPositions(prev => {
          if (prev.length > 0) {
            const lastPos = prev[prev.length - 1];
            const dist = calcDistance(lastPos.lat, lastPos.lng, newPos.lat, newPos.lng);
            
            // Speed requirement: > 0.3 m/s (~1.1 km/h) or dist > 6m to ignore standing GPS drift
            const speedKmh = speed ? speed * 3.6 : (dist / Math.max(0.1, (pos.timestamp - lastPos.timestamp) / 1000)) * 3600;
            
            if (dist > 0.006 && speedKmh > 1.1) {
              setDistanceKm(d => {
                const newDist = d + dist;
                // If accelerometer isn't supported on device, estimate steps strictly when actively moving
                if (!motionSensorActive) {
                  const calculatedSteps = Math.round((newDist * 1000) / 0.75);
                  setSteps(calculatedSteps);
                  stepsRef.current = calculatedSteps;
                }
                return newDist;
              });
              lastMotionTimeRef.current = Date.now();
              setIsMoving(true);
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
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }
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
    lastMotionTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      setDurationMs(prev => prev + 1000);
    }, 1000);
    
    watchPosition();
  };

  const pauseTracking = () => {
    setIsPaused(true);
    setIsMoving(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const resumeTracking = () => {
    setIsPaused(false);
    lastMotionTimeRef.current = Date.now();
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

  // Format time (MM:SS)
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Estimate calories: roughly 60-80 calories per km for user weight
  const weightKg = user?.profile?.weight || 75;
  const estimatedCals = Math.round(distanceKm * weightKg * 1.036); 

  const currentPace = distanceKm > 0 ? (durationMs / 1000 / 60) / distanceKm : 0; // min/km
  const formatPace = (pace) => {
    if (!pace || !isFinite(pace) || pace === 0) return "--:--";
    const m = Math.floor(pace);
    const s = Math.round((pace - m) * 60).toString().padStart(2, '0');
    return `${m}'${s}"`;
  };

  const saveRun = async () => {
    setSaving(true);
    const durationMins = Math.max(1, Math.round(durationMs / 1000 / 60));
    await logExercise({
      activityType: `Run/Walk (${parseFloat(distanceKm.toFixed(2))} km, ${steps} steps)`,
      durationMinutes: durationMins,
      caloriesBurned: estimatedCals,
      loggedAt: new Date().toISOString()
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-2xl relative w-full max-w-sm mx-auto flex flex-col space-y-5">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="text-center mt-2">
        <h3 className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2">
          <MapPin className="w-5 h-5 text-indigo-500" />
          Precision Run Tracker
        </h3>
        <p className="text-xs text-gray-500 mt-1">Real-time motion & step monitoring</p>
      </div>

      {/* Real-time Motion Status Indicator */}
      {isTracking && (
        <div className="flex items-center justify-center gap-2 py-0.5">
          {isPaused ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Tracking Paused
            </span>
          ) : isMoving ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-current text-emerald-500" />
              Active Motion / Counting Steps
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Stopped / Stationary (Steps Paused)
            </span>
          )}
        </div>
      )}
      
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
          <span className="block text-sm font-bold text-gray-800">{steps.toLocaleString()}</span>
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
