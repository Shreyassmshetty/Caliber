import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, CloudUpload, RefreshCw, X, CheckCircle2, Trash2, Smartphone, ShieldCheck, Database } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const OfflineSyncModal = ({ isOpen, onClose }) => {
  const {
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
  } = useApp();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-slate-100 dark:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`p-3 rounded-2xl ${
              !effectiveOnline ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {!effectiveOnline ? <WifiOff className="w-6 h-6" /> : <Database className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                Offline Entry & Sync
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log meals, water, and workouts anytime — even without internet.
              </p>
            </div>
          </div>

          {/* Connection Status Box */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  !effectiveOnline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`} />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {simulatedOffline
                    ? 'Simulated Offline Mode'
                    : isOnline
                    ? 'Connected (Online)'
                    : 'Disconnected (Offline)'}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                {lastSyncTime ? `Last sync: ${lastSyncTime}` : 'Not synced yet'}
              </span>
            </div>

            {/* Simulation mode toggle switch */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Simulate Offline Mode</p>
                  <p className="text-[10px] text-slate-400">Test offline logging without turning off Wi-Fi</p>
                </div>
              </div>
              <button
                onClick={toggleSimulatedOffline}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  simulatedOffline ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    simulatedOffline ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Pending Queue Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CloudUpload className="w-4 h-4 text-amber-500" />
                Pending Sync Queue ({pendingQueue.length})
              </h3>
              {pendingQueue.length > 0 && (
                <button
                  onClick={clearPendingQueue}
                  className="text-[11px] text-red-500 hover:text-red-600 font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Queue
                </button>
              )}
            </div>

            {pendingQueue.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                  All entries synced!
                </p>
                <p className="text-[11px] text-slate-400">
                  Your offline food, water, and exercise logs are completely up to date.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {pendingQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {item.type.replace('_', ' ')}
                        </span>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removePendingItem(item.id)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={syncPendingQueue}
              disabled={isSyncing || pendingQueue.length === 0 || !effectiveOnline}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                isSyncing || pendingQueue.length === 0 || !effectiveOnline
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing with Cloud...' : 'Sync Pending Entries Now'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
