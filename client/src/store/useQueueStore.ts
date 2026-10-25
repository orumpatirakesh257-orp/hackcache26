import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { QueueToken, DigitalSlip, Patient } from '../../../shared/types';
import { playHospitalChime } from '../utils/audio';

interface QueueState {
  activeToken: QueueToken | null;
  activeSlip: DigitalSlip | null;
  activePatient: Patient | null;
  socket: Socket | null;
  isConnected: boolean;
  activeBroadcast: string | null;
  calledNotification: {
    tokenNumber: string;
    doctorName: string;
    roomNumber: string;
    patientName: string;
  } | null;
  setActiveToken: (token: QueueToken | null) => void;
  setActiveSlip: (slip: DigitalSlip | null) => void;
  setActivePatient: (patient: Patient | null) => void;
  initSocket: () => void;
  dismissNotification: () => void;
  dismissBroadcast: () => void;
}

export const useQueueStore = create<QueueState>((set, get) => {
  const cachedToken = localStorage.getItem('sahai_active_token');
  const cachedSlip = localStorage.getItem('sahai_active_slip');
  const cachedPatient = localStorage.getItem('sahai_active_patient');

  return {
    activeToken: cachedToken ? JSON.parse(cachedToken) : null,
    activeSlip: cachedSlip ? JSON.parse(cachedSlip) : null,
    activePatient: cachedPatient ? JSON.parse(cachedPatient) : null,
    socket: null,
    isConnected: false,
    activeBroadcast: null,
    calledNotification: null,

    setActiveToken: (token) => {
      if (token) {
        localStorage.setItem('sahai_active_token', JSON.stringify(token));
      } else {
        localStorage.removeItem('sahai_active_token');
      }
      set({ activeToken: token });
    },

    setActiveSlip: (slip) => {
      if (slip) {
        localStorage.setItem('sahai_active_slip', JSON.stringify(slip));
      } else {
        localStorage.removeItem('sahai_active_slip');
      }
      set({ activeSlip: slip });
    },

    setActivePatient: (patient) => {
      if (patient) {
        localStorage.setItem('sahai_active_patient', JSON.stringify(patient));
      } else {
        localStorage.removeItem('sahai_active_patient');
      }
      set({ activePatient: patient });
    },

    initSocket: () => {
      if (get().socket) return;

      const socket = io('/', {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        set({ isConnected: true });
        const token = get().activeToken;
        if (token) {
          socket.emit('join:token', token.tokenNumber);
        }
      });

      socket.on('disconnect', () => {
        set({ isConnected: false });
      });

      // Token called alert
      socket.on('token:called', (payload: any) => {
        playHospitalChime();
        set({ calledNotification: payload });
        // Also refresh active token if it matches
        const current = get().activeToken;
        if (current && current.tokenNumber === payload.tokenNumber) {
          set({
            activeToken: {
              ...current,
              status: 'in_consultation',
              calledAt: payload.calledAt,
            },
          });
        }
      });

      // Public display chime
      socket.on('token:called_public', () => {
        playHospitalChime();
      });

      // Broadcast message
      socket.on('broadcast:message', (data: any) => {
        playHospitalChime();
        set({ activeBroadcast: data.message });
      });

      // Queue updated event
      socket.on('queue:updated', () => {
        const token = get().activeToken;
        if (token) {
          // Re-fetch token status
          fetch(`/api/queue/token/${token.tokenNumber}`)
            .then((r) => r.json())
            .then((data) => {
              if (data.token) {
                set({ activeToken: data.token });
                localStorage.setItem('sahai_active_token', JSON.stringify(data.token));
              }
            })
            .catch(() => {});
        }
      });

      set({ socket });
    },

    dismissNotification: () => set({ calledNotification: null }),
    dismissBroadcast: () => set({ activeBroadcast: null }),
  };
});
