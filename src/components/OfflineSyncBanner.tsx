import React, { useState } from 'react';
import { WifiOff, CloudUpload, RefreshCw, Layers } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { OfflineSyncModal } from './OfflineSyncModal';

export const OfflineSyncBanner: React.FC = () => {
  const {
    effectiveOnline,
    simulatedOffline,
    pendingQueue,
    isSyncing,
    syncPendingQueue
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // If online and no pending items, don't show persistent top bar (or show small pill)
  const isOffline = !effectiveOnline;
  const hasPending = pendingQueue.length > 0;

  if (!isOffline && !hasPending) {
    return null;
  }

  return (
    <>
      <div className={`py-2 px-4 border-b flex items-center justify-between text-xs font-semibold shadow-xs transition-colors ${
        isOffline
          ? 'bg-amber-500 text-slate-950 border-amber-600'
          : 'bg-emerald-600 text-white border-emerald-700'
      }`}>
        <div className="flex items-center gap-2">
          {isOffline ? (
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
          ) : (
            <CloudUpload className="w-4 h-4 shrink-0" />
          )}
          <span>
            {isOffline
              ? (simulatedOffline
                  ? 'Simulated Offline Mode — entries will be saved locally'
                  : 'You are offline — entries saved locally to sync when reconnected')
              : `${pendingQueue.length} offline entry item(s) pending sync`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasPending && effectiveOnline && (
            <button
              onClick={() => syncPendingQueue()}
              disabled={isSyncing}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
              isOffline
                ? 'bg-slate-950 text-white hover:bg-slate-900'
                : 'bg-white text-emerald-800 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Manage Queue ({pendingQueue.length})</span>
          </button>
        </div>
      </div>

      <OfflineSyncModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
