import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(undefined);

export const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const entryMatchesDate = (loggedAt, dateStr) => {
  if (!loggedAt || !dateStr) return false;
  if (typeof loggedAt === 'string') {
    if (loggedAt.startsWith(dateStr)) return true;
    const match = loggedAt.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match && match[1] === dateStr) return true;
  }
  try {
    const d = new Date(loggedAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (`${year}-${month}-${day}` === dateStr) return true;

      const uYear = d.getUTCFullYear();
      const uMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
      const uDay = String(d.getUTCDate()).padStart(2, '0');
      if (`${uYear}-${uMonth}-${uDay}` === dateStr) return true;
    }
  } catch (e) {}
  return false;
};

export const AppProvider = ({ children }) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
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
  const [allFoodEntries, setAllFoodEntries] = useState(() => {
    try {
      const cached = localStorage.getItem('caliber_all_food');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [allExercises, setAllExercises] = useState(() => {
    try {
      const cached = localStorage.getItem('caliber_all_exercises');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
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

  const logout = () => {
    localStorage.removeItem('cnt_token');
    setToken(null);
    setUser(null);
    setFoodEntries([]);
    setExercises([]);
    setAllFoodEntries([]);
    setAllExercises([]);
    setWaterLog(null);
    setCustomMeals([]);
    setError(null);
  };

  const fetchAllHistory = useCallback(async () => {
    if (!token) return;
    if (!effectiveOnline) {
      try {
        const cachedFood = localStorage.getItem('caliber_all_food');
        if (cachedFood) setAllFoodEntries(JSON.parse(cachedFood));
        const cachedEx = localStorage.getItem('caliber_all_exercises');
        if (cachedEx) setAllExercises(JSON.parse(cachedEx));
      } catch (e) {
        console.error("Error reading cached history:", e);
      }
      return;
    }

    try {
      const [foodRes, exRes] = await Promise.all([
        fetch(`${apiBase}/api/food/entries`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${apiBase}/api/exercises`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (foodRes.ok) {
        const foodData = await foodRes.json();
        setAllFoodEntries(foodData || []);
        localStorage.setItem('caliber_all_food', JSON.stringify(foodData || []));
      }

      if (exRes.ok) {
        const exData = await exRes.json();
        setAllExercises(exData || []);
        localStorage.setItem('caliber_all_exercises', JSON.stringify(exData || []));
      }
    } catch (err) {
      console.warn("Failed to fetch all history from server, using local cache", err);
      try {
        const cachedFood = localStorage.getItem('caliber_all_food');
        if (cachedFood) setAllFoodEntries(JSON.parse(cachedFood));
        const cachedEx = localStorage.getItem('caliber_all_exercises');
        if (cachedEx) setAllExercises(JSON.parse(cachedEx));
      } catch (e) {}
    }
  }, [token, apiBase, effectiveOnline]);

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
      const res = await fetch(`${apiBase}/api/custom-meals`, {
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
      const foodRes = await fetch(`${apiBase}/api/food/entries?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const foodData = foodRes.ok ? await foodRes.json() : [];

      const exerciseRes = await fetch(`${apiBase}/api/exercises?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const exerciseData = exerciseRes.ok ? await exerciseRes.json() : [];

      const waterRes = await fetch(`${apiBase}/api/water?date=${dateStr}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const waterData = waterRes.ok ? await waterRes.json() : null;

      // Preserve unsynced offline queue entries for this date so items never disappear before/during sync
      const pendingFoodForDate = pendingQueue
        .filter(item => item.type === 'LOG_FOOD' && entryMatchesDate(item.payload?.loggedAt, dateStr))
        .map(item => ({
          id: item.tempId || `offline_food_${item.id}`,
          userId: user?.id || 'offline_user',
          ...item.payload
        }));

      const mergedFoodData = Array.isArray(foodData) ? [...foodData] : [];
      pendingFoodForDate.forEach(pf => {
        if (!mergedFoodData.some(f => f.id === pf.id || (f.foodName === pf.foodName && f.mealType === pf.mealType))) {
          mergedFoodData.push(pf);
        }
      });

      const pendingExForDate = pendingQueue
        .filter(item => item.type === 'LOG_EXERCISE' && entryMatchesDate(item.payload?.loggedAt, dateStr))
        .map(item => ({
          id: item.tempId || `offline_ex_${item.id}`,
          userId: user?.id || 'offline_user',
          ...item.payload
        }));

      const mergedExData = Array.isArray(exerciseData) ? [...exerciseData] : [];
      pendingExForDate.forEach(pe => {
        if (!mergedExData.some(e => e.id === pe.id || e.activityType === pe.activityType)) {
          mergedExData.push(pe);
        }
      });

      setFoodEntries(mergedFoodData);
      setExercises(mergedExData);
      setWaterLog(waterData);

      // Merge into allFoodEntries and allExercises
      if (Array.isArray(foodData) && foodData.length > 0) {
        setAllFoodEntries(prev => {
          const map = new Map();
          prev.forEach(item => map.set(item.id || `${item.foodName}_${item.loggedAt}`, item));
          foodData.forEach(item => map.set(item.id || `${item.foodName}_${item.loggedAt}`, item));
          const updated = Array.from(map.values());
          try { localStorage.setItem('caliber_all_food', JSON.stringify(updated)); } catch(e){}
          return updated;
        });
      }

      if (Array.isArray(exerciseData) && exerciseData.length > 0) {
        setAllExercises(prev => {
          const map = new Map();
          prev.forEach(item => map.set(item.id || `${item.activityType}_${item.loggedAt}`, item));
          exerciseData.forEach(item => map.set(item.id || `${item.activityType}_${item.loggedAt}`, item));
          const updated = Array.from(map.values());
          try { localStorage.setItem('caliber_all_exercises', JSON.stringify(updated)); } catch(e){}
          return updated;
        });
      }

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

  const signup = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithRetry(`${apiBase}/api/auth/signup`, {
        method: 'POST',
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
      const res = await fetchWithRetry(`${apiBase}/api/auth/login`, {
        method: 'POST',
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

  // Google OAuth login flow (popup-based with mobile/APK fallback)
  const googleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const redirectUri = `${apiBase || window.location.origin}/auth/google/callback`;
      const res = await fetchWithRetry(`${apiBase}/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      
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
            setError(`Google sign-in popup was closed. If you got "Error 400: redirect_uri_mismatch", please add ${redirectUri} to Authorized redirect URIs in Google Cloud Console.`);
          }
        }
      }, 500);

    } catch (err) {
      console.error("Google Login initiation failed", err);
      setError(err?.message || "Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  // Sync pending items with backend server
  const syncPendingQueue = useCallback(async () => {
    if (!token || pendingQueue.length === 0 || isSyncing || !effectiveOnline) return;
    setIsSyncing(true);

    const remainingItems = [];

    for (const item of pendingQueue) {
      try {
        let success = false;
        if (item.type === 'LOG_FOOD') {
          const res = await fetch(`${apiBase}/api/food/log`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.payload)
          });
          if (res.ok) {
            success = true;
            const newEntry = await res.json();
            if (newEntry && newEntry.id) {
              setFoodEntries(prev => [...prev.filter(e => e.id !== item.tempId && !(typeof e.id === 'string' && e.id.startsWith('offline_') && e.foodName === newEntry.foodName)), newEntry]);
              setAllFoodEntries(prev => [...prev.filter(e => e.id !== item.tempId && !(typeof e.id === 'string' && e.id.startsWith('offline_') && e.foodName === newEntry.foodName)), newEntry]);
            }
          }
        } else if (item.type === 'DELETE_FOOD') {
          if (item.payload?.id && typeof item.payload.id === 'string' && item.payload.id.startsWith('offline_')) {
            success = true;
          } else {
            const res = await fetch(`${apiBase}/api/food/log/${item.payload.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            success = res.ok;
          }
        } else if (item.type === 'LOG_EXERCISE') {
          const res = await fetch(`${apiBase}/api/exercises`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.payload)
          });
          if (res.ok) {
            success = true;
            const newEx = await res.json();
            if (newEx && newEx.id) {
              setExercises(prev => [...prev.filter(e => e.id !== item.tempId && !(typeof e.id === 'string' && e.id.startsWith('offline_') && e.activityType === newEx.activityType)), newEx]);
              setAllExercises(prev => [...prev.filter(e => e.id !== item.tempId && !(typeof e.id === 'string' && e.id.startsWith('offline_') && e.activityType === newEx.activityType)), newEx]);
            }
          }
        } else if (item.type === 'DELETE_EXERCISE') {
          if (item.payload?.id && typeof item.payload.id === 'string' && item.payload.id.startsWith('offline_')) {
            success = true;
          } else {
            const res = await fetch(`${apiBase}/api/exercises/${item.payload.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            success = res.ok;
          }
        } else if (item.type === 'UPDATE_WATER') {
          const res = await fetch(`${apiBase}/api/water`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.payload)
          });
          success = res.ok;
        } else if (item.type === 'SAVE_CUSTOM_MEAL') {
          const res = await fetch(`${apiBase}/api/custom-meals`, {
            method: 'POST',
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
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          await fetchCustomMeals(token);
          await fetchAllHistory();
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

  // Global listener for Google auth messages from the popup callback
  useEffect(() => {
    const handleMessage = (event) => {
      // Simple security checks on origin (must be same origin, configured API base origin, or common sandboxes)
      const origin = event.origin;
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      let apiBaseOrigin = '';
      try {
        if (apiBaseUrl) {
          apiBaseOrigin = new URL(apiBaseUrl).origin;
        }
      } catch (e) {
        console.error("Invalid VITE_API_BASE_URL", e);
      }

      const isAllowed = 
        origin === window.location.origin ||
        (apiBaseOrigin && origin === apiBaseOrigin) ||
        origin.endsWith('.run.app') || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('vercel.app');

      if (!isAllowed) {
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
      const res = await fetch(`${apiBase}/api/profile/update`, {
        method: 'POST',
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

    const timePart = new Date().toISOString().split('T')[1] || '12:00:00.000Z';
    const entryLoggedAt = food.loggedAt || (selectedDate ? `${selectedDate}T${timePart}` : new Date().toISOString());
    const foodWithDate = { ...food, loggedAt: entryLoggedAt };

    if (!effectiveOnline) {
      const tempId = `offline_food_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newEntry = {
        id: tempId,
        userId: user?.id || 'offline_user',
        ...foodWithDate
      };

      if (entryMatchesDate(foodWithDate.loggedAt, selectedDate)) {
        setFoodEntries(prev => [...prev.filter(e => e.id !== tempId), newEntry]);
      }
      setAllFoodEntries(prev => {
        const updated = [...prev.filter(e => e.id !== tempId), newEntry];
        try { localStorage.setItem('caliber_all_food', JSON.stringify(updated)); } catch(e){}
        return updated;
      });

      try {
        const cacheKey = `caliber_day_${selectedDate}`;
        const cached = localStorage.getItem(cacheKey);
        const parsed = cached ? JSON.parse(cached) : { foodData: [], exerciseData: [], waterData: null };
        parsed.foodData = [...(parsed.foodData || []).filter(e => e.id !== tempId), newEntry];
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
      } catch (e) {}

      setPendingQueue(prev => [...prev, {
        id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'LOG_FOOD',
        tempId: tempId,
        timestamp: new Date().toISOString(),
        title: foodWithDate.foodName,
        subtitle: `${foodWithDate.calories} kcal • ${foodWithDate.mealType}`,
        payload: foodWithDate
      }]);
      return true;
    }

    try {
      const res = await fetch(`${apiBase}/api/food/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(foodWithDate)
      });

      if (res.ok) {
        const newEntry = await res.json();
        if (entryMatchesDate(newEntry.loggedAt || foodWithDate.loggedAt, selectedDate)) {
          setFoodEntries(prev => [...prev.filter(e => e.id !== newEntry.id), newEntry]);
        }
        setAllFoodEntries(prev => {
          const updated = [...prev.filter(e => e.id !== newEntry.id), newEntry];
          try { localStorage.setItem('caliber_all_food', JSON.stringify(updated)); } catch(e){}
          return updated;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Network error during logFood. Queueing offline item...");
      const tempId = `offline_food_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newEntry = {
        id: tempId,
        userId: user?.id || 'offline_user',
        ...foodWithDate
      };
      if (entryMatchesDate(foodWithDate.loggedAt, selectedDate)) {
        setFoodEntries(prev => [...prev.filter(e => e.id !== tempId), newEntry]);
      }
      setPendingQueue(prev => [...prev, {
        id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'LOG_FOOD',
        tempId: tempId,
        timestamp: new Date().toISOString(),
        title: foodWithDate.foodName,
        subtitle: `${foodWithDate.calories} kcal • ${foodWithDate.mealType}`,
        payload: foodWithDate
      }]);
      return true;
    }
  };

  const deleteFoodLog = async (id) => {
    if (!token) return false;

    const target = foodEntries.find(e => e.id === id) || allFoodEntries.find(e => e.id === id);
    setFoodEntries(prev => prev.filter(e => e.id !== id));
    setAllFoodEntries(prev => {
      const updated = prev.filter(e => e.id !== id);
      try { localStorage.setItem('caliber_all_food', JSON.stringify(updated)); } catch(e){}
      return updated;
    });

    try {
      const cacheKey = `caliber_day_${selectedDate}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.foodData = (parsed.foodData || []).filter(e => e.id !== id);
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
      }
    } catch (e) {}

    if (!effectiveOnline || (typeof id === 'string' && id.startsWith('offline_'))) {
      if (typeof id === 'string' && id.startsWith('offline_')) {
        setPendingQueue(prev => prev.filter(item => item.tempId !== id && item.payload?.id !== id && !(item.type === 'LOG_FOOD' && item.payload?.foodName === target?.foodName)));
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
      const res = await fetch(`${apiBase}/api/food/log/${id}`, {
        method: 'DELETE',
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

    const timePart = new Date().toISOString().split('T')[1] || '12:00:00.000Z';
    const entryLoggedAt = exercise.loggedAt || (selectedDate ? `${selectedDate}T${timePart}` : new Date().toISOString());
    const exWithDate = { ...exercise, loggedAt: entryLoggedAt };

    if (!effectiveOnline) {
      const tempId = `offline_ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newEx = {
        id: tempId,
        userId: user?.id || 'offline_user',
        ...exWithDate
      };
      if (entryMatchesDate(exWithDate.loggedAt, selectedDate)) {
        setExercises(prev => [...prev.filter(e => e.id !== tempId), newEx]);
      }
      setAllExercises(prev => {
        const updated = [...prev.filter(e => e.id !== tempId), newEx];
        try { localStorage.setItem('caliber_all_exercises', JSON.stringify(updated)); } catch(e){}
        return updated;
      });

      try {
        const cacheKey = `caliber_day_${selectedDate}`;
        const cached = localStorage.getItem(cacheKey);
        const parsed = cached ? JSON.parse(cached) : { foodData: [], exerciseData: [], waterData: null };
        parsed.exerciseData = [...(parsed.exerciseData || []).filter(e => e.id !== tempId), newEx];
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
      } catch (e) {}

      setPendingQueue(prev => [...prev, {
        id: `sync_ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'LOG_EXERCISE',
        tempId: tempId,
        timestamp: new Date().toISOString(),
        title: exWithDate.activityType,
        subtitle: `${exWithDate.caloriesBurned} kcal burned (${exWithDate.durationMinutes}m)`,
        payload: exWithDate
      }]);
      return true;
    }

    try {
      const res = await fetch(`${apiBase}/api/exercises`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(exWithDate)
      });

      if (res.ok) {
        const newEx = await res.json();
        if (entryMatchesDate(newEx.loggedAt || exWithDate.loggedAt, selectedDate)) {
          setExercises(prev => [...prev.filter(e => e.id !== newEx.id), newEx]);
        }
        setAllExercises(prev => {
          const updated = [...prev.filter(e => e.id !== newEx.id), newEx];
          try { localStorage.setItem('caliber_all_exercises', JSON.stringify(updated)); } catch(e){}
          return updated;
        });
        return true;
      }
      return false;
    } catch (err) {
      const tempId = `offline_ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newEx = { id: tempId, userId: user?.id || 'offline_user', ...exWithDate };
      if (entryMatchesDate(exWithDate.loggedAt, selectedDate)) {
        setExercises(prev => [...prev.filter(e => e.id !== tempId), newEx]);
      }
      setAllExercises(prev => [...prev.filter(e => e.id !== tempId), newEx]);
      setPendingQueue(prev => [...prev, {
        id: `sync_ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'LOG_EXERCISE',
        tempId: tempId,
        timestamp: new Date().toISOString(),
        title: exWithDate.activityType,
        subtitle: `${exWithDate.caloriesBurned} kcal burned`,
        payload: exWithDate
      }]);
      return true;
    }
  };

  const deleteExerciseLog = async (id) => {
    if (!token) return false;

    const target = exercises.find(e => e.id === id) || allExercises.find(e => e.id === id);
    setExercises(prev => prev.filter(e => e.id !== id));
    setAllExercises(prev => {
      const updated = prev.filter(e => e.id !== id);
      try { localStorage.setItem('caliber_all_exercises', JSON.stringify(updated)); } catch(e){}
      return updated;
    });

    try {
      const cacheKey = `caliber_day_${selectedDate}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.exerciseData = (parsed.exerciseData || []).filter(e => e.id !== id);
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
      }
    } catch (e) {}

    if (!effectiveOnline || (typeof id === 'string' && id.startsWith('offline_'))) {
      if (typeof id === 'string' && id.startsWith('offline_')) {
        setPendingQueue(prev => prev.filter(item => item.tempId !== id && item.payload?.id !== id && !(item.type === 'LOG_EXERCISE' && item.payload?.activityType === target?.activityType)));
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
      const res = await fetch(`${apiBase}/api/exercises/${id}`, {
        method: 'DELETE',
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

    const dateStr = selectedDate;
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
          type: 'UPDATE_WATER',
          timestamp: new Date().toISOString(),
          title: `Water Intake: ${glasses} glasses`,
          payload: { dateStr, glasses }
        }
      ]);
      return true;
    }

    try {
      const res = await fetch(`${apiBase}/api/water`, {
        method: 'POST',
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
          type: 'UPDATE_WATER',
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
      const res = await fetch(`${apiBase}/api/custom-meals`, {
        method: 'POST',
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
      const res = await fetch(`${apiBase}/api/custom-meals/${id}`, {
        method: 'DELETE',
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
      allFoodEntries,
      allExercises,
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
      fetchAllHistory,
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
