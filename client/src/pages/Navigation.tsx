import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Compass,
  Accessibility,
  HelpCircle,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  ArrowRight,
  Layers,
  Footprints,
  Eye,
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { HOSPITAL_NODES, HOSPITAL_EDGES } from '../../../shared/hospitalData';
import { HospitalNode, NavigationRoute, LanguageCode } from '../../../shared/types';
import { speakText, stopSpeaking } from '../utils/audio';

export const Navigation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const destinationParam = searchParams.get('destination') || '';

  // Navigation State
  const [activeFloor, setActiveFloor] = useState<number>(0);
  const [startNodeId, setStartNodeId] = useState<string>('node-main-entrance');
  const [targetNodeId, setTargetNodeId] = useState<string>('node-ward-4');
  const [accessibleOnly, setAccessibleOnly] = useState<boolean>(false);
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isLostModalOpen, setIsLostModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Initialize destination from URL params if present
  useEffect(() => {
    if (destinationParam) {
      fetch(`/api/navigation/fuzzy-search?q=${encodeURIComponent(destinationParam)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.node) {
            setTargetNodeId(data.node.id);
            setActiveFloor(data.node.floor);
          }
        })
        .catch(() => {});
    }
  }, [destinationParam]);

  // Calculate route whenever endpoints or accessible toggle changes
  useEffect(() => {
    setLoading(true);
    fetch('/api/navigation/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromNodeId: startNodeId,
        toNodeId: targetNodeId,
        accessibleOnly,
        language: (i18n.language as LanguageCode) || 'en',
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.steps) {
          setRoute(data);
          setCurrentStepIdx(0);
          // Set active floor to first step floor
          if (data.fromNode) {
            setActiveFloor(data.fromNode.floor);
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [startNodeId, targetNodeId, accessibleOnly, i18n.language]);

  // Filter nodes for active floor view
  const currentFloorNodes = HOSPITAL_NODES.filter((n) => n.floor === activeFloor);

  // Filter path coordinates on active floor for SVG line
  const activeFloorPathNodes = route
    ? route.pathNodeIds
        .map((id) => HOSPITAL_NODES.find((n) => n.id === id))
        .filter((n): n is HospitalNode => Boolean(n && n.floor === activeFloor))
    : [];

  const handleStepAudio = (stepIdx: number) => {
    if (!route || !route.steps[stepIdx]) return;
    const step = route.steps[stepIdx];
    const text = `Step ${step.stepNumber}: ${step.instruction}`;
    speakText(text, (i18n.language as LanguageCode) || 'en');
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const res = await fetch(`/api/navigation/fuzzy-search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.node) {
        setTargetNodeId(data.node.id);
        setActiveFloor(data.node.floor);
      }
    } catch (err) {
      console.warn('Search failed');
    }
  };

  return (
    <div className="py-5 px-3 sm:px-4 max-w-4xl mx-auto space-y-5 pb-28" id="main-content">
      {/* Title & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🗺️</span> {t('nav.title')}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            2D floor plan & landmark guided wayfinding
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Wheelchair accessible route toggle */}
          <button
            onClick={() => setAccessibleOnly(!accessibleOnly)}
            className={`px-3 py-2 rounded-2xl border font-bold text-xs flex items-center gap-1.5 transition ${
              accessibleOnly
                ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Accessibility size={16} />
            <span>{t('nav.accessibleRoute')}</span>
          </button>

          {/* I'm Lost Button */}
          <button
            onClick={() => setIsLostModalOpen(true)}
            className="px-3 py-2 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <HelpCircle size={16} className="text-amber-700" />
            <span>{t('nav.imLost')}</span>
          </button>
        </div>
      </div>

      {/* Destination Search Box */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search size={18} className="absolute left-4 top-3 text-slate-400" />
        <input
          type="text"
          placeholder={t('nav.searchPlace')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-24 py-2.5 rounded-2xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 shadow-xs"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-xs"
        >
          Find
        </button>
      </form>

      {/* Quick Facility Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          Quick:
        </span>
        {[
          { label: 'Ward 4 (Blue Door)', id: 'node-ward-4', floor: 1 },
          { label: 'Room 12 (Dr. Priya - Ortho)', id: 'node-room-12', floor: 1 },
          { label: 'Pharmacy (Ground)', id: 'node-pharmacy', floor: 0 },
          { label: 'Lab Room 3 (Ground)', id: 'node-lab-ground', floor: 0 },
          { label: 'Emergency Block', id: 'node-emergency', floor: 0 },
          { label: 'Restrooms', id: 'node-toilet-g', floor: 0 },
          { label: 'Drinking Water', id: 'node-water-point-g', floor: 0 },
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => {
              setTargetNodeId(chip.id);
              setActiveFloor(chip.floor);
            }}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap font-bold transition border ${
              targetNodeId === chip.id
                ? 'bg-teal-700 text-white border-teal-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Interactive 2D Floor Plan SVG Container */}
      <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden relative">
        {/* Floor Switcher Header */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[
              { floor: 0, label: t('nav.groundFloor') },
              { floor: 1, label: t('nav.firstFloor') },
              { floor: 2, label: t('nav.secondFloor') },
            ].map((f) => (
              <button
                key={f.floor}
                onClick={() => setActiveFloor(f.floor)}
                className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeFloor === f.floor
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
            Floor {activeFloor === 0 ? 'Ground (OPD & Pharmacy)' : activeFloor === 1 ? '1 (Ortho & Wards)' : '2 (Cardio & Skin)'}
          </span>
        </div>

        {/* 2D SVG Map Canvas */}
        <div className="relative w-full aspect-16/10 bg-slate-50 overflow-hidden select-none">
          <svg
            viewBox="0 0 1000 1000"
            className="w-full h-full"
            aria-label={`Hospital Floor Plan - Floor ${activeFloor}`}
          >
            {/* Background Floor Outline Grid */}
            <rect x="50" y="280" width="900" height="660" rx="40" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="6" />

            {/* Block Dividers */}
            <line x1="360" y1="280" x2="360" y2="940" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="8 6" />
            <line x1="640" y1="280" x2="640" y2="940" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="8 6" />

            {/* Block Labels */}
            <text x="200" y="320" fill="#94a3b8" fontSize="24" fontWeight="800">BLOCK A</text>
            <text x="450" y="320" fill="#94a3b8" fontSize="24" fontWeight="800">CENTRAL ATRIUM</text>
            <text x="750" y="320" fill="#94a3b8" fontSize="24" fontWeight="800">BLOCK B</text>

            {/* Animated Dijkstra Path Polyline on Active Floor */}
            {activeFloorPathNodes.length > 1 && (
              <polyline
                points={activeFloorPathNodes.map((n) => `${n.x},${n.y}`).join(' ')}
                fill="none"
                stroke="#0d9488"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="14 10"
                className="animate-dash"
              />
            )}

            {/* Render Nodes for this floor */}
            {currentFloorNodes.map((node) => {
              const isStart = node.id === startNodeId;
              const isTarget = node.id === targetNodeId;
              const isPath = activeFloorPathNodes.some((p) => p.id === node.id);

              return (
                <g
                  key={node.id}
                  onClick={() => setTargetNodeId(node.id)}
                  className="cursor-pointer group"
                >
                  {/* Outer glow for target or start */}
                  {(isStart || isTarget) && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="36"
                      fill={isTarget ? '#dc2626' : '#0d9488'}
                      opacity="0.25"
                      className="animate-ping"
                    />
                  )}

                  {/* Node Circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isTarget ? 24 : isStart ? 22 : node.type === 'landmark' ? 20 : 16}
                    fill={
                      isTarget
                        ? '#dc2626'
                        : isStart
                        ? '#0d9488'
                        : isPath
                        ? '#14b8a6'
                        : node.type === 'landmark'
                        ? '#f59e0b'
                        : node.type === 'emergency'
                        ? '#ef4444'
                        : node.type === 'pharmacy'
                        ? '#10b981'
                        : node.type === 'water_point'
                        ? '#0284c7'
                        : '#e2e8f0'
                    }
                    stroke="#ffffff"
                    strokeWidth="4"
                  />

                  {/* Icon label */}
                  <text
                    x={node.x}
                    y={node.y + 36}
                    textAnchor="middle"
                    fill={isTarget ? '#991b1b' : isPath ? '#0f766e' : '#334155'}
                    fontSize={isTarget || isStart ? '18' : '14'}
                    fontWeight={isTarget || isStart ? '900' : '700'}
                  >
                    {node.roomNumber || node.name.split(' (')[0].slice(0, 16)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Map Overlays Legend */}
          <div className="absolute bottom-2 left-2 p-2 rounded-xl bg-white/90 backdrop-blur-xs border border-slate-200 text-[10px] font-bold text-slate-700 flex flex-wrap gap-2 shadow-xs">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"></span> Start
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span> Destination
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Landmark
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Water
            </span>
          </div>
        </div>
      </div>

      {/* Step-by-Step Directions with Landmark Cards */}
      {route && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border-2 border-slate-200 shadow-xl space-y-5">
          {/* Summary Route Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-teal-800">
                Route Summary
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                {route.fromNode.name} → {route.toNode.name}
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Distance: ~{route.totalDistanceMeters}m • Walking time: ~{route.totalTimeMinutes} mins
                {route.isAccessible ? ' • ♿ Wheelchair Accessible' : ''}
              </p>
            </div>

            <button
              onClick={() => handleStepAudio(currentStepIdx)}
              className="px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center gap-1.5 border border-teal-200 transition shrink-0"
            >
              <Volume2 size={16} />
              <span>Read Directions Aloud</span>
            </button>
          </div>

          {/* Numbered Step-by-Step Direction Cards */}
          <div className="space-y-3">
            {route.steps.map((step, idx) => {
              const isCurrent = idx === currentStepIdx;
              return (
                <div
                  key={step.stepNumber}
                  onClick={() => {
                    setCurrentStepIdx(idx);
                    setActiveFloor(step.floor);
                    handleStepAudio(idx);
                  }}
                  className={`p-4 rounded-2xl border-2 text-left cursor-pointer transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'border-teal-600 bg-teal-50/70 shadow-md ring-2 ring-teal-400'
                      : 'border-slate-200 bg-slate-50/50 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {step.stepNumber}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-snug">
                        {step.instruction}
                      </p>
                      <span className="text-[11px] font-semibold text-slate-500 mt-1 block">
                        Floor {step.floor === 0 ? 'Ground' : step.floor} • Block {step.block} • {step.distanceMeters}m
                      </span>
                    </div>
                  </div>

                  {/* Landmark Thumbnail if present on step */}
                  {step.landmark?.image && (
                    <div className="shrink-0 flex items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                      <img
                        src={step.landmark.image}
                        alt={step.landmark.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                      <div className="text-left pr-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 block">
                          Landmark
                        </span>
                        <span className="text-[11px] font-bold text-slate-800 leading-tight block">
                          {step.landmark.name.slice(0, 16)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Navigator Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              onClick={() => {
                const prev = Math.max(0, currentStepIdx - 1);
                setCurrentStepIdx(prev);
                setActiveFloor(route.steps[prev].floor);
                handleStepAudio(prev);
              }}
              disabled={currentStepIdx === 0}
              className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-xs disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              <span>Previous Step</span>
            </button>

            <span className="text-xs font-bold text-slate-500">
              Step {currentStepIdx + 1} of {route.steps.length}
            </span>

            <button
              onClick={() => {
                const next = Math.min(route.steps.length - 1, currentStepIdx + 1);
                setCurrentStepIdx(next);
                setActiveFloor(route.steps[next].floor);
                handleStepAudio(next);
              }}
              disabled={currentStepIdx === route.steps.length - 1}
              className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs disabled:opacity-40 flex items-center gap-1 shadow-sm"
            >
              <span>Next Step</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* "I'm Lost" Landmark Picker Modal */}
      {isLostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-amber-500 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span>🧭</span> Which landmark do you see nearby?
                </h3>
                <p className="text-xs text-slate-500">Tap the landmark closest to you to recalculate your route</p>
              </div>
              <button
                onClick={() => setIsLostModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {[
                { name: 'Green Ficus Plant', id: 'node-plant-g', image: '/landmarks/plant.png', floor: 0 },
                { name: 'Water Purifier Cooler', id: 'node-water-point-g', image: '/landmarks/water_point.png', floor: 0 },
                { name: 'Yellow Railing Stairs', id: 'node-stairs-g', image: '/landmarks/stairs.png', floor: 0 },
                { name: 'Central Lift / Elevator', id: 'node-lift-g', image: '/landmarks/lift.png', floor: 0 },
                { name: 'Pharmacy (Green Cross)', id: 'node-pharmacy', image: '/landmarks/pharmacy.png', floor: 0 },
                { name: 'Blue Doors (Ward 4)', id: 'node-ward-4', image: '/landmarks/coloured_doors.png', floor: 1 },
              ].map((lm) => (
                <button
                  key={lm.id}
                  onClick={() => {
                    setStartNodeId(lm.id);
                    setActiveFloor(lm.floor);
                    setIsLostModalOpen(false);
                    speakText(`Route recalculated from ${lm.name}`, (i18n.language as LanguageCode) || 'en');
                  }}
                  className="p-3 rounded-2xl border-2 border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-teal-50 text-left transition flex flex-col items-center gap-2 group"
                >
                  <img src={lm.image} alt={lm.name} className="w-full h-24 object-cover rounded-xl" />
                  <span className="font-bold text-xs text-slate-900 text-center leading-tight group-hover:text-teal-800">
                    {lm.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
