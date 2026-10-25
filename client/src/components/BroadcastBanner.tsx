import React from 'react';
import { Megaphone, X } from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';

export const BroadcastBanner: React.FC = () => {
  const { activeBroadcast, dismissBroadcast } = useQueueStore();

  if (!activeBroadcast) return null;

  return (
    <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2.5 shadow-md flex items-center justify-between z-30 sticky top-[57px] animate-fade-in border-b-2 border-amber-600">
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1">
        <Megaphone size={20} className="animate-bounce shrink-0" />
        <span className="text-xs uppercase tracking-wider bg-black/10 px-2 py-0.5 rounded-sm">
          Announcement:
        </span>
        <p className="text-sm font-bold truncate md:text-wrap">{activeBroadcast}</p>
      </div>
      <button
        onClick={dismissBroadcast}
        className="p-1 rounded-full hover:bg-black/10 text-slate-900 transition ml-2"
        aria-label="Dismiss announcement"
      >
        <X size={18} />
      </button>
    </div>
  );
};
