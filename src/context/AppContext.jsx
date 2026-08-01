import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(undefined);

export const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        localStorage.setItem('cnt_token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
        return urlToken;
      }
      const hash = window.location.hash;
      if (hash.includes('token=')) {
        const match = hash.match(/token=([^&]+)/);
        if (match && match[1]) {
          const hashToken = decodeURIComponent(match[1]);
          localStorage.setItem('cnt_token', hashToken);
          window.history.replaceState({}, document.title, window.location.pathname);
          return hashToken;
        }
      }
    } catch (e) {
      // ignore
    }
    return localStorage.getItem('cnt_token');
  });
  const [selectedDate, setSelectedDateState] = useState(getLocalDateString());
  const [foodEntries, setFoodEntries] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [waterLog, setWaterLog] = useState(null);
  const [customMeals, setCustomMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);

  // Offline & Sync States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [simulatedOffline, setSimulatedOffline] = useState(() => {
    return localStorage.getItem('caliber_sim_offline') === 'true';
  });
  const effectiveOnline = isOnline && !simulatedOffline;

  const [pendingQueue, setPendingQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('caliber_pending_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    return localStorage.getItem('caliber_last_sync');
  });

  const initialized = !authLoading;

  // Listen to browser network status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync queue to localStorage
  useEffect(() => {
    localStorage.setItem('caliber_pending_queue', JSON.stringify(pendingQueue));
  }, [pendingQueue]);

  // Sync simulated offline mode setting
  useEffect(() => {
    localStorage.setItem('caliber_sim_offline', String(simulatedOffline));
  }, [simulatedOffline]);

  const toggleSimulatedOffline = () => {
    setSimulatedOffline(prev => !prev);
  };

  const removePendingItem = (id) => {
    setPendingQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearPendingQueue = () => {
    setPendingQueue([]);
  };

  // Sync pending items with backend server
  const syncPendingQueue = useCallback(async () => {
    if (!token || pendingQueue.length === 0 || isSyncing || !effectiveOnline) return;
    setIsSyncing(true);

    const remainingItems= [];

    for (const item of pendingQueue) {
      try {
        let success = false;
        if (item.type === 'LOG_FOOD') {
          const res = await fetch('/api/food/log', {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.payload)
          });
          success = res.ok;
        } else if (item.type === 'DELETE_FOOD') {
          if (item.payload.id.startsWith('offline_')) {
            success = true;
          } else {
            const res = await fetch(`/api/food/log/${item.payload.id}`, {
              method,
              headers: { 'Authorization': `Bearer ${token}` }
            });
            success = res.ok;
          }
        } else if (item.type === 'LOG_EXERCISE') {
          const res = await fetch('/api/exercises', {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.payload)
          });
          success = res.ok;
        } else if (item.type === 'DELETE_EXERCISE') {
          if (item.payload.id.startsWith('offline_')) {
            success = true;
          } else {
            const res = await fetch(`/api/exercises/${item.payload.id}`, {
              method,
              headers: { 'Authorization': `Bearer ${token}` }
            });
            success = res.ok;
          }
        } else if (item.type === 'UPDATE_WATER') {
          const res = await fetch('/api/water', {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.payload)
          });
          success = res.ok;
        } else if (item.type === 'SAVE_CUSTOM_MEAL') {
          const res = await fetch('/api/custom-meals', {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.payload)
          });
          success = res.ok;
        }

        if (!success) {
          remainingItems.push(item);
        }
      } catch (err) {
        console.error(`Failed to sync item ${item.id}`, err);
        remainingItems.push(item);
      }
    }

    setPendingQueue(remainingItems);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastSyncTime(nowStr);
    localStorage.setItem('caliber_last_sync', nowStr);
    setIsSyncing(false);

    // Refresh server data after sync completes
    fetchDayData(selectedDate);
  }, [token, pendingQueue, isSyncing, effectiveOnline, selectedDate]);

  // Auto trigger sync when back online
  useEffect(() => {
    if (effectiveOnline && pendingQueue.length > 0 && token && !isSyncing) {
      syncPendingQueue();
    }
  }, [effectiveOnline, pendingQueue.length, token]);

  // Authenticate on mount or token change
  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          await fetchCustomMeals(token);
        } else {
          logout();
        }
      } catch (err) {
        console.error("Auth initialization failed", err);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
  }, [token]);

  // Fetch daily logs when date changes or user changes
  useEffect(() => {
    if (user && token) {
      fetchDayData(selectedDate);
    }
  }, [selectedDate, user]);

  const fetchCustomMeals = async (authToken) => {
    if (!effectiveOnline) {
      try {
        const cached = localStorage.getItem('caliber_custom_meals');
        if (cached) setCustomMeals(JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      const res = await fetch('/api/custom-meals', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomMeals(data);
        localStorage.setItem('caliber_custom_meals', JSON.stringify(data));
      }
    } catch (err) {
      console.error("Failed to fetch custom meals", err);
    }
  };

  const fetchDayData = async (dateStr) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    if (!effectiveOnline) {
      try {
        const cached = localStorage.getItem(`caliber_day_${dateStr}`);
        if (cached) {
          const { foodData, exerciseData, waterData } = JSON.parse(cached);
          setFoodEntries(foodData || []);
          setExercises(exerciseData || []);
          setWaterLog(waterData || null);
        }
      } catch (e) {
        console.error("Failed to parse cached day data", e);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const foodRes = await fetch(`/api/food/entries?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const foodData = foodRes.ok ? await foodRes.json() : [];

      const exerciseRes = await fetch(`/api/exercises?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const exerciseData = exerciseRes.ok ? await exerciseRes.json() : [];

      const waterRes = await fetch(`/api/water?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const waterData = waterRes.ok ? await waterRes.json() : null;

      setFoodEntries(foodData);
      setExercises(exerciseData);
      setWaterLog(waterData);

      localStorage.setItem(`caliber_day_${dateStr}`, JSON.stringify({ foodData, exerciseData, waterData }));
    } catch (err) {
      console.warn("Failed to load date data from server, loading local cache", err);
      try {
        const cached = localStorage.getItem(`caliber_day_${dateStr}`);
        if (cached) {
          const { foodData, exerciseData, waterData } = JSON.parse(cached);
          setFoodEntries(foodData || []);
          setExercises(exerciseData || []);
          setWaterLog(waterData || null);
        }
      } catch (e) {
        setError("Failed to fetch logs for the selected date.");
      }
    } finally {
      setLoading(false);
    }
  };


  const fetchWithRetry = async (url, options = undefined, retries = 3, delay = 1000) => {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
  };

  const signup = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithRetry('/api/auth/signup', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return false;
      }

      localStorage.setItem('cnt_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithRetry('/api/auth/login', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return false;
      }

      localStorage.setItem('cnt_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('cnt_token');
    setToken(null);
    setUser(null);
    setFoodEntries([]);
    setExercises([]);
    setWaterLog(null);
    setCustomMeals([]);
    setError(null);
  };

  // Google OAuth login flow (popup-based with mobile/APK fallback)
  const googleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const res = await fetchWithRetry(`/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to initiate Google Authentication");
      }
      
      const { url } = await res.json();
      
      // Open the authorization URL directly in a popup, or navigate directly if popup blocked / mobile APK
      const authWindow = window.open(
        url,
        'google_oauth_popup',
        'width=550,height=650,status=no,resizable=yes,scrollbars=yes'
      );
      
      if (!authWindow) {
        // Fallback for mobile APK / TWA / popup blockers: navigate directly to auth URL
        window.location.href = url;
        return;
      }

      // Track when the popup is closed by user or due to redirect_uri_mismatch
      const popupChecker = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(popupChecker);
          setLoading(false);
          // If login wasn't successful after popup closed
          if (!localStorage.getItem('cnt_token')) {
            setError(`Google sign-in popup was closed. If you got "Error 400: redirect_uri_mismatch", please add ${window.location.origin}/auth/google/callback to Authorized redirect URIs in Google Cloud Console.`);
          }
        }
      }, 500);

    } catch (err) {
      console.error("Google Login initiation failed", err);
      setError(err?.message || "Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  // Global listener for Google auth messages from the popup callback
  useEffect(() => {
    const handleMessage = (event) => {
      // Simple security checks on origin (must be same origin or *.run.app)
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const receivedToken = event.data.token;
        const receivedUser = event.data.user;
        
        if (receivedToken && receivedUser) {
          localStorage.setItem('cnt_token', receivedToken);
          setToken(receivedToken);
          setUser(receivedUser);
        }
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setError(event.data.error || "Google authentication failed.");
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updateProfile = async (profileData) => {
    if (!token) return false;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update profile");
        return false;
      }

      setUser(prev => prev ? { ...prev, profile: data.profile } : null);
      return true;
    } catch (err) {
      setError("Failed to sync profile change with server.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const setSelectedDate = (date) => {
    setSelectedDateState(date);
  };

  const logFood = async (food) => {
    if (!token) return false;

    if (!effectiveOnline) {
      const tempId = `offline_food_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newEntry= {
        id,
        userId: user?.id || 'offline_user',
        ...food
      };

      if (food.loggedAt.startsWith(selectedDate)) {
        setFoodEntries(prev => [...prev, newEntry]);
      }

      setPendingQueue(prev => [...prev, {
        id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'LOG_FOOD',
        timestamp: new Date().toISOString(),
        title: food.foodName,
        subtitle: `${food.calories} kcal • ${food.mealType}`,
        payload: food
      }]);
      return true;
    }

    try {
      const res = await fetch('/api/food/log', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(food)
      });

      if (res.ok) {
        const newEntry = await res.json();
        if (food.loggedAt.startsWith(selectedDate)) {
          setFoodEntries(prev => [...prev, newEntry]);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Network error during logFood. Queueing offline item...");
      const tempId = `offline_food_${Date.now()}`;
      const newEntry= {
        id,
        userId: user?.id || 'offline_user',
        ...food
      };
      if (food.loggedAt.startsWith(selectedDate)) {
        setFoodEntries(prev => [...prev, newEntry]);
      }
      setPendingQueue(prev => [...prev, {
        id: `sync_${Date.now()}`,
        type: 'LOG_FOOD',
        timestamp: new Date().toISOString(),
        title: food.foodName,
        subtitle: `${food.calories} kcal • ${food.mealType}`,
        payload: food
      }]);
      return true;
    }
  };

  const deleteFoodLog = async (id) => {
    if (!token) return false;

    const target = foodEntries.find(e => e.id === id);
    setFoodEntries(prev => prev.filter(e => e.id !== id));

    if (!effectiveOnline) {
      if (id.startsWith('offline_')) {
        setPendingQueue(prev => prev.filter(item => !(item.type === 'LOG_FOOD' && item.payload.foodName === target?.foodName)));
      } else {
        setPendingQueue(prev => [...prev, {
          id: `sync_del_${Date.now()}`,
          type: 'DELETE_FOOD',
        timestamp: new Date().toISOString(),
        title: `Deleted: ${target?.foodName || 'Food Item'}`,
        payload: { id }
      }]);
      }
      return true;
    }

    try {
      const res = await fetch(`/api/food/log/${id}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.ok;
    } catch (err) {
      setPendingQueue(prev => [...prev, {
        id: `sync_del_${Date.now()}`,
        type: 'DELETE_FOOD',
        timestamp: new Date().toISOString(),
        title: `Deleted: ${target?.foodName || 'Food Item'}`,
        payload: { id }
      }]);
      return true;
    }
  };

  const logExercise = async (exercise) => {
    if (!token) return false;

    if (!effectiveOnline) {
      const tempId = `offline_ex_${Date.now()}`;
      const newEx= {
        id,
        userId: user?.id || 'offline_user',
        ...exercise
      };
      if (exercise.loggedAt.startsWith(selectedDate)) {
        setExercises(prev => [...prev, newEx]);
      }
      setPendingQueue(prev => [...prev, {
        id: `sync_ex_${Date.now()}`,
        type: 'LOG_EXERCISE',
        timestamp: new Date().toISOString(),
        title: exercise.activityType,
        subtitle: `${exercise.caloriesBurned} kcal burned (${exercise.durationMinutes}m)`,
        payload: exercise
      }]);
      return true;
    }

    try {
      const res = await fetch('/api/exercises', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(exercise)
      });

      if (res.ok) {
        const newEx = await res.json();
        if (exercise.loggedAt.startsWith(selectedDate)) {
          setExercises(prev => [...prev, newEx]);
        }
        return true;
      }
      return false;
    } catch (err) {
      const tempId = `offline_ex_${Date.now()}`;
      const newEx= { id, userId: user?.id || 'offline_user', ...exercise };
      if (exercise.loggedAt.startsWith(selectedDate)) {
        setExercises(prev => [...prev, newEx]);
      }
      setPendingQueue(prev => [...prev, {
        id: `sync_ex_${Date.now()}`,
        type: 'LOG_EXERCISE',
        timestamp: new Date().toISOString(),
        title: exercise.activityType,
        subtitle: `${exercise.caloriesBurned} kcal burned`,
        payload: exercise
      }]);
      return true;
    }
  };

  const deleteExerciseLog = async (id) => {
    if (!token) return false;

    const target = exercises.find(e => e.id === id);
    setExercises(prev => prev.filter(e => e.id !== id));

    if (!effectiveOnline) {
      if (id.startsWith('offline_')) {
        setPendingQueue(prev => prev.filter(item => !(item.type === 'LOG_EXERCISE' && item.payload.activityType === target?.activityType)));
      } else {
        setPendingQueue(prev => [...prev, {
          id: `sync_delex_${Date.now()}`,
          type: 'DELETE_EXERCISE',
        timestamp: new Date().toISOString(),
        title: `Deleted workout`,
        payload: { id }
      }]);
      }
      return true;
    }

    try {
      const res = await fetch(`/api/exercises/${id}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.ok;
    } catch (err) {
      setPendingQueue(prev => [...prev, {
        id: `sync_delex_${Date.now()}`,
        type: 'DELETE_EXERCISE',
        timestamp: new Date().toISOString(),
        title: `Deleted workout`,
        payload: { id }
      }]);
      return true;
    }
  };

  const updateWater = async (glasses) => {
    if (!token) return false;

    const newWaterLog= {
      id: waterLog?.id || `offline_w_${Date.now()}`,
      userId: user?.id || 'offline_user',
      glasses,
      dateStr,
      updatedAt: new Date().toISOString()
    };

    setWaterLog(newWaterLog);

    if (!effectiveOnline) {
      setPendingQueue(prev => [
        ...prev.filter(item => !(item.type === 'UPDATE_WATER' && item.payload.dateStr === selectedDate)),
        {
          id: `sync_water_${Date.now()}`,
          type,
          timestamp: new Date().toISOString(),
          title: `Water Intake: ${glasses} glasses`,
          payload: { dateStr, glasses }
        }
      ]);
      return true;
    }

    try {
      const res = await fetch('/api/water', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dateStr, glasses })
      });

      if (res.ok) {
        const data = await res.json();
        setWaterLog(data);
        return true;
      }
      return false;
    } catch (err) {
      setPendingQueue(prev => [
        ...prev.filter(item => !(item.type === 'UPDATE_WATER' && item.payload.dateStr === selectedDate)),
        {
          id: `sync_water_${Date.now()}`,
          type,
          timestamp: new Date().toISOString(),
          title: `Water Intake: ${glasses} glasses`,
          payload: { dateStr, glasses }
        }
      ]);
      return true;
    }
  };

  const saveCustomMeal = async (meal) => {
    if (!token) return false;

    if (!effectiveOnline) {
      const newMeal= {
        id: `offline_meal_${Date.now()}`,
        userId: user?.id || 'offline_user',
        createdAt: new Date().toISOString(),
        ...meal
      };
      setCustomMeals(prev => [...prev, newMeal]);
      setPendingQueue(prev => [...prev, {
        id: `sync_meal_${Date.now()}`,
        type: 'SAVE_CUSTOM_MEAL',
        timestamp: new Date().toISOString(),
        title: `Custom Meal: ${meal.mealName}`,
        subtitle: `${meal.totalCalories} kcal`,
        payload: meal
      }]);
      return true;
    }

    try {
      const res = await fetch('/api/custom-meals', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(meal)
      });

      if (res.ok) {
        const data = await res.json();
        setCustomMeals(prev => [...prev, data]);
        return true;
      }
      return false;
    } catch (err) {
      const newMeal= {
        id: `offline_meal_${Date.now()}`,
        userId: user?.id || 'offline_user',
        createdAt: new Date().toISOString(),
        ...meal
      };
      setCustomMeals(prev => [...prev, newMeal]);
      setPendingQueue(prev => [...prev, {
        id: `sync_meal_${Date.now()}`,
        type: 'SAVE_CUSTOM_MEAL',
        timestamp: new Date().toISOString(),
        title: `Custom Meal: ${meal.mealName}`,
        subtitle: `${meal.totalCalories} kcal`,
        payload: meal
      }]);
      return true;
    }
  };

  const deleteCustomMeal = async (id) => {
    if (!token) return false;
    try {
      const res = await fetch(`/api/custom-meals/${id}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setCustomMeals(prev => prev.filter(m => m.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      token,
      selectedDate,
      foodEntries,
      exercises,
      waterLog,
      customMeals,
      loading,
      authLoading,
      initialized,
      error,
      // Offline & Sync
      isOnline,
      effectiveOnline,
      simulatedOffline,
      toggleSimulatedOffline,
      pendingQueue,
      isSyncing,
      lastSyncTime,
      syncPendingQueue,
      clearPendingQueue,
      removePendingItem,

      signup,
      login,
      logout,
      googleLogin,
      updateProfile,
      setSelectedDate,
      fetchDayData,
      logFood,
      deleteFoodLog,
      logExercise,
      deleteExerciseLog,
      updateWater,
      saveCustomMeal,
      deleteCustomMeal
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
