import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeSettings {
  primaryColor: string;
  backgroundColor: string; // Lighter shade for backgrounds
  borderRadius: string;    // CSS value (e.g. '0px', '12px')
  baseFontSize: number;    // Percentage (e.g., 100, 90, 110)
  isCompact: boolean;
  posColumns: number;      // Grid density (4, 5, or 6)
  isDarkMode: boolean;     // New: Dark Mode State
  cardBackgroundColor: string;
}

interface ThemeContextType {
  settings: ThemeSettings;
  updateSettings: (newSettings: Partial<ThemeSettings>) => void;
  applyPreset: (presetName: 'coffee' | 'dopamia' | 'dark') => void;
}

// Default state
const defaultSettings: ThemeSettings = {
  primaryColor: '#8d6e63',
  backgroundColor: '#fdf8f6',
  borderRadius: '1.75rem',
  baseFontSize: 100,
  isCompact: false,
  posColumns: 5,
  isDarkMode: false,
  cardBackgroundColor: '#FFFFFF', // Fondo tarjeta independiente
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    // Load from LocalStorage on mount
    const saved = localStorage.getItem('app_theme_settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  // Effect: Apply styles to DOM whenever settings change
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // 1. Dark Mode Injection
    if (settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 2. Apply Colors
    root.style.setProperty('--primary-color', settings.primaryColor);

    // 3. Apply Radius
    root.style.setProperty('--radius-global', settings.borderRadius);

    // 4. Apply Base Scale (Font Size)
    const compactMultiplier = settings.isCompact ? 0.85 : 1;
    const finalScale = settings.baseFontSize * compactMultiplier;

    root.style.setProperty('--base-scale', `${finalScale}%`);

    // 5. Toggle Body Class for Compact Mode
    if (settings.isCompact) {
      body.classList.add('compact-mode');
    } else {
      body.classList.remove('compact-mode');
    }

    // Persist
    localStorage.setItem('app_theme_settings', JSON.stringify(settings));

  }, [settings]);

  const updateSettings = (newSettings: Partial<ThemeSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const applyPreset = (name: 'coffee' | 'dopamia' | 'dark') => {
    switch (name) {
      case 'dopamia':
        updateSettings({
          primaryColor: '#7c3aed', // Violet 600
          backgroundColor: '#f5f3ff', // Violet 50
          borderRadius: '1rem', // Very rounded
          posColumns: 5, // Forzamos 5 columnas para el look Dopamia
          isDarkMode: false
        });
        break;
      case 'dark':
        // This preset now activates actual Dark Mode
        updateSettings({
          primaryColor: '#3b82f6', // Blue 500 for contrast
          backgroundColor: '#111827', // Gray 900
          borderRadius: '0.5rem',
          posColumns: 5, // 5 columnas para el look Clásico
          isDarkMode: true
        });
        break;
      case 'coffee':
      default:
        updateSettings({
          primaryColor: '#8d6e63',
          backgroundColor: '#fdf8f6',
          borderRadius: '0.75rem',
          isDarkMode: false
        });
        break;
    }
  };

  return (
    <ThemeContext.Provider value={{ settings, updateSettings, applyPreset }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};