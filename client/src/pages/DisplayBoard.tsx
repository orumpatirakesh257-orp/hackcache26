import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Maximize2, Tv, Clock, AlertCircle } from 'lucide-react';
import { useQueueStore } from '../store/useQueueStore';
import { DEPARTMENTS_DATA, DOCTORS_DATA } from '../../../shared/constants';
import { QueueToken } from '../../../shared/types';
import { playHospitalChime } from '../utils/audio';

export const DisplayBoard: React.FC = () => {
  const { isConnected } = useQueueStore();
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<string>(
    'OPD counters are open. Please proceed to your consultation room when your token is called.'
  );
  const [langCycleIdx, setLangCycleIdx] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const MULTILINGUAL_HEADINGS = [
    { label: 'NOW SERVING', sub: 'GOVERNMENT GENERAL HOSPITAL' },
    { label: 'वर्तमान टोकन (बुलाया गया)', sub: 'सरकारी सामान्य अस्पताल' },
    { label: 'தற்போது அழைக்கப்படும் டோக்கன்', sub: 'அரசு பொது மருத்துவமனை' },
    { label: 'ప్రస్తుతం పిలుస్తున్న టోకెన్', sub: 'ప్రభుత్వ సాధారణ ఆసుపత్రి' },
    { label: 'ಈಗ ಕರೆಯಲಾದ ಟೋಕನ್', sub: 'ಸರ್ಕಾರಿ ಸಾಮಾನ್ಯ ಆಸ್ಪತ್ರೆ' },
    { label: 'ഇപ്പോൾ വിളിക്കുന്ന ടോക്കൺ', sub: 'സർക്കാർ ജനറൽ ആശുപത്രി' },
    { label: 'বর্তমান টোকেন নম্বর', sub: 'সরকারি জেনারেল হাসপাতাল' },
  ];

  const fetchDisplayData = async () => {
    try {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      // Fetch department tokens
      const tokenPromises = DEPARTMENTS_DATA.slice(0, 8).map((d) =>
        fetch(`/api/queue/department/${d.id}`).then((r) => r.json())
      );
      const deptResults = await Promise.all(tokenPromises);
      const allTokens: QueueToken[] = [];
      deptResults.forEach((r) => {
        if (r.tokens) allTokens.push(...r.tokens);
      });
      setTokens(allTokens);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDisplayData();
    const interval = setInterval(fetchDisplayData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Language cycle every 4 seconds
  useEffect(() => {
    const cycle = setInterval(() => {
      setLangCycleIdx((prev) => (prev + 1) % MULTILINGUAL_HEADINGS.length);
    }, 4000);
    return () => clearInterval(cycle);
  }, [MULTILINGUAL_HEADINGS.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const currentHeading = MULTILINGUAL_HEADINGS[langCycleIdx];

  // Group tokens by department
  const displayDepartments = DEPARTMENTS_DATA.slice(0, 8);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Top TV Header Bar */}
      <header className="bg-slate-900 border-b-4 border-teal-500 px-6 py-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="Sahai Setu" className="w-12 h-12" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
              {currentHeading.label}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-teal-400 tracking-widest uppercase">
              {currentHeading.sub}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xl font-mono font-black text-white">
              {new Date().toLocaleTimeString()}
            </span>
            <span className="text-xs text-slate-400 block font-bold">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>

          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playHospitalChime();
            }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="Toggle Chime"
          >
            {audioEnabled ? <Volume2 size={22} className="text-emerald-400" /> : <VolumeX size={22} />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="Toggle TV Fullscreen"
          >
            <Maximize2 size={22} />
          </button>
        </div>
      </header>

      {/* Main Now Serving Grid */}
      <main className="flex-1 p-6 grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto">
        {displayDepartments.map((dept) => {
          const deptTokens = tokens.filter((t) => t.departmentId === dept.id);
          const activeConsult = deptTokens.find((t) => t.status === 'in_consultation');
          const waitingTokens = deptTokens.filter(
            (t) => t.status === 'waiting' || t.status === 'almost_turn'
          );
          const doc = DOCTORS_DATA.find((d) => d.departmentId === dept.id);

          return (
            <div
              key={dept.id}
              className={`rounded-3xl border-3 flex flex-col justify-between p-5 transition-all shadow-xl ${
                activeConsult
                  ? 'bg-slate-900 border-teal-400 ring-4 ring-teal-500/20'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="font-extrabold text-sm text-slate-200 truncate">
                    {dept.name}
                  </h3>
                  <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-800">
                    {doc?.roomNumber || dept.roomRange}
                  </span>
                </div>

                {/* Now Serving Big Number */}
                <div className="py-4 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                    NOW SERVING
                  </span>
                  <span className="text-4xl sm:text-5xl font-black font-mono text-teal-300 tracking-tight block">
                    {activeConsult ? activeConsult.tokenNumber : '—'}
                  </span>
                </div>
              </div>

              {/* Next Upcoming Tokens */}
              <div className="pt-3 border-t border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  NEXT TOKENS:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {waitingTokens.length === 0 ? (
                    <span className="text-xs text-slate-600 font-mono">None</span>
                  ) : (
                    waitingTokens.slice(0, 4).map((w, i) => (
                      <span
                        key={w.id}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                          i === 0
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {w.tokenNumber}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Rotating Multilingual Announcement Ticker */}
      <footer className="bg-slate-900 border-t-2 border-slate-800 px-6 py-3 flex items-center gap-4">
        <span className="px-3 py-1 rounded-lg bg-teal-600 text-white font-extrabold text-xs uppercase tracking-wider shrink-0 animate-pulse">
          ANNOUNCEMENT
        </span>
        <div className="overflow-hidden flex-1">
          <p className="text-sm font-bold text-slate-200 whitespace-nowrap animate-marquee">
            📢 {activeAnnouncement} • Emergency cases proceed directly to Ground Floor Emergency Block • For wheelchair or assistance, approach Kiosk 1.
          </p>
        </div>
      </footer>
    </div>
  );
};
