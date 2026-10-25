import { create } from 'zustand';

export type FontSize = 'normal' | 'large' | 'xlarge';

interface AccessibilityState {
  fontSize: FontSize;
  simpleMode: boolean;
  autoRead: boolean;
  setFontSize: (size: FontSize) => void;
  cycleFontSize: () => void;
  toggleSimpleMode: () => void;
  toggleAutoRead: () => void;
}

// Clean up any previously stored high-contrast / dark mode state
if (typeof window !== 'undefined') {
  localStorage.removeItem('sahai_high_contrast');
  document.documentElement.classList.remove('high-contrast');
}

export const useAccessibilityStore = create<AccessibilityState>((set, get) => ({
  fontSize: (localStorage.getItem('sahai_font_size') as FontSize) || 'normal',
  simpleMode: localStorage.getItem('sahai_simple_mode') === 'true',
  autoRead: localStorage.getItem('sahai_auto_read') === 'true',

  setFontSize: (size: FontSize) => {
    localStorage.setItem('sahai_font_size', size);
    set({ fontSize: size });
  },

  cycleFontSize: () => {
    const current = get().fontSize;
    const next: FontSize = current === 'normal' ? 'large' : current === 'large' ? 'xlarge' : 'normal';
    localStorage.setItem('sahai_font_size', next);
    set({ fontSize: next });
  },

  toggleSimpleMode: () => {
    const next = !get().simpleMode;
    localStorage.setItem('sahai_simple_mode', String(next));
    set({ simpleMode: next });
  },

  toggleAutoRead: () => {
    const next = !get().autoRead;
    localStorage.setItem('sahai_auto_read', String(next));
    set({ autoRead: next });
  },
}));
