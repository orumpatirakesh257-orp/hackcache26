import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAccessibilityStore } from './store/useAccessibilityStore';
import { useQueueStore } from './store/useQueueStore';
import { Header } from './components/Header';
import { BroadcastBanner } from './components/BroadcastBanner';
import { FloatingAccessibilityBar } from './components/FloatingAccessibilityBar';
import { TurnNotificationModal } from './components/TurnNotificationModal';

import { Landing } from './pages/Landing';
import { Register } from './pages/Register';
import { SlipView } from './pages/SlipView';
import { ScanSlip } from './pages/ScanSlip';
import { TrackMyTurn } from './pages/TrackMyTurn';
import { Navigation } from './pages/Navigation';
import { Emergency } from './pages/Emergency';
import { StaffDashboard } from './pages/StaffDashboard';
import { DisplayBoard } from './pages/DisplayBoard';
import { Login } from './pages/Login';

import { ProtectedRoute } from './components/ProtectedRoute';

const AppContent: React.FC = () => {
  const location = useLocation();
  const { fontSize } = useAccessibilityStore();
  const { initSocket } = useQueueStore();

  useEffect(() => {
    initSocket();
  }, [initSocket]);

  const isTvDisplay = location.pathname === '/display';
  const isStaffRoute = location.pathname.startsWith('/staff') || isTvDisplay;

  // Apply font size class to wrapper
  const fontSizeClass =
    fontSize === 'large'
      ? 'font-size-large'
      : fontSize === 'xlarge'
      ? 'font-size-xlarge'
      : '';

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 transition-all ${fontSizeClass}`}>
      {!isTvDisplay && <Header />}
      {!isTvDisplay && <BroadcastBanner />}

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/slip/:slipId" element={<SlipView />} />
          <Route path="/scan" element={<ScanSlip />} />
          <Route path="/track" element={<TrackMyTurn />} />
          <Route path="/navigation" element={<Navigation />} />
          <Route path="/emergency" element={<Emergency />} />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['admin', 'doctor', 'counter_staff', 'triage_nurse']}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/display" element={<DisplayBoard />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>

      {/* Persistent Accessibility Toolbar & Turn Called Alert (ONLY on public patient views) */}
      {!isStaffRoute && <FloatingAccessibilityBar />}
      {!isStaffRoute && <TurnNotificationModal />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};
