import { create } from 'zustand';
import { UserRole } from '../../../shared/types';
import { DEMO_ACCOUNTS } from '../../../shared/constants';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  details?: string;
  phone?: string;
}

interface AuthState {
  user: AuthUser;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser, token?: string, isAuth?: boolean) => void;
  staffLogin: (accountId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  switchRole: (role: UserRole, accountId?: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const defaultUser: AuthUser = {
  id: 'guest-patient',
  name: 'Patient (Guest)',
  role: 'patient',
  details: 'Public Patient / Mobile User',
};

export const useAuthStore = create<AuthState>((set, get) => {
  const savedUserStr = localStorage.getItem('sahai_user');
  const savedToken = localStorage.getItem('sahai_auth_token');
  const initialUser: AuthUser = savedUserStr ? JSON.parse(savedUserStr) : defaultUser;
  const isInitiallyStaff = initialUser.role !== 'patient' && !!savedToken;

  return {
    user: initialUser,
    token: savedToken || null,
    isAuthenticated: isInitiallyStaff,

    setUser: (user, token, isAuth) => {
      const isStaffUser = user.role !== 'patient';
      const authenticated = isAuth !== undefined ? isAuth : (isStaffUser && !!token);
      localStorage.setItem('sahai_user', JSON.stringify(user));
      if (token) localStorage.setItem('sahai_auth_token', token);
      else localStorage.removeItem('sahai_auth_token');
      localStorage.setItem('sahai_auth_status', authenticated ? 'true' : 'false');
      set({ user, token: token || null, isAuthenticated: authenticated });
    },

    staffLogin: async (accountId: string, password: string) => {
      // 1. Validate password - must be '1234' for hackathon demo
      if (!password || password.trim() !== '1234') {
        return {
          success: false,
          error: 'Access Denied: Incorrect password. For hackathon demo, use password: 1234',
        };
      }

      try {
        const res = await fetch('/api/auth/staff-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, password }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.user) {
          localStorage.setItem('sahai_user', JSON.stringify(data.user));
          localStorage.setItem('sahai_auth_token', data.token);
          localStorage.setItem('sahai_auth_status', 'true');
          set({ user: data.user, token: data.token, isAuthenticated: true });
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Authentication failed' };
        }
      } catch (err) {
        // Offline / fallback verification
        const found = DEMO_ACCOUNTS.find((a) => a.id === accountId && a.role !== 'patient');
        if (found) {
          const staffUser: AuthUser = {
            id: found.id,
            name: found.name,
            role: found.role,
            details: found.details,
          };
          const fallbackToken = `jwt-staff-${found.role}-demo-${Date.now()}`;
          localStorage.setItem('sahai_user', JSON.stringify(staffUser));
          localStorage.setItem('sahai_auth_token', fallbackToken);
          localStorage.setItem('sahai_auth_status', 'true');
          set({ user: staffUser, token: fallbackToken, isAuthenticated: true });
          return { success: true };
        }
        return { success: false, error: 'Staff account not found' };
      }
    },

    switchRole: async (role: UserRole, accountId?: string, password?: string) => {
      // If switching to a staff role, enforce password '1234'
      if (role !== 'patient') {
        if (!password || password.trim() !== '1234') {
          return {
            success: false,
            error: 'Staff authentication requires demo password: 1234',
          };
        }
      }

      try {
        const res = await fetch('/api/auth/switch-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, accountId, password }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          const isStaff = data.user.role !== 'patient';
          localStorage.setItem('sahai_user', JSON.stringify(data.user));
          localStorage.setItem('sahai_auth_token', data.token);
          localStorage.setItem('sahai_auth_status', isStaff ? 'true' : 'false');
          set({ user: data.user, token: data.token, isAuthenticated: isStaff });
          return { success: true };
        } else {
          return { success: false, error: data.error || 'Failed to switch role' };
        }
      } catch (err) {
        // Fallback local switch
        const found = DEMO_ACCOUNTS.find((a) => a.id === accountId || a.role === role);
        if (found) {
          const isStaff = found.role !== 'patient';
          const newUser: AuthUser = {
            id: found.id,
            name: found.name,
            role: found.role,
            details: found.details,
          };
          const token = `jwt-${found.role}-local`;
          localStorage.setItem('sahai_user', JSON.stringify(newUser));
          localStorage.setItem('sahai_auth_token', token);
          localStorage.setItem('sahai_auth_status', isStaff ? 'true' : 'false');
          set({ user: newUser, token, isAuthenticated: isStaff });
          return { success: true };
        }
        return { success: false, error: 'Role account not found' };
      }
    },

    logout: () => {
      localStorage.removeItem('sahai_user');
      localStorage.removeItem('sahai_auth_token');
      localStorage.removeItem('sahai_auth_status');
      set({ user: defaultUser, token: null, isAuthenticated: false });
    },
  };
});
