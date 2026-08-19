import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'bright' | 'dim' | 'night' | 'light' | 'dark' | 'system';
export type ActiveTheme = 'bright' | 'dim' | 'night';

interface ThemeContextType {
  theme: 'light' | 'dark'; // for backward compatibility with existing boolean switches
  activeTheme: ActiveTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('studyos_theme_mode') as ThemeMode;
    if (saved === 'light' || saved === 'bright') return 'bright';
    if (saved === 'dim') return 'dim';
    if (saved === 'dark' || saved === 'night') return 'night';
    if (saved === 'system') return 'system';
    return 'bright';
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('bright');

  useEffect(() => {
    const updateTheme = () => {
      let resolved: ActiveTheme = 'bright';
      if (themeMode === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolved = prefersDark ? 'night' : 'bright';
      } else if (themeMode === 'light' || themeMode === 'bright') {
        resolved = 'bright';
      } else if (themeMode === 'dim') {
        resolved = 'dim';
      } else if (themeMode === 'dark' || themeMode === 'night') {
        resolved = 'night';
      }

      setActiveTheme(resolved);
      const root = document.documentElement;
      root.classList.remove('light', 'dark', 'theme-bright', 'theme-dim', 'theme-night');

      if (resolved === 'bright') {
        root.classList.add('light', 'theme-bright');
        root.setAttribute('data-theme', 'bright');
      } else if (resolved === 'dim') {
        root.classList.add('dark', 'theme-dim');
        root.setAttribute('data-theme', 'dim');
      } else {
        root.classList.add('dark', 'theme-night');
        root.setAttribute('data-theme', 'night');
      }
    };

    updateTheme();
    localStorage.setItem('studyos_theme_mode', themeMode);

    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateTheme();
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const toggleTheme = () => {
    setThemeModeState(prev => {
      if (prev === 'bright' || prev === 'light') return 'dim';
      if (prev === 'dim') return 'night';
      return 'bright';
    });
  };

  const legacyTheme: 'light' | 'dark' = activeTheme === 'bright' ? 'light' : 'dark';

  return (
    <ThemeContext.Provider value={{ theme: legacyTheme, activeTheme, themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
