import React, { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Auth } from './components/Auth';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './components/Dashboard';
import { FoodLogger } from './components/FoodLogger';
import { ExerciseLogger } from './components/ExerciseLogger';
import { Trends } from './components/Trends';
import { Settings } from './components/Settings';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { Apple, PlusCircle, Dumbbell, BarChart3, Settings as SettingsIcon, ShieldCheck, Maximize2, Minimize2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import logo from './assets/images/caliber_app_icon_1787062924343.jpg';


const AppContent = () => {
  const { token, user, initialized } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const lastTriggeredMinuteRef = useRef(null);

  // Fullscreen & PWA Install Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !(document).webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement).webkitRequestFullscreen) {
          (document.documentElement).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document).webkitExitFullscreen) {
          (document).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const handleInstallApp = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredInstallPrompt(null);
      }
    }
  };

  // Dark Mode effect
  useEffect(() => {
    if (user?.profile?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.profile?.darkMode]);

  // Reminders Worker
  useEffect(() => {
    if (!user?.profile?.reminders?.length || typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;

    const checkReminders = () => {
      const now = new Date();
      const currentMinute = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      // Prevent multiple triggers in the same minute
      if (lastTriggeredMinuteRef.current === currentMinute) return;

      const activeReminders = (user.profile?.reminders || []).filter(r => r.enabled && r.time === currentMinute);
      
      if (activeReminders.length > 0) {
        activeReminders.forEach(reminder => {
          new window.Notification('Caliber Reminder', {
            body: reminder.message || 'Time to check in with Caliber!',
            icon: '/icon.png' // assuming there's an icon, or it defaults
          });
        });
        lastTriggeredMinuteRef.current = currentMinute;
      }
    };

    // Check immediately, then every 30 seconds to be safe
    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [user?.profile?.reminders]);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 mt-3 font-medium">Initializing Caliber Tracker...</p>
      </div>
    );
  }

  // 1. Auth Guard
  if (!token) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col justify-between">
        <header className="p-4 bg-white/70 backdrop-blur-md border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Apple className="w-5 h-5 text-primary" />
            <span className="font-display font-black text-sm tracking-tight text-neutral-dark">Caliber</span>
          </div>
          <div className="flex items-center gap-1 bg-primary/10 text-primary py-1 px-2.5 rounded-lg text-[10px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Secure Authentication
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center">
          <Auth />
        </main>

        <footer className="p-4 text-center text-[10px] text-slate-400 border-t border-slate-100 bg-white/40">
          Caliber © 2026. Powered by IFCT, Open Food Facts & Gemini AI.
        </footer>
      </div>
    );
  }

  // 2. Onboarding Guard
  if (user && !user.profile?.onboarded) {
    return (
      <div className="min-h-screen bg-brand-bg py-8">
        <Onboarding />
      </div>
    );
  }

  // 3. Main Dashboard Application layout
  return (
    <div className="min-h-screen bg-brand-bg dark:bg-slate-900 flex flex-col justify-between pb-24">
      {/* Offline Status & Pending Queue Top Banner */}
      <OfflineSyncBanner />

      {/* Top Header */}
      <header className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100/80 dark:border-slate-800 p-3.5 px-4 flex items-center justify-between z-40 shadow-sm/5">

        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs bg-slate-950 flex items-center justify-center">
            <img src={logo} alt="Caliber Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sm tracking-tight text-neutral-dark dark:text-white">Caliber</h1>
            <span className="text-[9px] text-slate-400 font-semibold tracking-wider block uppercase">Smart Nutrition Partner</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {deferredInstallPrompt && (
            <button
              id="install-pwa-header-btn"
              onClick={handleInstallApp}
              title="Install App (Run without Address Bar)"
              className="flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-bold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install</span>
            </button>
          )}

          <button
            id="toggle-fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Hide Browser Address Bar (Fullscreen)"}
            className="flex items-center gap-1 p-1.5 px-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:text-primary hover:bg-primary/10 transition text-[10px] font-medium"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hide Bar</span>
              </>
            )}
          </button>

          {user && (
            <div className="text-right pl-1">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Active Intake</span>
              <span className="text-xs font-bold text-neutral-dark dark:text-slate-200">{user.profile?.name || user.email?.split('@')[0]}</span>
            </div>
          )}
        </div>
      </header>

      {/* Primary views content stage */}
      <main className="flex-1 py-5 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
            {activeTab === 'food' && <FoodLogger />}
            {activeTab === 'exercise' && <ExerciseLogger />}
            {activeTab === 'trends' && <Trends />}
            {activeTab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Sticky Tab Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 py-3.5 px-4 flex justify-around items-center z-40 max-w-md mx-auto rounded-t-3xl shadow-lg">
        {/* Dashboard / Home */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'dashboard' ? 'text-primary scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Apple className="w-5.5 h-5.5" />
          <span className="text-[9px] uppercase tracking-wider">Home</span>
        </button>

        {/* Log Food */}
        <button
          onClick={() => setActiveTab('food')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'food' ? 'text-primary scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <PlusCircle className="w-5.5 h-5.5" />
          <span className="text-[9px] uppercase tracking-wider">Log Food</span>
        </button>

        {/* Log Exercise */}
        <button
          onClick={() => setActiveTab('exercise')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'exercise' ? 'text-primary scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Dumbbell className="w-5.5 h-5.5" />
          <span className="text-[9px] uppercase tracking-wider">Activity</span>
        </button>

        {/* Trends */}
        <button
          onClick={() => setActiveTab('trends')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'trends' ? 'text-primary scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <BarChart3 className="w-5.5 h-5.5" />
          <span className="text-[9px] uppercase tracking-wider">Trends</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'settings' ? 'text-primary scale-105 font-bold' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <SettingsIcon className="w-5.5 h-5.5" />
          <span className="text-[9px] uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
