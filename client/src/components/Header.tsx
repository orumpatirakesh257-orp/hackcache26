import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, MessageSquare, Wifi, ArrowLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useQueueStore } from '../store/useQueueStore';
import { SimulatedMessagesDrawer } from './SimulatedMessagesDrawer';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { isConnected } = useQueueStore();
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);

  const isStaffRoute = location.pathname.startsWith('/staff') || location.pathname.startsWith('/display');
  const isHome = location.pathname === '/';

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            {!isHome && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                aria-label="Go back"
              >
                <ArrowLeft size={20} />
              </button>
            )}

            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.svg"
                alt="Sahai Setu Logo"
                className="w-10 h-10 group-hover:scale-105 transition-transform"
              />
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-teal-800 leading-none flex items-center gap-1.5">
                  <span>{t('appName')}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 uppercase tracking-wider">
                    Govt Hospital
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">{t('appSubtitle')}</p>
              </div>
            </Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Live socket connection status */}
            <div
              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={isConnected ? 'Realtime queue connected' : 'Connecting to queue server...'}
            >
              <Wifi size={12} className={isConnected ? 'text-emerald-600' : 'text-amber-500 animate-pulse'} />
              <span className="hidden sm:inline">{isConnected ? 'Live' : 'Syncing'}</span>
            </div>

            {/* Simulated Messages (SMS/WhatsApp) Drawer Button */}
            <button
              onClick={() => setIsMessagesOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 flex items-center gap-1.5 text-xs font-bold transition"
              title="View Simulated SMS / WhatsApp Alerts"
            >
              <MessageSquare size={16} className="text-teal-600" />
              <span className="hidden md:inline">SMS Logs</span>
            </button>

            {/* Role Switcher & Staff Actions */}
            {isStaffRoute ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-xl bg-teal-100 text-teal-900 font-extrabold text-[11px] border border-teal-300">
                  {user.role.replace('_', ' ').toUpperCase()}
                </span>
                <Link
                  to="/"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition"
                  title="Switch to public patient homepage"
                >
                  Patient View
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs border border-red-200 flex items-center gap-1.5 transition active:scale-95"
                  title="Sign out of hospital staff portal"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            ) : isAuthenticated && user.role !== 'patient' ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/staff"
                  className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                >
                  <ShieldCheck size={15} />
                  <span>Staff Dashboard</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 font-bold text-xs border border-slate-300 transition"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <ShieldCheck size={15} />
                <span>Staff Portal</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <SimulatedMessagesDrawer isOpen={isMessagesOpen} onClose={() => setIsMessagesOpen(false)} />
    </>
  );
};
